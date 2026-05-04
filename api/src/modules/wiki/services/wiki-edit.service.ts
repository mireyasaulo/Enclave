import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CharacterBlueprintService } from '../../characters/character-blueprint.service';
import type { CharacterBlueprintRecipeValue } from '../../characters/character-blueprint.types';
import { CharacterEntity } from '../../characters/character.entity';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { CharacterPageEntity } from '../entities/character-page.entity';
import {
  CharacterRevisionEntity,
  type WikiContentSnapshot,
} from '../entities/character-revision.entity';
import { EditSubmissionEntity } from '../entities/edit-submission.entity';
import { UserWikiProfileEntity } from '../entities/user-wiki-profile.entity';
import { rankOf } from '../guards/wiki-role.guard';
import { WikiBlockService } from './wiki-block.service';
import { WikiPageService } from './wiki-page.service';
import { WikiRoleService } from './wiki-role.service';
import {
  WIKI_CONTENT_FIELDS,
  createDefaultWikiRecipe,
  diffFields,
  diffPaths,
  isHighRiskRecipeChange,
  normalizeWikiRecipe,
  pickWikiContent,
  snapshotFromRecipe,
  snapshotFromCharacter,
} from '../wiki.types';

export type SubmitEditInput = {
  contentSnapshot: Record<string, unknown>;
  recipeSnapshot?: Record<string, unknown> | null;
  baseRevisionId?: string | null;
  editSummary?: string;
  isMinor?: boolean;
};

export type SubmitEditResult = {
  revisionId: string;
  status: string;
  isPatrolled: boolean;
  appliedToCharacter: boolean;
};

