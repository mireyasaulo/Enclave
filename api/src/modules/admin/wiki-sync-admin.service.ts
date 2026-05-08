import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/app-error.exception';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { CharacterEntity } from '../characters/character.entity';
import { CharacterBlueprintService } from '../characters/character-blueprint.service';
import type { CharacterBlueprintRecipeValue } from '../characters/character-blueprint.types';
import { CharacterPageEntity } from '../wiki/entities/character-page.entity';
import {
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
  CharacterRevisionEntity,
  type WikiContentSnapshot,
} from '../wiki/entities/character-revision.entity';
import { WikiPageService } from '../wiki/services/wiki-page.service';
import { WikiEditService } from '../wiki/services/wiki-edit.service';
import { WikiSystemUserService } from '../wiki/services/wiki-system-user.service';
import { SYSTEM_ADMIN_SYNC_ID } from '../wiki/seed/system-users.seed';
import {
  WIKI_CONTENT_FIELDS,
  type WikiContentField,
  diffPaths,
  mergeValueByPaths,
  snapshotFromCharacter,
} from '../wiki/wiki.types';
import type {
  WikiSyncApplyItemRequest,
  WikiSyncApplyItemResult,
  WikiSyncApplyRequest,
  WikiSyncApplyResponse,
  WikiSyncContentDiffEntry,
  WikiSyncContentField,
  WikiSyncImportRequest,
  WikiSyncImportResult,
  WikiSyncPreviewFilter,
  WikiSyncPreviewItem,
  WikiSyncPreviewResponse,
  WikiSyncRecipeDiffEntry,
} from './wiki-sync.types';

const ADMIN_SYNC_CHANGE_SOURCE = 'admin_sync_from_wiki';

