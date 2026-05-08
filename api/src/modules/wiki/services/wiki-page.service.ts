import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterEntity } from '../../characters/character.entity';
import { CharacterBlueprintService } from '../../characters/character-blueprint.service';
import type { CharacterBlueprintRecipeValue } from '../../characters/character-blueprint.types';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { CharacterPageEntity } from '../entities/character-page.entity';
import {
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
  CharacterRevisionEntity,
  type WikiContentSnapshot,
} from '../entities/character-revision.entity';
import { rankOf } from '../guards/wiki-role.guard';
import {
  WIKI_CONTENT_FIELDS,
  type WikiContentField,
  diffPaths,
  snapshotFromCharacter,
} from '../wiki.types';

export type DriftReport = {
  hasDrift: boolean;
  contentDrift: WikiContentField[];
  recipeDrift: string[];
  source: 'admin_override' | 'unknown' | 'none';
};

export type WikiPageView = {
  characterId: string;
  page: CharacterPageEntity;
  currentRevision: CharacterRevisionEntity | null;
  stableRevision: CharacterRevisionEntity | null;
  latestRevision: CharacterRevisionEntity | null;
  content: WikiContentSnapshot;
  visibleContent: WikiContentSnapshot;
  recipe: CharacterBlueprintRecipeValue | null;
  pendingRevision: CharacterRevisionEntity | null;
  pendingRevisions: CharacterRevisionEntity[];
  viewMode: 'stable' | 'current';
  viewerCanSeeCurrent: boolean;
  drift: DriftReport;
  exists: boolean;
};

