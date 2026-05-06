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
import { AbuseFilterService } from './abuse-filter.service';
import { WikiBlockService } from './wiki-block.service';
import { WikiFieldProtectionService } from './wiki-field-protection.service';
import { WikiPageService } from './wiki-page.service';
import { WikiRoleService } from './wiki-role.service';
import {
  WIKI_CONTENT_FIELDS,
  assertWikiEditSummary,
  createDefaultWikiRecipe,
  diffFields,
  diffPaths,
  hasPathOverlap,
  isHighRiskRecipeChange,
  mergeContentSnapshot,
  mergeValueByPaths,
  normalizeWikiRecipe,
  pickWikiContent,
  resolveMinorEdit as resolveMinorEditPure,
  snapshotFromRecipe,
  snapshotFromCharacter,
} from '../wiki.types';
import { WIKI_ROLE_RANK } from '../guards/wiki-role.guard';

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
  warnings?: string[];
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
    private readonly filters: AbuseFilterService,
    private readonly fieldProtection: WikiFieldProtectionService,
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

    // Reject malformed bodies that would silently blank fields. Missing keys
    // in the patch fall back to `before`; explicit empty values stay through
    // (so users can clear e.g. avatar), but `name` must remain non-empty.
    const rawPatch =
      input.contentSnapshot && typeof input.contentSnapshot === 'object'
        ? input.contentSnapshot
        : null;
    if (!rawPatch) {
      throw new BadRequestException('contentSnapshot 必须为对象');
    }
    const presentKeys = WIKI_CONTENT_FIELDS.filter((field) => field in rawPatch);
    if (presentKeys.length === 0) {
      throw new BadRequestException(
        'contentSnapshot 至少需提交一个内容字段（name/avatar/bio/personality/expertDomains/triggerScenes/relationship/relationshipType）',
      );
    }
    const submittedPick = pickWikiContent(rawPatch);
    const submitted: WikiContentSnapshot = {
      ...before,
      schemaVersion: submittedPick.schemaVersion,
    };
    for (const field of presentKeys) {
      (submitted as Record<string, unknown>)[field] = (
        submittedPick as Record<string, unknown>
      )[field];
    }
    if (!submitted.name.trim()) {
      throw new BadRequestException('name 不能为空');
    }
    let after = submitted;
    let changed = diffFields(before, after);
    let changeSource = 'edit';

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
      const userChanged = diffFields(baseRev.contentSnapshot, submitted);
      const concurrentChanged = diffFields(baseRev.contentSnapshot, before);
      const overlap = userChanged.filter((f) => concurrentChanged.includes(f));
      if (overlap.length > 0) {
        throw new ConflictException({
          message: '存在编辑冲突，请基于最新版本重新提交',
          conflictingFields: overlap,
          currentRevisionId: page.currentRevisionId,
          currentSnapshot: before,
        });
      }
      after = mergeContentSnapshot(before, submitted, userChanged);
      changed = diffFields(before, after);
      changeSource = 'merge';
    }

    if (changed.length === 0) {
      throw new BadRequestException('未检测到变更');
    }

    this.assertEditSummary({
      operation: 'edit',
      riskLevel: 'low',
      revisionKind: 'content',
      summary: input.editSummary,
    });

    const abuse = await this.filters.check({
      user,
      characterId,
      contentSnapshot: after,
      beforeContent: before,
      operation: 'edit',
    });

    let autoApprove = rankOf(user.role) >= rankOf('autoconfirmed');
    if (abuse.action === 'tag_high_risk') {
      autoApprove = false;
    }
    const lastVersion = await this.revisionRepo
      .createQueryBuilder('r')
      .where('r.characterId = :id', { id: characterId })
      .select('MAX(r.version)', 'max')
      .getRawOne<{ max: number | null }>();
    const nextVersion = (lastVersion?.max ?? 0) + 1;

    const result = await this.dataSource.transaction(async (manager) => {
      const contentRiskLevel =
        abuse.action === 'tag_high_risk' ? 'high' : 'low';
      const contentDiff: Record<string, unknown> = { changed };
      if (abuse.hits.length > 0) {
        contentDiff.abuseFilterHits = abuse.hits.map((h) => h.filterName);
      }
      const revision = manager.create(CharacterRevisionEntity, {
        characterId,
        version: nextVersion,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: input.baseRevisionId ?? page.currentRevisionId ?? null,
        contentSnapshot: after,
        diffFromParent: contentDiff,
        editorUserId: user.id,
        editorRoleAtTime: user.role,
        editSummary: (input.editSummary ?? '').slice(0, 500),
        status: autoApprove ? 'approved' : 'pending',
        revisionKind: 'content',
        operation: 'edit',
        riskLevel: contentRiskLevel,
        changeSource,
        isMinor: this.resolveMinorEdit(input.isMinor, user.role),
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
            latestRevisionId: savedRev.id,
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
          { latestRevisionId: savedRev.id, editCount: page.editCount + 1 },
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
      warnings: abuse.warnings.length > 0 ? abuse.warnings : undefined,
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
    this.assertEditSummary({
      operation: 'create',
      riskLevel: 'high',
      revisionKind: 'recipe',
      summary: input.editSummary,
    });
    const abuseCreate = await this.filters.check({
      user,
      characterId,
      contentSnapshot: content,
      recipeSnapshot: recipe,
      operation: 'create',
      isCreate: true,
    });
    // tag_high_risk on create is a no-op (create is already high-risk &
    // patroller-only); but persist hits for visibility.
    const autoApprove = rankOf(user.role) >= rankOf('patroller');
    const revision = await this.dataSource.transaction(async (manager) => {
      const page =
        existingPage ??
        manager.create(CharacterPageEntity, {
          characterId,
          title: content.name,
          currentRevisionId: null,
          latestRevisionId: null,
          lifecycleStatus: 'pending_create',
          reviewPolicy: 'open',
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
      await manager.update(
        CharacterPageEntity,
        { characterId },
        {
          currentRevisionId: autoApprove ? saved.id : null,
          latestRevisionId: saved.id,
          title: content.name,
          lifecycleStatus: autoApprove ? 'active' : 'pending_create',
        },
      );
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
      warnings: abuseCreate.warnings.length > 0 ? abuseCreate.warnings : undefined,
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
    this.assertEditSummary({
      operation,
      riskLevel: 'high',
      revisionKind: 'lifecycle',
      summary: reason,
    });
    const abuseLifecycle = await this.filters.check({
      user,
      characterId,
      contentSnapshot: { name: '', avatar: '', bio: reason ?? '', expertDomains: [], relationship: '', relationshipType: '' } as WikiContentSnapshot,
      operation,
    });
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
        { latestRevisionId: saved.id, editCount: page.editCount + 1 },
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
      warnings:
        abuseLifecycle.warnings.length > 0
          ? abuseLifecycle.warnings
          : undefined,
    };
  }

  /**
   * 把 character 当前态（含 admin 后台直改产生的漂移）作为新 revision 写入 wiki，
   * 自动 approved + patrolled，changeSource='admin_override'。仅 patroller+ 可调。
   * 用于消除"admin 直改 → wiki 显示与实际不一致"的漂移横幅。
   */
  async syncFromCharacter(
    characterId: string,
    actor: AuthenticatedUser,
  ): Promise<SubmitEditResult> {
    if (rankOf(actor.role) < rankOf('patroller')) {
      throw new ForbiddenException('仅巡查员及以上可触发漂移同步');
    }
    const page = await this.pages.getOrInitPage(characterId);
    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    if (!character) throw new BadRequestException('角色不存在');
    const liveContent = snapshotFromCharacter(
      character as unknown as Record<string, unknown>,
    );
    const factorySnapshot = await this.blueprints.getFactorySnapshot(characterId);
    const liveRecipe =
      factorySnapshot.blueprint.publishedRecipe ??
      factorySnapshot.blueprint.draftRecipe ??
      null;
    const lastVersion = await this.getLastVersion(characterId);
    const saved = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(CharacterRevisionEntity, {
        characterId,
        version: lastVersion + 1,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: page.currentRevisionId ?? null,
        contentSnapshot: liveContent,
        recipeSnapshot: liveRecipe,
        diffFromParent: { changed: ['__sync_from_character__'] },
        editorUserId: actor.id,
        editorRoleAtTime: actor.role,
        editSummary: '同步管理员直改的角色字段到 wiki 历史',
        status: 'approved',
        revisionKind: liveRecipe ? 'recipe' : 'content',
        operation: 'edit',
        riskLevel: 'low',
        changeSource: 'admin_override',
        isMinor: false,
        isPatrolled: true,
        patrolledBy: actor.id,
        patrolledAt: new Date(),
      });
      const savedRev = await manager.save(created);
      await manager.update(
        CharacterPageEntity,
        { characterId },
        {
          title: liveContent.name,
          currentRevisionId: savedRev.id,
          latestRevisionId: savedRev.id,
          editCount: page.editCount + 1,
        },
      );
      return savedRev;
    });
    return {
      revisionId: saved.id,
      status: saved.status,
      isPatrolled: saved.isPatrolled,
      appliedToCharacter: false, // already on character; this just records history
    };
  }

  async applyApprovedRevision(
    revision: CharacterRevisionEntity,
    actorId: string,
  ): Promise<void> {
    const latestRevisionId = await this.resolveLatestRevisionId(revision);
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
          latestRevisionId,
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
          latestRevisionId,
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
          latestRevisionId,
          lifecycleStatus: 'active',
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      );
      return;
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
          latestRevisionId,
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
          latestRevisionId,
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
    let afterRecipe = normalizeWikiRecipe(input.recipeSnapshot ?? {}, beforeRecipe);
    const beforeContent =
      currentRevision?.contentSnapshot ??
      snapshotFromCharacter(character as unknown as Record<string, unknown>);
    let changed = diffPaths(beforeRecipe, afterRecipe);
    let changeSource = 'edit';

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
      const submittedRecipe = normalizeWikiRecipe(
        input.recipeSnapshot ?? {},
        baseRev.recipeSnapshot,
      );
      const userChanged = diffPaths(baseRev.recipeSnapshot, submittedRecipe);
      const concurrentChanged = diffPaths(baseRev.recipeSnapshot, beforeRecipe);
      const overlap = userChanged.filter((path) =>
        hasPathOverlap([path], concurrentChanged),
      );
      if (overlap.length > 0) {
        throw new ConflictException({
          message: '存在编辑冲突，请基于最新版本重新提交',
          conflictingFields: overlap,
          currentRevisionId: page.currentRevisionId,
          currentSnapshot: beforeContent,
          currentRecipeSnapshot: beforeRecipe,
        });
      }
      afterRecipe = mergeValueByPaths(beforeRecipe, submittedRecipe, userChanged);
      changed = diffPaths(beforeRecipe, afterRecipe);
      changeSource = 'merge';
    }

    if (changed.length === 0) {
      throw new BadRequestException('未检测到变更');
    }
    await this.fieldProtection.assertCanEditPaths(user, characterId, changed);
    const afterContent = snapshotFromRecipe(afterRecipe);

    const riskReport = isHighRiskRecipeChange(changed);
    let riskLevel = riskReport.highRisk ? 'high' : 'low';
    this.assertEditSummary({
      operation: 'edit',
      riskLevel,
      revisionKind: 'recipe',
      summary: input.editSummary,
    });
    const abuseRecipe = await this.filters.check({
      user,
      characterId,
      contentSnapshot: afterContent,
      recipeSnapshot: afterRecipe,
      beforeContent,
      beforeRecipe,
      operation: 'edit',
    });
    if (abuseRecipe.action === 'tag_high_risk') {
      riskLevel = 'high';
    }
    const autoApprove =
      abuseRecipe.action === 'tag_high_risk'
        ? false
        : rankOf(user.role) >= rankOf('patroller') ||
          (riskLevel === 'low' && rankOf(user.role) >= rankOf('autoconfirmed'));
    const lastVersion = await this.getLastVersion(characterId);
    const revision = await this.dataSource.transaction(async (manager) => {
      const recipeDiff: Record<string, unknown> = { changed };
      if (riskReport.highRisk) {
        recipeDiff.highRiskReasons = riskReport.reasons;
      }
      if (abuseRecipe.hits.length > 0) {
        recipeDiff.abuseFilterHits = abuseRecipe.hits.map((h) => h.filterName);
      }
      const created = manager.create(CharacterRevisionEntity, {
        characterId,
        version: lastVersion + 1,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: input.baseRevisionId ?? page.currentRevisionId ?? null,
        contentSnapshot: afterContent,
        recipeSnapshot: afterRecipe,
        diffFromParent: recipeDiff,
        editorUserId: user.id,
        editorRoleAtTime: user.role,
        editSummary: (input.editSummary ?? '').slice(0, 500),
        status: autoApprove ? 'approved' : 'pending',
        revisionKind: 'recipe',
        operation: 'edit',
        riskLevel,
        changeSource,
        isMinor: this.resolveMinorEdit(input.isMinor, user.role),
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
          latestRevisionId: saved.id,
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
      warnings:
        abuseRecipe.warnings.length > 0 ? abuseRecipe.warnings : undefined,
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

  private async resolveLatestRevisionId(
    revision: CharacterRevisionEntity,
  ): Promise<string> {
    const page = await this.pageRepo.findOne({
      where: { characterId: revision.characterId },
    });
    if (!page?.latestRevisionId || page.latestRevisionId === revision.id) {
      return revision.id;
    }
    const latest = await this.revisionRepo.findOne({
      where: { id: page.latestRevisionId },
    });
    return latest && latest.version > revision.version
      ? page.latestRevisionId
      : revision.id;
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

  private assertEditSummary(input: {
    operation: string;
    riskLevel: string;
    revisionKind: string;
    summary: string | null | undefined;
  }): void {
    assertWikiEditSummary(input);
  }

  private resolveMinorEdit(input: boolean | undefined, role: string): boolean {
    return resolveMinorEditPure(
      input,
      rankOf(role),
      WIKI_ROLE_RANK.autoconfirmed,
    );
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
