import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { CharacterPageEntity } from '../entities/character-page.entity';
import { CharacterRevisionEntity } from '../entities/character-revision.entity';
import { EditSubmissionEntity } from '../entities/edit-submission.entity';
import { UserWikiProfileEntity } from '../entities/user-wiki-profile.entity';
import { AbuseFilterEntity } from '../entities/abuse-filter.entity';
import { AbuseFilterHitEntity } from '../entities/abuse-filter-hit.entity';

@Injectable()
export class WikiStatsService {
  constructor(
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
    @InjectRepository(EditSubmissionEntity)
    private readonly submissionRepo: Repository<EditSubmissionEntity>,
    @InjectRepository(UserWikiProfileEntity)
    private readonly profileRepo: Repository<UserWikiProfileEntity>,
    @InjectRepository(AbuseFilterEntity)
    private readonly filterRepo: Repository<AbuseFilterEntity>,
    @InjectRepository(AbuseFilterHitEntity)
    private readonly hitRepo: Repository<AbuseFilterHitEntity>,
  ) {}

  async daily(): Promise<{
    todayCreates: number;
    weekCreates: number;
    pendingQueueLength: number;
    todayApproved: number;
    todayRejected: number;
    abuseHitsToday: number;
    autoconfirmedThisWeek: number;
  }> {
    const todayStart = startOfToday();
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      todayCreates,
      weekCreates,
      pendingQueueLength,
      todayApproved,
      todayRejected,
      abuseHitsToday,
      autoconfirmedThisWeek,
    ] = await Promise.all([
      this.revisionRepo.count({
        where: { operation: 'create', createdAt: MoreThan(todayStart) },
      }),
      this.revisionRepo.count({
        where: { operation: 'create', createdAt: MoreThan(weekStart) },
      }),
      this.submissionRepo.count({ where: { decision: IsNull() as never } }),
      this.revisionRepo.count({
        where: { status: 'approved', createdAt: MoreThan(todayStart) },
      }),
      this.revisionRepo.count({
        where: { status: 'rejected', createdAt: MoreThan(todayStart) },
      }),
      this.hitRepo.count({ where: { createdAt: MoreThan(todayStart) } }),
      this.profileRepo.count({
        where: { autoconfirmedAt: MoreThan(weekStart) },
      }),
    ]);
    return {
      todayCreates,
      weekCreates,
      pendingQueueLength,
      todayApproved,
      todayRejected,
      abuseHitsToday,
      autoconfirmedThisWeek,
    };
  }

  async topRevertedUsers(
    limit = 20,
  ): Promise<UserWikiProfileEntity[]> {
    return this.profileRepo.find({
      order: { revertedCount: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async filterStats(): Promise<
    Array<{ filter: AbuseFilterEntity; recentHits: number }>
  > {
    const filters = await this.filterRepo.find({ order: { createdAt: 'ASC' } });
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const results: Array<{
      filter: AbuseFilterEntity;
      recentHits: number;
    }> = [];
    for (const filter of filters) {
      const recentHits = await this.hitRepo.count({
        where: { filterId: filter.id, createdAt: MoreThan(cutoff) },
      });
      results.push({ filter, recentHits });
    }
    return results;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