@Injectable()
export class WikiPageService {
  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characterRepo: Repository<CharacterEntity>,
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
    private readonly blueprints: CharacterBlueprintService,
  ) {}

  async getOrInitPage(characterId: string): Promise<CharacterPageEntity> {
    let page = await this.pageRepo.findOne({ where: { characterId } });
    if (page) return page;
    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    if (!character) {
      throw new NotFoundException(`角色 ${characterId} 不存在`);
    }
    page = this.pageRepo.create({
      characterId,
      title: character.name,
      currentRevisionId: null,
      latestRevisionId: null,
      lifecycleStatus: 'active',
      reviewPolicy: 'open',
      protectionLevel: character.sourceType === 'ai_generated' ? 'semi' : 'none',
      isPatrolled: false,
      watcherCount: 0,
      editCount: 0,
      isDeleted: false,
    });
    return this.pageRepo.save(page);
  }

  async getPageView(
    characterId: string,
    input: { view?: 'stable' | 'current'; user?: AuthenticatedUser } = {},
  ): Promise<WikiPageView> {
    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    const existingPage = await this.pageRepo.findOne({ where: { characterId } });
    if (!character && !existingPage) {
      throw new NotFoundException(`角色 ${characterId} 不存在`);
    }
    const page = character ? await this.getOrInitPage(characterId) : existingPage!;
    let stableRevision: CharacterRevisionEntity | null = null;
    if (page.currentRevisionId) {
      stableRevision = await this.revisionRepo.findOne({
        where: { id: page.currentRevisionId },
      });
    }
    let latestRevision: CharacterRevisionEntity | null = null;
    if (page.latestRevisionId) {
      latestRevision = await this.revisionRepo.findOne({
        where: { id: page.latestRevisionId },
      });
    }
    const pendingRevisions = await this.revisionRepo.find({
      where: { characterId, status: 'pending' },
      order: { version: 'DESC' },
      take: 50,
    });
    const pendingRevision = pendingRevisions[0] ?? null;
    if (!latestRevision) {
      latestRevision = pendingRevision ?? stableRevision;
    }
    const factorySnapshot = character
      ? await this.blueprints.getFactorySnapshot(characterId).catch(() => null)
      : null;
    const canViewCurrent =
      rankOf(input.user?.role) >= rankOf('autoconfirmed');
    const viewMode =
      input.view === 'current' && canViewCurrent ? 'current' : 'stable';
    const visibleRevision =
      viewMode === 'current' ? latestRevision ?? stableRevision : stableRevision;
    const recipe =
      visibleRevision?.recipeSnapshot ??
      factorySnapshot?.blueprint.publishedRecipe ??
      factorySnapshot?.blueprint.draftRecipe ??
      pendingRevision?.recipeSnapshot ??
      null;
    const content = visibleRevision
      ? visibleRevision.contentSnapshot
      : character
        ? snapshotFromCharacter(character as unknown as Record<string, unknown>)
        : pendingRevision?.contentSnapshot;
    if (!content) {
      throw new NotFoundException(`角色 ${characterId} 不存在`);
    }
    const drift = await this.computeDrift(
      character,
      stableRevision,
      factorySnapshot?.blueprint.publishedRecipe ?? null,
    );

    return {
      characterId,
      page,
      currentRevision: visibleRevision,
      stableRevision,
      latestRevision,
      content,
      visibleContent: content,
      recipe,
      pendingRevision,
      pendingRevisions,
      viewMode,
      viewerCanSeeCurrent: canViewCurrent,
      drift,
      exists: !page.isDeleted && page.lifecycleStatus !== 'pending_create',
    };
  }

  /**
   * Compares the live `character` row + published blueprint recipe to the
   * latest stable revision's snapshots. Drift = admin (or any non-wiki path)
   * touched the runtime state without going through wiki review.
   */
  private async computeDrift(
    character: CharacterEntity | null,
    stableRevision: CharacterRevisionEntity | null,
    publishedRecipe: CharacterBlueprintRecipeValue | null,
  ): Promise<DriftReport> {
    if (!character || !stableRevision) {
      return { hasDrift: false, contentDrift: [], recipeDrift: [], source: 'none' };
    }
    const liveContent = snapshotFromCharacter(
      character as unknown as Record<string, unknown>,
    );
    const contentDrift: WikiContentField[] = [];
    for (const field of WIKI_CONTENT_FIELDS) {
      const a = JSON.stringify(liveContent[field] ?? null);
      const b = JSON.stringify(stableRevision.contentSnapshot[field] ?? null);
      if (a !== b) contentDrift.push(field);
    }
    let recipeDrift: string[] = [];
    if (stableRevision.recipeSnapshot && publishedRecipe) {
      recipeDrift = diffPaths(stableRevision.recipeSnapshot, publishedRecipe);
    }
    const hasDrift = contentDrift.length > 0 || recipeDrift.length > 0;
    return {
      hasDrift,
      contentDrift,
      recipeDrift,
      source: hasDrift ? 'admin_override' : 'none',
    };
  }

  async listPages(): Promise<
    Array<{
      id: string;
      name: string;
      avatar: string;
      bio: string;
      relationship: string;
      relationshipType: string;
      sourceType: string;
      lifecycleStatus: string;
      protectionLevel: string;
    }>
  > {
    const characters = await this.characterRepo.find({ order: { name: 'ASC' } });
    const pages = await this.pageRepo.find();
    const pendingRevisions = await this.revisionRepo.find({
      where: { operation: 'create', status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    const pageMap = new Map(pages.map((page) => [page.characterId, page]));
    const rows = characters
      .filter((character) => {
        const page = pageMap.get(character.id);
        return !page?.isDeleted && page?.lifecycleStatus !== 'deleted';
      })
      .map((character) => {
        const page = pageMap.get(character.id);
        return {
          id: character.id,
          name: character.name,
          avatar: character.avatar,
          bio: character.bio,
          relationship: character.relationship,
          relationshipType: character.relationshipType,
          sourceType: character.sourceType,
          lifecycleStatus: page?.lifecycleStatus ?? 'active',
          protectionLevel: page?.protectionLevel ?? 'none',
        };
      });
    const existingIds = new Set(rows.map((row) => row.id));
    for (const revision of pendingRevisions) {
      if (existingIds.has(revision.characterId)) continue;
      rows.push({
        id: revision.characterId,
        name: revision.contentSnapshot.name,
        avatar: revision.contentSnapshot.avatar,
        bio: revision.contentSnapshot.bio,
        relationship: revision.contentSnapshot.relationship,
        relationshipType: revision.contentSnapshot.relationshipType,
        sourceType: 'wiki_contributed',
        lifecycleStatus: 'pending_create',
        protectionLevel: pageMap.get(revision.characterId)?.protectionLevel ?? 'none',
      });
      existingIds.add(revision.characterId);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }

  async getHistory(
    characterId: string,
    limit = 50,
  ): Promise<CharacterRevisionEntity[]> {
    return this.revisionRepo.find({
      where: { characterId },
      order: { version: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async getRevisionOrThrow(id: string): Promise<CharacterRevisionEntity> {
    const rev = await this.revisionRepo.findOne({ where: { id } });
    if (!rev) throw new NotFoundException(`版本 ${id} 不存在`);
    return rev;
  }

  async listRecentChanges(input: {
    limit?: number;
    onlyUnpatrolled?: boolean;
  }): Promise<CharacterRevisionEntity[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const qb = this.revisionRepo
      .createQueryBuilder('r')
      .leftJoin(
        CharacterPageEntity,
        'p',
        'p.characterId = r.characterId',
      )
      .where(
        '((p.isDeleted = 0 OR p.isDeleted IS NULL) OR r.operation IN (:...lifecycleOps))',
        { lifecycleOps: ['soft_delete', 'restore'] },
      )
      .orderBy('r.createdAt', 'DESC')
      .take(limit);
    if (input.onlyUnpatrolled) {
      qb.andWhere('r.status = :status AND r.isPatrolled = :patrolled', {
        status: 'approved',
        patrolled: false,
      });
    } else {
      qb.andWhere('r.status IN (:...statuses)', {
        statuses: ['approved', 'pending', 'reverted'],
      });
    }
    return qb.getMany();
  }

  async getPending(characterId: string): Promise<CharacterRevisionEntity[]> {
    return this.revisionRepo.find({
      where: { characterId, status: 'pending' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getDiff(characterId: string, fromId: string, toId: string) {
    const [from, to] = await Promise.all([
      this.getRevisionOrThrow(fromId),
      this.getRevisionOrThrow(toId),
    ]);
    if (from.characterId !== to.characterId) {
      throw new NotFoundException('版本不属于同一词条');
    }
    if (characterId !== '_' && to.characterId !== characterId) {
      throw new NotFoundException('版本不属于当前词条');
    }
    return { from, to };
  }

  async search(query: string, limit = 20): Promise<
    Array<{
      characterId: string;
      name: string;
      bio: string;
      relationship: string;
      score: number;
    }>
  > {
    const q = query.trim();
    if (!q) return [];
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const rows = await this.characterRepo
      .createQueryBuilder('c')
      .leftJoin(
        CharacterPageEntity,
        'p',
        'p.characterId = c.id',
      )
      .where('(p.isDeleted = 0 OR p.isDeleted IS NULL)')
      .andWhere(
        '(c.name LIKE :like ESCAPE \'\\\\\' OR c.bio LIKE :like ESCAPE \'\\\\\' OR c.personality LIKE :like ESCAPE \'\\\\\' OR c.expertDomains LIKE :like ESCAPE \'\\\\\')',
        { like },
      )
      .select([
        'c.id AS id',
        'c.name AS name',
        'c.bio AS bio',
        'c.relationship AS relationship',
        'c.personality AS personality',
        'c.expertDomains AS expertDomains',
      ])
      .limit(Math.min(Math.max(limit, 1), 100))
      .getRawMany<{
        id: string;
        name: string;
        bio: string;
        relationship: string;
        personality: string | null;
        expertDomains: string;
      }>();

    const lower = q.toLowerCase();
    return rows
      .map((r) => {
        let score = 0;
        if (r.name?.toLowerCase().includes(lower)) score += 10;
        if (r.bio?.toLowerCase().includes(lower)) score += 3;
        if (r.personality?.toLowerCase().includes(lower)) score += 2;
        if (r.expertDomains?.toLowerCase().includes(lower)) score += 5;
        return {
          characterId: r.id,
          name: r.name,
          bio: r.bio,
          relationship: r.relationship,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  async setDeletedFlag(
    characterId: string,
    actorId: string,
    isDeleted: boolean,
  ): Promise<CharacterPageEntity> {
    const page = await this.getOrInitPage(characterId);
    if (page.isDeleted === isDeleted) return page;
    await this.pageRepo.update(
      { characterId },
      {
        isDeleted,
        lifecycleStatus: isDeleted ? 'deleted' : 'active',
        deletedAt: isDeleted ? new Date() : null,
        deletedBy: isDeleted ? actorId : null,
      },
    );
    return (await this.pageRepo.findOne({ where: { characterId } }))!;
  }
}
// i18n-ignore-end