@Injectable()
export class WikiEditService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(CharacterEntity)
    private readonly characterRepo: Repository<CharacterEntity>,
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
    @InjectRepository(EditSubmissionEntity)
    private readonly submissionRepo: Repository<EditSubmissionEntity>,
    @InjectRepository(UserWikiProfileEntity)
    private readonly profileRepo: Repository<UserWikiProfileEntity>,
    private readonly pages: WikiPageService,
    private readonly blocks: WikiBlockService,
    private readonly roles: WikiRoleService,
    private readonly blueprints: CharacterBlueprintService,
  ) {}

  async submit(
    characterId: string,
    user: AuthenticatedUser,
    input: SubmitEditInput,
  ): Promise<SubmitEditResult> {
    if (input.recipeSnapshot) {
      return this.submitRecipeEdit(characterId, user, input);
    }

    await this.blocks.assertCanEdit(user, characterId);
    const page = await this.pages.getOrInitPage(characterId);
    if (page.isDeleted) {
      throw new ForbiddenException('该词条已被删除，无法编辑');
    }
    this.assertProtection(page.protectionLevel, user.role);

    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    if (!character) throw new BadRequestException('角色不存在');

    const before: WikiContentSnapshot = page.currentRevisionId
      ? (await this.revisionRepo.findOne({
          where: { id: page.currentRevisionId },
        }))!.contentSnapshot
      : snapshotFromCharacter(character as unknown as Record<string, unknown>);

    const after = pickWikiContent(input.contentSnapshot ?? {});
    const changed = diffFields(before, after);
    if (changed.length === 0) {
      throw new BadRequestException('未检测到变更');
    }

    if (
      input.baseRevisionId &&
      page.currentRevisionId &&
      input.baseRevisionId !== page.currentRevisionId
    ) {
      const baseRev = await this.revisionRepo.findOne({
        where: { id: input.baseRevisionId },
      });
      if (!baseRev) {
        throw new BadRequestException('基线版本无效');
      }
      const concurrentChanged = diffFields(baseRev.contentSnapshot, before);
      const overlap = changed.filter((f) => concurrentChanged.includes(f));
      if (overlap.length > 0) {
        throw new ConflictException({
          message: '存在编辑冲突，请基于最新版本重新提交',
          conflictingFields: overlap,
          currentRevisionId: page.currentRevisionId,
          currentSnapshot: before,
        });
      }
    }

    const autoApprove = rankOf(user.role) >= rankOf('autoconfirmed');
    const lastVersion = await this.revisionRepo
      .createQueryBuilder('r')
      .where('r.characterId = :id', { id: characterId })
      .select('MAX(r.version)', 'max')
      .getRawOne<{ max: number | null }>();
    const nextVersion = (lastVersion?.max ?? 0) + 1;

    const result = await this.dataSource.transaction(async (manager) => {
      const revision = manager.create(CharacterRevisionEntity, {
        characterId,
        version: nextVersion,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: input.baseRevisionId ?? page.currentRevisionId ?? null,
        contentSnapshot: after,
        diffFromParent: { changed },
        editorUserId: user.id,
        editorRoleAtTime: user.role,
        editSummary: (input.editSummary ?? '').slice(0, 500),
        status: autoApprove ? 'approved' : 'pending',
        revisionKind: 'content',
        operation: 'edit',
        riskLevel: 'low',
        changeSource: 'edit',
        isMinor: Boolean(input.isMinor),
        isPatrolled: false,
      });
      const savedRev = await manager.save(revision);

      if (!autoApprove) {
        const submission = manager.create(EditSubmissionEntity, {
          revisionId: savedRev.id,
          characterId,
          submitterId: user.id,
          operation: 'edit',
          riskLevel: 'low',
          decision: null,
          priority: 0,
        });
        await manager.save(submission);
      } else {
        await manager.update(
          CharacterPageEntity,
          { characterId },
          {
            currentRevisionId: savedRev.id,
            title: after.name,
            lifecycleStatus: 'active',
            editCount: page.editCount + 1,
          },
        );
        await this.applySnapshotToCharacter(manager, characterId, after);
      }

      const profile =
        (await manager.findOne(UserWikiProfileEntity, {
          where: { userId: user.id },
        })) ??
        manager.create(UserWikiProfileEntity, {
          userId: user.id,
          editCount: 0,
          approvedEditCount: 0,
          revertedCount: 0,
          patrolledCount: 0,
        });
      profile.editCount += 1;
      profile.lastEditAt = new Date();
      if (autoApprove) profile.approvedEditCount += 1;
      await manager.save(profile);

      if (!autoApprove) {
        await manager.update(
          CharacterPageEntity,
          { characterId },
          { editCount: page.editCount + 1 },
        );
      }

      return savedRev;
    });

    if (autoApprove) {
      void this.roles.checkPromotion(user.id).catch(() => undefined);
    }

    return {
      revisionId: result.id,
      status: result.status,
      isPatrolled: result.isPatrolled,
      appliedToCharacter: autoApprove,
    };
  }

  async createPage(
    user: AuthenticatedUser,
    input: {
      characterId?: string | null;
      recipeSnapshot?: Record<string, unknown> | null;
      contentSnapshot?: Record<string, unknown> | null;
      editSummary?: string | null;
    },
  ): Promise<SubmitEditResult & { characterId: string }> {
    const characterId = this.resolveNewCharacterId(input.characterId);
    await this.blocks.assertCanEdit(user, characterId);
    const existing = await this.characterRepo.findOne({ where: { id: characterId } });
    if (existing) {
      throw new BadRequestException('角色 ID 已存在');
    }
    const existingPage = await this.pageRepo.findOne({ where: { characterId } });
    if (existingPage) {
      throw new BadRequestException(
        existingPage.lifecycleStatus === 'pending_create'
          ? '该角色已有待审创建请求'
          : '词条已存在',
      );
    }

    const seedInput =
      input.recipeSnapshot ??
      input.contentSnapshot ??
      ({} as Record<string, unknown>);
    const recipe = normalizeWikiRecipe(
      seedInput,
      createDefaultWikiRecipe(seedInput),
    );
    const content = snapshotFromRecipe(recipe);
    const autoApprove = rankOf(user.role) >= rankOf('patroller');
    const revision = await this.dataSource.transaction(async (manager) => {
      const page =
        existingPage ??
        manager.create(CharacterPageEntity, {
          characterId,
          title: content.name,
          currentRevisionId: null,
          lifecycleStatus: 'pending_create',
          reviewPolicy: 'pending_changes',
          protectionLevel: 'none',
          isPatrolled: false,
          watcherCount: 0,
          editCount: 0,
          isDeleted: false,
        });
      page.title = content.name;
      page.lifecycleStatus = autoApprove ? 'active' : 'pending_create';
      page.isDeleted = false;
      await manager.save(page);

      const created = manager.create(CharacterRevisionEntity, {
        characterId,
        version: 1,
        parentRevisionId: null,
        baseRevisionId: null,
        contentSnapshot: content,
        recipeSnapshot: recipe,
        diffFromParent: { changed: ['__create__'] },
        editorUserId: user.id,
        editorRoleAtTime: user.role,
        editSummary: (input.editSummary ?? '创建角色词条').slice(0, 500),
        status: autoApprove ? 'approved' : 'pending',
        revisionKind: 'recipe',
        operation: 'create',
        riskLevel: 'high',
        changeSource: 'edit',
        isMinor: false,
        isPatrolled: false,
      });
      const saved = await manager.save(created);
      if (!autoApprove) {
        await manager.save(
          manager.create(EditSubmissionEntity, {
            revisionId: saved.id,
            characterId,
            submitterId: user.id,
            operation: 'create',
            riskLevel: 'high',
            decision: null,
            priority: 10,
          }),
        );
      }
      await this.bumpProfile(manager, user.id, autoApprove);
      return saved;
    });

    if (autoApprove) {
      await this.applyApprovedRevision(revision, user.id);
      void this.roles.checkPromotion(user.id).catch(() => undefined);
    }

    return {
      characterId,
      revisionId: revision.id,
      status: revision.status,
      isPatrolled: revision.isPatrolled,
      appliedToCharacter: autoApprove,
    };
  }

  async requestLifecycle(
    characterId: string,
    user: AuthenticatedUser,
    operation: 'soft_delete' | 'restore',
    reason?: string | null,
  ): Promise<SubmitEditResult> {
    await this.blocks.assertCanEdit(user, characterId);
    const page = await this.pages.getOrInitPage(characterId);
    this.assertProtection(page.protectionLevel, user.role);
    const character = await this.characterRepo.findOne({ where: { id: characterId } });
    if (!character) throw new BadRequestException('角色不存在');
    const currentRevision = page.currentRevisionId
      ? await this.revisionRepo.findOne({ where: { id: page.currentRevisionId } })
      : null;
    const factorySnapshot = await this.blueprints.getFactorySnapshot(characterId);
    const recipe =
      currentRevision?.recipeSnapshot ??
      factorySnapshot.blueprint.publishedRecipe ??
      factorySnapshot.blueprint.draftRecipe;
    const content =
      currentRevision?.contentSnapshot ??
      snapshotFromCharacter(character as unknown as Record<string, unknown>);
    const autoApprove = rankOf(user.role) >= rankOf('patroller');
    const lastVersion = await this.getLastVersion(characterId);
    const revision = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(CharacterRevisionEntity, {
        characterId,
        version: lastVersion + 1,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: page.currentRevisionId ?? null,
        contentSnapshot: content,
        recipeSnapshot: recipe,
        diffFromParent: { changed: [operation === 'soft_delete' ? '__delete__' : '__restore__'] },
        editorUserId: user.id,
        editorRoleAtTime: user.role,
        editSummary: (reason ?? (operation === 'soft_delete' ? '申请删除词条' : '申请恢复词条')).slice(0, 500),
        status: autoApprove ? 'approved' : 'pending',
        revisionKind: 'lifecycle',
        operation,
        riskLevel: 'high',
        changeSource: 'edit',
        isMinor: false,
        isPatrolled: false,
      });
      const saved = await manager.save(created);
      if (!autoApprove) {
        await manager.save(
          manager.create(EditSubmissionEntity, {
            revisionId: saved.id,
            characterId,
            submitterId: user.id,
            operation,
            riskLevel: 'high',
            decision: null,
            priority: 20,
          }),
        );
      }
      await manager.update(
        CharacterPageEntity,
        { characterId },
        { editCount: page.editCount + 1 },
      );
      await this.bumpProfile(manager, user.id, autoApprove);
      return saved;
    });

    if (autoApprove) {
      await this.applyApprovedRevision(revision, user.id);
      void this.roles.checkPromotion(user.id).catch(() => undefined);
    }

    return {
      revisionId: revision.id,
      status: revision.status,
      isPatrolled: revision.isPatrolled,
      appliedToCharacter: autoApprove,
    };
  }

  async applyApprovedRevision(
    revision: CharacterRevisionEntity,
    actorId: string,
  ): Promise<void> {
    if (revision.operation === 'create') {
      if (!revision.recipeSnapshot) {
        throw new BadRequestException('创建角色缺少 recipeSnapshot');
      }
      const existing = await this.characterRepo.findOne({
        where: { id: revision.characterId },
      });
      if (!existing) {
        await this.blueprints.createCharacterFromRecipe({
          id: revision.characterId,
          sourceType: 'wiki_contributed',
          deletionPolicy: 'archive_allowed',
          recipe: revision.recipeSnapshot,
        });
      }
      await this.pageRepo.update(
        { characterId: revision.characterId },
        {
          title: revision.contentSnapshot.name,
          currentRevisionId: revision.id,
          lifecycleStatus: 'active',
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      );
      return;
    }

    if (revision.operation === 'soft_delete') {
      await this.pageRepo.update(
        { characterId: revision.characterId },
        {
          currentRevisionId: revision.id,
          lifecycleStatus: 'deleted',
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: actorId,
        },
      );
      return;
    }

    if (revision.operation === 'restore') {
      await this.pageRepo.update(
        { characterId: revision.characterId },
        {
          currentRevisionId: revision.id,
          lifecycleStatus: 'active',
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      );
    }

    if (revision.recipeSnapshot) {
      await this.blueprints.updateDraft(revision.characterId, revision.recipeSnapshot);
      await this.blueprints.publish(
        revision.characterId,
        `Wiki ${revision.operation}: ${revision.editSummary}`,
      );
      await this.pageRepo.update(
        { characterId: revision.characterId },
        {
          title: revision.contentSnapshot.name,
          currentRevisionId: revision.id,
          lifecycleStatus: 'active',
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      );
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      await this.applySnapshotToCharacter(
        manager,
        revision.characterId,
        revision.contentSnapshot,
      );
      await manager.update(
        CharacterPageEntity,
        { characterId: revision.characterId },
        {
          title: revision.contentSnapshot.name,
          currentRevisionId: revision.id,
          lifecycleStatus: 'active',
        },
      );
    });
  }

  private async submitRecipeEdit(
    characterId: string,
    user: AuthenticatedUser,
    input: SubmitEditInput,
  ): Promise<SubmitEditResult> {
    await this.blocks.assertCanEdit(user, characterId);
    const page = await this.pages.getOrInitPage(characterId);
    if (page.isDeleted) {
      throw new ForbiddenException('该词条已被删除，无法编辑');
    }
    this.assertProtection(page.protectionLevel, user.role);
    const character = await this.characterRepo.findOne({ where: { id: characterId } });
    if (!character) throw new BadRequestException('角色不存在');
    const currentRevision = page.currentRevisionId
      ? await this.revisionRepo.findOne({ where: { id: page.currentRevisionId } })
      : null;
    const factorySnapshot = await this.blueprints.getFactorySnapshot(characterId);
    const beforeRecipe =
      currentRevision?.recipeSnapshot ??
      factorySnapshot.blueprint.publishedRecipe ??
      factorySnapshot.blueprint.draftRecipe;
    const afterRecipe = normalizeWikiRecipe(input.recipeSnapshot ?? {}, beforeRecipe);
    const beforeContent =
      currentRevision?.contentSnapshot ??
      snapshotFromCharacter(character as unknown as Record<string, unknown>);
    const afterContent = snapshotFromRecipe(afterRecipe);
    const changed = diffPaths(beforeRecipe, afterRecipe);
    if (changed.length === 0) {
      throw new BadRequestException('未检测到变更');
    }

    if (
      input.baseRevisionId &&
      page.currentRevisionId &&
      input.baseRevisionId !== page.currentRevisionId
    ) {
      const baseRev = await this.revisionRepo.findOne({
        where: { id: input.baseRevisionId },
      });
      if (!baseRev?.recipeSnapshot) {
        throw new BadRequestException('基线版本无效');
      }
      const concurrentChanged = diffPaths(baseRev.recipeSnapshot, beforeRecipe);
      const overlap = changed.filter((path) => concurrentChanged.includes(path));
      if (overlap.length > 0) {
        throw new ConflictException({
          message: '存在编辑冲突，请基于最新版本重新提交',
          conflictingFields: overlap,
          currentRevisionId: page.currentRevisionId,
          currentSnapshot: beforeContent,
          currentRecipeSnapshot: beforeRecipe,
        });
      }
    }

    const riskLevel = isHighRiskRecipeChange(changed) ? 'high' : 'low';
    const autoApprove =
      rankOf(user.role) >= rankOf('patroller') ||
      (riskLevel === 'low' && rankOf(user.role) >= rankOf('autoconfirmed'));
    const lastVersion = await this.getLastVersion(characterId);
    const revision = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(CharacterRevisionEntity, {
        characterId,
        version: lastVersion + 1,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: input.baseRevisionId ?? page.currentRevisionId ?? null,
        contentSnapshot: afterContent,
        recipeSnapshot: afterRecipe,
        diffFromParent: { changed },
        editorUserId: user.id,
        editorRoleAtTime: user.role,
        editSummary: (input.editSummary ?? '').slice(0, 500),
        status: autoApprove ? 'approved' : 'pending',
        revisionKind: 'recipe',
        operation: 'edit',
        riskLevel,
        changeSource: 'edit',
        isMinor: Boolean(input.isMinor),
        isPatrolled: false,
      });
      const saved = await manager.save(created);
      if (!autoApprove) {
        await manager.save(
          manager.create(EditSubmissionEntity, {
            revisionId: saved.id,
            characterId,
            submitterId: user.id,
            operation: 'edit',
            riskLevel,
            decision: null,
            priority: riskLevel === 'high' ? 5 : 0,
          }),
        );
      }
      await manager.update(
        CharacterPageEntity,
        { characterId },
        {
          title: afterContent.name,
          editCount: page.editCount + 1,
        },
      );
      await this.bumpProfile(manager, user.id, autoApprove);
      return saved;
    });

    if (autoApprove) {
      await this.applyApprovedRevision(revision, user.id);
      void this.roles.checkPromotion(user.id).catch(() => undefined);
    }

    return {
      revisionId: revision.id,
      status: revision.status,
      isPatrolled: revision.isPatrolled,
      appliedToCharacter: autoApprove,
    };
  }

  async applySnapshotToCharacter(
    manager: EntityManager,
    characterId: string,
    snapshot: WikiContentSnapshot,
  ): Promise<void> {
    const patch: Partial<CharacterEntity> = {};
    for (const key of WIKI_CONTENT_FIELDS) {
      const value = snapshot[key];
      if (value !== undefined) {
        (patch as Record<string, unknown>)[key] = value;
      }
    }
    await manager.update(CharacterEntity, { id: characterId }, patch);
  }

  private async getLastVersion(characterId: string): Promise<number> {
    const lastVersion = await this.revisionRepo
      .createQueryBuilder('r')
      .where('r.characterId = :id', { id: characterId })
      .select('MAX(r.version)', 'max')
      .getRawOne<{ max: number | null }>();
    return lastVersion?.max ?? 0;
  }

  private async bumpProfile(
    manager: EntityManager,
    userId: string,
    approved: boolean,
  ): Promise<void> {
    const profile =
      (await manager.findOne(UserWikiProfileEntity, {
        where: { userId },
      })) ??
      manager.create(UserWikiProfileEntity, {
        userId,
        editCount: 0,
        approvedEditCount: 0,
        revertedCount: 0,
        patrolledCount: 0,
      });
    profile.editCount += 1;
    profile.lastEditAt = new Date();
    if (approved) profile.approvedEditCount += 1;
    await manager.save(profile);
  }

  private resolveNewCharacterId(input?: string | null): string {
    const normalized = input
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    if (normalized) {
      return normalized.startsWith('char_') || normalized.startsWith('char-')
        ? normalized
        : `char_wiki_${normalized}`;
    }
    return `char_wiki_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }

  private assertProtection(level: string, role: string): void {
    if (level === 'full' && rankOf(role) < rankOf('admin')) {
      throw new ForbiddenException('此页面被完全保护，仅管理员可编辑');
    }
    if (level === 'semi' && rankOf(role) < rankOf('autoconfirmed')) {
      throw new ForbiddenException('此页面被半保护，仅自动确认用户及以上可编辑');
    }
  }
}
