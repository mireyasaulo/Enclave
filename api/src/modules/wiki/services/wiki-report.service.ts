// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../../common/app-error.exception';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { ModerationReportEntity } from '../../moderation/moderation-report.entity';

const WIKI_TARGET_TYPES = new Set([
  'wiki_revision',
  'wiki_talk_post',
  'wiki_page',
]);

const WIKI_STATUSES = new Set(['open', 'resolved', 'dismissed']);

@Injectable()
export class WikiReportService {
  constructor(
    @InjectRepository(ModerationReportEntity)
    private readonly reportRepo: Repository<ModerationReportEntity>,
  ) {}

  async create(
    reporter: AuthenticatedUser,
    input: {
      targetType: string;
      targetId: string;
      reason: string;
      details?: string;
    },
  ): Promise<ModerationReportEntity> {
    const targetType = input.targetType?.trim();
    const targetId = input.targetId?.trim();
    const reason = input.reason?.trim();
    if (!targetType || !WIKI_TARGET_TYPES.has(targetType)) {
      throw new AppError('WIKI_REPORT_INVALID_STATE', {
        params: {
          detail: 'targetType 必须是 wiki_revision / wiki_talk_post / wiki_page',
        },
        legacyMessage:
          'targetType 必须是 wiki_revision / wiki_talk_post / wiki_page',
      });
    }
    if (!targetId) throw new AppError('WIKI_REPORT_INVALID_STATE', {
        params: { detail: '缺少 targetId' },
        legacyMessage: '缺少 targetId',
      });
    if (!reason) throw new AppError('WIKI_REPORT_INVALID_STATE', {
        params: { detail: '举报原因必填' },
        legacyMessage: '举报原因必填',
      });
    return this.reportRepo.save(
      this.reportRepo.create({
        ownerId: reporter.id,
        targetType,
        targetId,
        reason,
        details: input.details?.trim() || null,
        status: 'open',
      }),
    );
  }

  async list(filter: { status?: string }): Promise<ModerationReportEntity[]> {
    const qb = this.reportRepo
      .createQueryBuilder('r')
      .where('r.targetType IN (:...types)', {
        types: Array.from(WIKI_TARGET_TYPES),
      })
      .orderBy('r.createdAt', 'DESC')
      .take(200);
    if (filter.status) {
      if (!WIKI_STATUSES.has(filter.status)) {
        throw new AppError('WIKI_REPORT_INVALID_STATE', {
        params: { detail: 'status 无效' },
        legacyMessage: 'status 无效',
      });
      }
      qb.andWhere('r.status = :status', { status: filter.status });
    }
    return qb.getMany();
  }

  async setStatus(id: string, status: string): Promise<ModerationReportEntity> {
    if (!WIKI_STATUSES.has(status)) {
      throw new AppError('WIKI_REPORT_INVALID_STATE', {
        params: { detail: 'status 必须是 open / resolved / dismissed' },
        legacyMessage: 'status 必须是 open / resolved / dismissed',
      });
    }
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new AppError('WIKI_REPORT_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '举报不存在',
      });
    if (!WIKI_TARGET_TYPES.has(report.targetType)) {
      throw new AppError('WIKI_REPORT_INVALID_STATE', {
        params: { detail: '该举报不属于 wiki' },
        legacyMessage: '该举报不属于 wiki',
      });
    }
    report.status = status;
    return this.reportRepo.save(report);
  }
}
// i18n-ignore-end
