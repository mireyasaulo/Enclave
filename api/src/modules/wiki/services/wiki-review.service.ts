// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { CharacterPageEntity } from '../entities/character-page.entity';
import { CharacterRevisionEntity } from '../entities/character-revision.entity';
import { EditSubmissionEntity } from '../entities/edit-submission.entity';
import { UserWikiProfileEntity } from '../entities/user-wiki-profile.entity';
import { WikiEditService } from './wiki-edit.service';
import { WikiProtectionService } from './wiki-protection.service';
import { WikiRoleService } from './wiki-role.service';
import { WikiSystemUserService } from './wiki-system-user.service';
import { rankOf } from '../guards/wiki-role.guard';

export type ReviewDecisionInput = {
  decision: 'approve' | 'reject' | 'request_changes';
  note?: string;
};

@Injectable()
export class WikiReviewService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
    @InjectRepository(EditSubmissionEntity)
    private readonly submissionRepo: Repository<EditSubmissionEntity>,
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(UserWikiProfileEntity)
    private readonly profileRepo: Repository<UserWikiProfileEntity>,
    private readonly edits: WikiEditService,
    private readonly roles: WikiRoleService,
    private readonly protection: WikiProtectionService,
    private readonly systemUsers: WikiSystemUserService,
  ) {}

  async listPending(limit?: number): Promise<
    Array<{
      submission: EditSubmissionEntity;
      revision: CharacterRevisionEntity;
    }>
  >;
  async listPending(input?: {
    limit?: number;
    operation?: string;
    riskLevel?: string;
    revisionKind?: string;
  }): Promise<
    Array<{
      submission: EditSubmissionEntity;
      revision: CharacterRevisionEntity;
    }>
  >;
  async listPending(
    input:
      | number
      | {
          limit?: number;
          operation?: string;
          riskLevel?: string;
          revisionKind?: string;
        } = {},
  ): Promise<
    Array<{
      submission: EditSubmissionEntity;
      revision: CharacterRevisionEntity;
    }>
  > {
    const opts = typeof input === 'number' ? { limit: input } : input;
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .where('s.decision IS NULL')
      .orderBy('s.priority', 'DESC')
      .addOrderBy('s.createdAt', 'ASC')
      .take(opts.revisionKind ? 200 : limit);
    if (opts.operation) {
      qb.andWhere('s.operation = :operation', { operation: opts.operation });
    }
    if (opts.riskLevel) {
      qb.andWhere('s.riskLevel = :riskLevel', { riskLevel: opts.riskLevel });
    }
    const submissions = await qb.getMany();
    const revIds = submissions.map((s) => s.revisionId);
    if (revIds.length === 0) return [];
    const revisions = await this.revisionRepo
      .createQueryBuilder('r')
      .where('r.id IN (:...ids)', { ids: revIds })
      .andWhere('r.status = :status', { status: 'pending' })
      .getMany();
    const revMap = new Map(revisions.map((r) => [r.id, r]));
    return submissions
      .map((s) => ({ submission: s, revision: revMap.get(s.revisionId)! }))
      .filter((entry) => entry.revision)
      .filter(
        (entry) =>
          !opts.revisionKind || entry.revision.revisionKind === opts.revisionKind,
      )
      .slice(0, limit);
  }

  async decide(
    revisionId: string,
    reviewer: AuthenticatedUser,
    input: ReviewDecisionInput,
  ): Promise<{ status: string; pageId: string }> {
    if (!['approve', 'reject', 'request_changes'].includes(input.decision)) {
      throw new BadRequestException('无效的审核结果');
    }
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId },
    });
    if (!revision) throw new NotFoundException('版本不存在');
    if (revision.status !== 'pending') {
      throw new BadRequestException('该版本已被处理');
    }
    const submission = await this.submissionRepo.findOne({
      where: { revisionId },
    });
    if (!submission) throw new NotFoundException('待审记录不存在');

    const isApprove = input.decision === 'approve';
    const finalStatus = isApprove ? 'approved' : 'rejected';
    const applyWithWikiRuntime =
      isApprove &&
      (Boolean(revision.recipeSnapshot) ||
        revision.revisionKind !== 'content' ||
        revision.operation !== 'edit');

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        CharacterRevisionEntity,
        { id: revisionId },
        {
          status: finalStatus,
          isPatrolled: isApprove,
          patrolledBy: isApprove ? reviewer.id : null,
          patrolledAt: isApprove ? new Date() : null,
        },
      );
      await manager.update(
        EditSubmissionEntity,
        { id: submission.id },
        {
          decision: input.decision,
          reviewerId: reviewer.id,
          decidedAt: new Date(),
          reviewerNote: input.note ?? null,
        },
      );

      if (isApprove && !applyWithWikiRuntime) {
        await manager.update(
          CharacterPageEntity,
          { characterId: revision.characterId },
          {
            currentRevisionId: revision.id,
            title: revision.contentSnapshot.name,
            lifecycleStatus: 'active',
          },
        );
        await this.edits.applySnapshotToCharacter(
          manager,
          revision.characterId,
          revision.contentSnapshot,
        );
      }

      if (isApprove) {
        const profile =
          (await manager.findOne(UserWikiProfileEntity, {
            where: { userId: revision.editorUserId },
          })) ??
          manager.create(UserWikiProfileEntity, {
            userId: revision.editorUserId,
            editCount: 0,
            approvedEditCount: 0,
            revertedCount: 0,
            patrolledCount: 0,
          });
        profile.approvedEditCount += 1;
        await manager.save(profile);
      }

      if (isApprove) {
        const reviewerProfile =
          (await manager.findOne(UserWikiProfileEntity, {
            where: { userId: reviewer.id },
          })) ??
          manager.create(UserWikiProfileEntity, {
            userId: reviewer.id,
            editCount: 0,
            approvedEditCount: 0,
            revertedCount: 0,
            patrolledCount: 0,
          });
        reviewerProfile.patrolledCount += 1;
        await manager.save(reviewerProfile);
      }
    });

    if (applyWithWikiRuntime) {
      try {
        await this.edits.applyApprovedRevision(revision, reviewer.id);
      } catch (error) {
        await this.rollbackRuntimeApproval(revision, submission.id, reviewer.id);
        throw error;
      }
    }

    if (isApprove) {
      void this.roles.checkPromotion(revision.editorUserId).catch(() => undefined);
    }
    return { status: finalStatus, pageId: revision.characterId };
  }

  private async rollbackRuntimeApproval(
    revision: CharacterRevisionEntity,
    submissionId: string,
    reviewerId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        CharacterRevisionEntity,
        { id: revision.id },
        {
          status: 'pending',
          isPatrolled: false,
          patrolledBy: null,
          patrolledAt: null,
        },
      );
      await manager.update(
        EditSubmissionEntity,
        { id: submissionId },
        {
          decision: null,
          reviewerId: null,
          decidedAt: null,
          reviewerNote: null,
        },
      );

      const authorProfile = await manager.findOne(UserWikiProfileEntity, {
        where: { userId: revision.editorUserId },
      });
      if (authorProfile) {
        authorProfile.approvedEditCount = Math.max(
          0,
          authorProfile.approvedEditCount - 1,
        );
        await manager.save(authorProfile);
      }

      const reviewerProfile = await manager.findOne(UserWikiProfileEntity, {
        where: { userId: reviewerId },
      });
      if (reviewerProfile) {
        reviewerProfile.patrolledCount = Math.max(
          0,
          reviewerProfile.patrolledCount - 1,
        );
        await manager.save(reviewerProfile);
      }
    });
  }

  async markPatrolled(
    revisionId: string,
    reviewer: AuthenticatedUser,
  ): Promise<{ revisionId: string; isPatrolled: true }> {
    const revision = await this.revisionRepo.findOne({
      where: { id: revisionId },
    });
    if (!revision) throw new NotFoundException('版本不存在');
    if (revision.status !== 'approved') {
      throw new BadRequestException('仅 approved 状态的版本可被巡查');
    }
    if (revision.isPatrolled) {
      return { revisionId, isPatrolled: true };
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        CharacterRevisionEntity,
        { id: revisionId },
        {
          isPatrolled: true,
          patrolledBy: reviewer.id,
          patrolledAt: new Date(),
        },
      );
      const profile =
        (await manager.findOne(UserWikiProfileEntity, {
          where: { userId: reviewer.id },
        })) ??
        manager.create(UserWikiProfileEntity, {
          userId: reviewer.id,
          editCount: 0,
          approvedEditCount: 0,
          revertedCount: 0,
          patrolledCount: 0,
        });
      profile.patrolledCount += 1;
      await manager.save(profile);
    });
    return { revisionId, isPatrolled: true };
  }

  async revert(
    characterId: string,
    reviewer: AuthenticatedUser,
    input: { toRevisionId: string; reason: string },
  ): Promise<{ revisionId: string; version: number }> {
    if (!input.toRevisionId) {
      throw new BadRequestException('缺少 toRevisionId');
    }
    await this.assert3RR(characterId, reviewer);
    const target = await this.revisionRepo.findOne({
      where: { id: input.toRevisionId },
    });
    if (!target || target.characterId !== characterId) {
      throw new NotFoundException('目标版本不存在或不属于该词条');
    }
    if (target.status !== 'approved') {
      throw new BadRequestException('只能回滚到 approved 版本');
    }
    if (target.revisionKind === 'lifecycle') {
      throw new BadRequestException('生命周期版本请通过删除 / 恢复申请处理，不支持直接回滚');
    }
    const page = await this.pageRepo.findOne({ where: { characterId } });
    if (!page) throw new NotFoundException('词条不存在');
    if (page.currentRevisionId === target.id) {
      throw new BadRequestException('目标版本已是当前版本');
    }
    if (page.protectionLevel === 'full' && reviewer.role !== 'admin') {
      throw new ForbiddenException('该页面被完全保护，仅管理员可回滚');
    }

    const lastVersion = await this.revisionRepo
      .createQueryBuilder('r')
      .where('r.characterId = :id', { id: characterId })
      .select('MAX(r.version)', 'max')
      .getRawOne<{ max: number | null }>();
    const nextVersion = (lastVersion?.max ?? 0) + 1;

    const supersededRevs = await this.revisionRepo.find({
      where: {
        characterId,
        version: MoreThan(target.version),
        status: 'approved',
      },
    });

    const newRev = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(CharacterRevisionEntity, {
        characterId,
        version: nextVersion,
        parentRevisionId: page.currentRevisionId ?? null,
        baseRevisionId: page.currentRevisionId ?? null,
        contentSnapshot: target.contentSnapshot,
        recipeSnapshot: target.recipeSnapshot ?? null,
        diffFromParent: { changed: ['__revert__'], revertTo: target.version },
        editorUserId: reviewer.id,
        editorRoleAtTime: reviewer.role,
        editSummary: `Revert to v${target.version}: ${input.reason ?? ''}`.slice(0, 500),
        status: 'approved',
        revisionKind: target.recipeSnapshot ? 'recipe' : 'content',
        operation: 'revert',
        riskLevel: target.recipeSnapshot ? 'high' : 'low',
        changeSource: 'revert',
        isMinor: false,
        isPatrolled: true,
        patrolledBy: reviewer.id,
        patrolledAt: new Date(),
      });
      const saved = await manager.save(created);

      await manager.update(
        CharacterPageEntity,
        { characterId },
        {
          currentRevisionId: saved.id,
          title: target.contentSnapshot.name,
          lifecycleStatus: 'active',
          editCount: page.editCount + 1,
        },
      );
      if (!target.recipeSnapshot) {
        await this.edits.applySnapshotToCharacter(
          manager,
          characterId,
          target.contentSnapshot,
        );
      }

      if (supersededRevs.length > 0) {
        await manager.update(
          CharacterRevisionEntity,
          { id: In(supersededRevs.map((r) => r.id)) },
          { status: 'reverted', revertedByRevisionId: saved.id },
        );
        const editorsAffected = Array.from(
          new Set(supersededRevs.map((r) => r.editorUserId)),
        );
        for (const userId of editorsAffected) {
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
          profile.revertedCount += supersededRevs.filter(
            (r) => r.editorUserId === userId,
          ).length;
          await manager.save(profile);
        }
      }

      const reviewerProfile =
        (await manager.findOne(UserWikiProfileEntity, {
          where: { userId: reviewer.id },
        })) ??
        manager.create(UserWikiProfileEntity, {
          userId: reviewer.id,
          editCount: 0,
          approvedEditCount: 0,
          revertedCount: 0,
          patrolledCount: 0,
        });
      reviewerProfile.patrolledCount += 1;
      await manager.save(reviewerProfile);

      return saved;
    });

    if (newRev.recipeSnapshot) {
      await this.edits.applyApprovedRevision(newRev, reviewer.id);
    }

    await this.maybeAutoLock(characterId);

    return { revisionId: newRev.id, version: newRev.version };
  }

  /**
   * Wikipedia 3RR 风格规则：
   *   (A) 同一 patroller 在 24h 内对同一 character revert > 3 次 → 拒绝。admin 例外。
   * 与 maybeAutoLock 配套防编辑战。
   */
  private async assert3RR(
    characterId: string,
    reviewer: AuthenticatedUser,
  ): Promise<void> {
    if (rankOf(reviewer.role) >= rankOf('admin')) return;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.revisionRepo.count({
      where: {
        characterId,
        operation: 'revert',
        editorUserId: reviewer.id,
        createdAt: MoreThan(cutoff),
      },
    });
    if (count >= 3) {
      throw new ForbiddenException(
        '24 小时内已对该词条回退 3 次（3RR）。请改为讨论页协商或申请管理员介入',
      );
    }
  }

  /**
   * (B) 同一 character 在 24h 内被 revert > 5 次 → 自动 semi 保护 24h。
   * 已是 semi/full 的页面不重复升级。
   */
  private async maybeAutoLock(characterId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.revisionRepo.count({
      where: {
        characterId,
        operation: 'revert',
        createdAt: MoreThan(cutoff),
      },
    });
    if (count <= 5) return;
    const page = await this.pageRepo.findOne({ where: { characterId } });
    if (!page || page.protectionLevel !== 'none') return;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await this.protection.setProtection(
        characterId,
        this.systemUsers.systemActor() as AuthenticatedUser,
        {
          level: 'semi',
          expiresAt: expiresAt.toISOString(),
          reason: 'auto_3rr_lock: 24h 内 revert 次数过多，自动半保护 24 小时',
        },
      );
    } catch {
      // best-effort; never block the revert response on lock failure
    }
  }
}
// i18n-ignore-end