@Injectable()
export class WikiSyncAdminService {
  private readonly logger = new Logger(WikiSyncAdminService.name);

  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characterRepo: Repository<CharacterEntity>,
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly wikiPageService: WikiPageService,
    private readonly wikiEditService: WikiEditService,
    private readonly wikiSystemUserService: WikiSystemUserService,
    private readonly blueprintService: CharacterBlueprintService,
  ) {}

  async preview(opts: {
    filter?: WikiSyncPreviewFilter;
    characterId?: string;
  }): Promise<WikiSyncPreviewResponse> {
    const filter: WikiSyncPreviewFilter = opts.filter ?? 'drift';
    const items: WikiSyncPreviewItem[] = [];

    if (opts.characterId) {
      const item = await this.buildPreviewItemForId(opts.characterId);
      if (item) items.push(item);
    } else {
      const pages = await this.pageRepo.find({
        where: { isDeleted: false, lifecycleStatus: Not('deleted') },
        order: { updatedAt: 'DESC' },
      });
      for (const page of pages) {
        const item = await this.buildPreviewItemForPage(page);
        if (item) items.push(item);
      }
      if (filter === 'all') {
        const trackedIds = new Set(pages.map((p) => p.characterId));
        const liveOnly = await this.characterRepo.find({
          where: trackedIds.size
            ? { id: Not(In([...trackedIds])) }
            : {},
        });
        for (const character of liveOnly) {
          items.push(this.buildLiveOnlyPreviewItem(character));
        }
      }
    }

    const filtered = items.filter((it) => this.matchesFilter(it, filter));

    return {
      generatedAt: new Date().toISOString(),
      items: filtered,
    };
  }

  private matchesFilter(
    item: WikiSyncPreviewItem,
    filter: WikiSyncPreviewFilter,
  ): boolean {
    if (filter === 'all') return true;
    if (filter === 'drift') {
      return item.status === 'drift' || item.status === 'wiki_only';
    }
    if (filter === 'wiki_only') {
      return item.status === 'wiki_only';
    }
    return true;
  }

  private async buildPreviewItemForId(
    characterId: string,
  ): Promise<WikiSyncPreviewItem | null> {
    const page = await this.pageRepo.findOne({ where: { characterId } });
    if (page) {
      if (page.isDeleted || page.lifecycleStatus === 'deleted') return null;
      return this.buildPreviewItemForPage(page);
    }
    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    if (!character) return null;
    return this.buildLiveOnlyPreviewItem(character);
  }

  private async buildPreviewItemForPage(
    page: CharacterPageEntity,
  ): Promise<WikiSyncPreviewItem | null> {
    const view = await this.wikiPageService
      .getPageView(page.characterId)
      .catch((err) => {
        this.logger.warn(
          `getPageView(${page.characterId}) failed: ${(err as Error).message}`,
        );
        return null;
      });
    if (!view) return null;

    const character = await this.characterRepo.findOne({
      where: { id: page.characterId },
    });
    const stable = view.stableRevision;

    if (!character) {
      // wiki page tracks a character that no longer exists locally
      return {
        characterId: page.characterId,
        name: stable?.contentSnapshot.name ?? page.title ?? page.characterId,
        avatar: stable?.contentSnapshot.avatar ?? null,
        status: stable ? 'wiki_only' : 'no_stable_revision',
        contentDiff: [],
        recipeDiff: [],
        stableRevisionId: stable?.id ?? null,
        stableRevisionVersion: stable?.version ?? null,
        stableRevisionEditedAt: stable?.createdAt?.toISOString() ?? null,
        liveCharacterUpdatedAt: null,
      };
    }

    if (!stable) {
      return {
        characterId: page.characterId,
        name: character.name,
        avatar: character.avatar ?? null,
        status: 'no_stable_revision',
        contentDiff: [],
        recipeDiff: [],
        stableRevisionId: null,
        stableRevisionVersion: null,
        stableRevisionEditedAt: null,
        liveCharacterUpdatedAt: this.toIsoMaybe(
          character as unknown as Record<string, unknown>,
        ),
      };
    }

    const contentDiff = this.computeContentDiff(character, stable.contentSnapshot);
    const liveRecipe = await this.loadPublishedRecipe(page.characterId);
    const recipeDiff = this.computeRecipeDiff(stable.recipeSnapshot, liveRecipe);

    const status: WikiSyncPreviewItem['status'] =
      contentDiff.length > 0 || recipeDiff.length > 0 ? 'drift' : 'in_sync';

    return {
      characterId: page.characterId,
      name: character.name,
      avatar: character.avatar ?? null,
      status,
      contentDiff,
      recipeDiff,
      stableRevisionId: stable.id,
      stableRevisionVersion: stable.version,
      stableRevisionEditedAt: stable.createdAt?.toISOString() ?? null,
      liveCharacterUpdatedAt: this.toIsoMaybe(
        character as unknown as Record<string, unknown>,
      ),
    };
  }

  private buildLiveOnlyPreviewItem(
    character: CharacterEntity,
  ): WikiSyncPreviewItem {
    return {
      characterId: character.id,
      name: character.name,
      avatar: character.avatar ?? null,
      status: 'live_only',
      contentDiff: [],
      recipeDiff: [],
      stableRevisionId: null,
      stableRevisionVersion: null,
      stableRevisionEditedAt: null,
      liveCharacterUpdatedAt: this.toIsoMaybe(
        character as unknown as Record<string, unknown>,
      ),
    };
  }

  private computeContentDiff(
    character: CharacterEntity,
    stableSnapshot: WikiContentSnapshot,
  ): WikiSyncContentDiffEntry[] {
    const live = snapshotFromCharacter(
      character as unknown as Record<string, unknown>,
    );
    const out: WikiSyncContentDiffEntry[] = [];
    for (const field of WIKI_CONTENT_FIELDS) {
      const liveValue = live[field] ?? null;
      const wikiValue = stableSnapshot[field] ?? null;
      if (JSON.stringify(liveValue) !== JSON.stringify(wikiValue)) {
        out.push({
          field: field as WikiSyncContentField,
          liveValue,
          wikiValue,
        });
      }
    }
    return out;
  }

  private computeRecipeDiff(
    wikiRecipe: CharacterBlueprintRecipeValue | null | undefined,
    liveRecipe: CharacterBlueprintRecipeValue | null,
  ): WikiSyncRecipeDiffEntry[] {
    if (!wikiRecipe || !liveRecipe) return [];
    const paths = diffPaths(wikiRecipe, liveRecipe);
    return paths.map((path) => ({
      path,
      liveValue: getPathValue(liveRecipe, path) ?? null,
      wikiValue: getPathValue(wikiRecipe, path) ?? null,
    }));
  }

  private async loadPublishedRecipe(
    characterId: string,
  ): Promise<CharacterBlueprintRecipeValue | null> {
    try {
      const snapshot = await this.blueprintService.getFactorySnapshot(characterId);
      return (
        snapshot.blueprint.publishedRecipe ??
        snapshot.blueprint.draftRecipe ??
        null
      );
    } catch {
      return null;
    }
  }

  private toIsoMaybe(record: Record<string, unknown>): string | null {
    const value =
      (record.updatedAt as Date | string | undefined) ??
      (record.lastActiveAt as Date | string | undefined);
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // ---------------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------------

  async applyBatch(body: WikiSyncApplyRequest): Promise<WikiSyncApplyResponse> {
    if (!body || !Array.isArray(body.items)) {
      throw new AppError('ADMIN_WIKI_ITEMS_REQUIRED', {
        legacyMessage: 'items 必填',
      });
    }
    const summary = body.editSummary?.trim() || null;
    const results: WikiSyncApplyItemResult[] = [];
    for (const item of body.items) {
      results.push(await this.applyOne(item, summary));
    }
    return { results };
  }

  private async applyOne(
    input: WikiSyncApplyItemRequest,
    summary: string | null,
  ): Promise<WikiSyncApplyItemResult> {
    const baseResult: WikiSyncApplyItemResult = {
      characterId: input.characterId,
      status: 'no_changes',
      appliedFields: [],
      appliedRecipePaths: [],
      newRevisionId: null,
      newRevisionVersion: null,
      errorMessage: null,
    };
    if (!input.characterId || !input.expectedStableRevisionId) {
      return {
        ...baseResult,
        status: 'error',
        errorMessage: 'characterId 与 expectedStableRevisionId 必填',
      };
    }
    const requestedFields = (input.contentFields ?? []).filter((field) =>
      (WIKI_CONTENT_FIELDS as readonly string[]).includes(field),
    ) as WikiContentField[];
    const requestedRecipePaths = (input.recipePaths ?? []).filter(
      (p) => typeof p === 'string' && p.length > 0,
    );

    const page = await this.pageRepo.findOne({
      where: { characterId: input.characterId },
    });
    if (!page) {
      return { ...baseResult, status: 'no_stable_revision' };
    }
    if (page.isDeleted || page.lifecycleStatus === 'deleted') {
      return { ...baseResult, status: 'no_stable_revision' };
    }
    if (page.currentRevisionId !== input.expectedStableRevisionId) {
      return { ...baseResult, status: 'stale_revision' };
    }
    const stable = await this.revisionRepo.findOne({
      where: { id: input.expectedStableRevisionId },
    });
    if (!stable) {
      return { ...baseResult, status: 'stale_revision' };
    }
    const character = await this.characterRepo.findOne({
      where: { id: input.characterId },
    });
    if (!character) {
      return { ...baseResult, status: 'live_missing' };
    }

    // Re-compute current drift to intersect with the user's selection. This
    // protects against the user clicking a field that was already converged
    // by another path between preview and apply.
    const currentContentDiffFields = new Set(
      this.computeContentDiff(character, stable.contentSnapshot).map(
        (d) => d.field as string,
      ),
    );
    const liveRecipe = await this.loadPublishedRecipe(input.characterId);
    const currentRecipeDiffPaths = new Set(
      this.computeRecipeDiff(stable.recipeSnapshot, liveRecipe).map((d) => d.path),
    );

    const effectiveFields = requestedFields.filter((field) =>
      currentContentDiffFields.has(field),
    );
    const effectivePaths = stable.recipeSnapshot
      ? requestedRecipePaths.filter((path) => currentRecipeDiffPaths.has(path))
      : [];

    if (effectiveFields.length === 0 && effectivePaths.length === 0) {
      return { ...baseResult, status: 'no_changes' };
    }

    // Build merged snapshots
    const liveContent = snapshotFromCharacter(
      character as unknown as Record<string, unknown>,
    );
    const mergedContent: WikiContentSnapshot = {
      ...liveContent,
      schemaVersion: 2,
    };
    for (const field of effectiveFields) {
      (mergedContent as Record<string, unknown>)[field] =
        (stable.contentSnapshot as Record<string, unknown>)[field];
    }

    let mergedRecipe: CharacterBlueprintRecipeValue | null = null;
    if (effectivePaths.length > 0 && stable.recipeSnapshot && liveRecipe) {
      mergedRecipe = mergeValueByPaths(
        liveRecipe,
        stable.recipeSnapshot,
        effectivePaths,
      );
    }

    try {
      // Recipe write happens outside the audit transaction because
      // CharacterBlueprintService.publish opens its own transactions and
      // touches multiple tables. If recipe write fails we still abort early.
      if (mergedRecipe) {
        await this.blueprintService.updateDraft(input.characterId, mergedRecipe);
        await this.blueprintService.publish(
          input.characterId,
          summary || '管理员从 wiki 同步 recipe',
        );
      }

      const newVersion = (await this.getLastVersion(input.characterId)) + 1;
      const actorId = SYSTEM_ADMIN_SYNC_ID;
      const writtenRevision = await this.dataSource.transaction(async (manager) => {
        if (effectiveFields.length > 0) {
          // Reuse the canonical content writer used by wiki edits.
          await this.wikiEditService.applySnapshotToCharacter(
            manager,
            input.characterId,
            mergedContent,
          );
        }
        const revision = manager.create(CharacterRevisionEntity, {
          characterId: input.characterId,
          version: newVersion,
          parentRevisionId: page.currentRevisionId,
          baseRevisionId: page.currentRevisionId,
          contentSnapshot: mergedContent,
          recipeSnapshot: mergedRecipe ?? stable.recipeSnapshot ?? null,
          diffFromParent: {
            changed: [
              '__sync_from_wiki__',
              ...effectiveFields.map((f) => `content:${f}`),
              ...effectivePaths.map((p) => `recipe:${p}`),
            ],
            sourceRevisionId: stable.id,
            sourceVersion: stable.version,
          },
          editorUserId: actorId,
          editorRoleAtTime: 'admin',
          editSummary:
            summary ||
            `管理员从 wiki v${stable.version} 同步 ${effectiveFields.length} 项内容、${effectivePaths.length} 项 recipe`,
          status: 'approved',
          revisionKind: effectivePaths.length > 0 ? 'recipe' : 'content',
          operation: 'edit',
          riskLevel: 'low',
          changeSource: ADMIN_SYNC_CHANGE_SOURCE,
          isMinor: false,
          isPatrolled: true,
          patrolledBy: actorId,
          patrolledAt: new Date(),
        });
        const saved = await manager.save(revision);
        await manager.update(
          CharacterPageEntity,
          { characterId: input.characterId },
          {
            currentRevisionId: saved.id,
            latestRevisionId: saved.id,
            editCount: (page.editCount ?? 0) + 1,
            title: mergedContent.name ?? page.title,
          },
        );
        return saved;
      });

      return {
        characterId: input.characterId,
        status: 'applied',
        appliedFields: effectiveFields as WikiSyncContentField[],
        appliedRecipePaths: effectivePaths,
        newRevisionId: writtenRevision.id,
        newRevisionVersion: writtenRevision.version,
        errorMessage: null,
      };
    } catch (err) {
      this.logger.error(
        `applyOne(${input.characterId}) failed`,
        (err as Error).stack,
      );
      return {
        ...baseResult,
        status: 'error',
        errorMessage: (err as Error).message ?? 'unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Import missing (wiki_only -> create live)
  // ---------------------------------------------------------------------------

  async importMissing(
    body: WikiSyncImportRequest,
  ): Promise<WikiSyncImportResult> {
    if (!body?.characterId || !body?.expectedStableRevisionId) {
      throw new AppError('ADMIN_WIKI_CHARACTER_REVISION_REQUIRED', {
        legacyMessage: 'characterId 与 expectedStableRevisionId 必填',
      });
    }
    const baseResult: WikiSyncImportResult = {
      characterId: body.characterId,
      status: 'no_changes',
      appliedFields: [],
      appliedRecipePaths: [],
      newRevisionId: null,
      newRevisionVersion: null,
      errorMessage: null,
    };
    const page = await this.pageRepo.findOne({
      where: { characterId: body.characterId },
    });
    if (!page) return { ...baseResult, status: 'no_stable_revision' };
    if (page.currentRevisionId !== body.expectedStableRevisionId) {
      return { ...baseResult, status: 'stale_revision' };
    }
    const existing = await this.characterRepo.findOne({
      where: { id: body.characterId },
    });
    if (existing) {
      return {
        ...baseResult,
        status: 'error',
        errorMessage: '角色已存在，请改用同步而非导入',
      };
    }
    const stable = await this.revisionRepo.findOne({
      where: { id: body.expectedStableRevisionId },
    });
    if (!stable?.recipeSnapshot) {
      return {
        ...baseResult,
        status: 'no_stable_revision',
        errorMessage: '稳定版本无 recipe 快照，无法导入',
      };
    }
    try {
      await this.blueprintService.createCharacterFromRecipe({
        id: body.characterId,
        sourceType: 'wiki_contributed',
        deletionPolicy: 'archive_allowed',
        recipe: stable.recipeSnapshot,
      });
      // record an audit revision marking this import
      const actorId = SYSTEM_ADMIN_SYNC_ID;
      const newVersion = (await this.getLastVersion(body.characterId)) + 1;
      const revision = await this.revisionRepo.save(
        this.revisionRepo.create({
          characterId: body.characterId,
          version: newVersion,
          parentRevisionId: page.currentRevisionId,
          baseRevisionId: page.currentRevisionId,
          contentSnapshot: stable.contentSnapshot,
          recipeSnapshot: stable.recipeSnapshot,
          diffFromParent: {
            changed: ['__sync_from_wiki__', '__import__'],
            sourceRevisionId: stable.id,
            sourceVersion: stable.version,
          },
          editorUserId: actorId,
          editorRoleAtTime: 'admin',
          editSummary: `管理员从 wiki v${stable.version} 导入新建角色`,
          status: 'approved',
          revisionKind: 'lifecycle',
          operation: 'create',
          riskLevel: 'low',
          changeSource: ADMIN_SYNC_CHANGE_SOURCE,
          isMinor: false,
          isPatrolled: true,
          patrolledBy: actorId,
          patrolledAt: new Date(),
        }),
      );
      await this.pageRepo.update(
        { characterId: body.characterId },
        {
          currentRevisionId: revision.id,
          latestRevisionId: revision.id,
          editCount: (page.editCount ?? 0) + 1,
          lifecycleStatus: 'active',
          isDeleted: false,
        },
      );
      return {
        characterId: body.characterId,
        status: 'applied',
        appliedFields: WIKI_CONTENT_FIELDS as unknown as WikiSyncContentField[],
        appliedRecipePaths: [],
        newRevisionId: revision.id,
        newRevisionVersion: revision.version,
        errorMessage: null,
      };
    } catch (err) {
      this.logger.error(
        `importMissing(${body.characterId}) failed`,
        (err as Error).stack,
      );
      return {
        ...baseResult,
        status: 'error',
        errorMessage: (err as Error).message ?? 'unknown error',
      };
    }
  }

  private async getLastVersion(characterId: string): Promise<number> {
    const row = await this.revisionRepo
      .createQueryBuilder('r')
      .where('r.characterId = :id', { id: characterId })
      .select('MAX(r.version)', 'max')
      .getRawOne<{ max: number | null }>();
    return row?.max ?? 0;
  }
}

function getPathValue(target: unknown, path: string): unknown {
  if (target == null) return undefined;
  const parts = path.split('.');
  let cursor: unknown = target;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}
// i18n-ignore-end
