import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      throw new BadRequestException(
        'targetType 必须是 wiki_revision / wiki_talk_post / wiki_page',
      );
    }
    if (!targetId) throw new BadRequestException('缺少 targetId');
    if (!reason) throw new BadRequestException('举报原因必填');
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
        throw new BadRequestException('status 无效');
      }
      qb.andWhere('r.status = :status', { status: filter.status });
    }
    return qb.getMany();
  }

  async setStatus(id: string, status: string): Promise<ModerationReportEntity> {
    if (!WIKI_STATUSES.has(status)) {
      throw new BadRequestException('status 必须是 open / resolved / dismissed');
    }
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('举报不存在');
    if (!WIKI_TARGET_TYPES.has(report.targetType)) {
      throw new BadRequestException('该举报不属于 wiki');
    }
    report.status = status;
    return this.reportRepo.save(report);
  }
}
