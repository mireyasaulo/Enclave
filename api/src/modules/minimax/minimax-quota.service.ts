// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MinimaxQuotaEntity } from './minimax-quota.entity';
import { getDailyLimit, TOKEN_PLAN_DAILY_LIMITS } from './minimax-quota.constants';

const SHANGHAI_OFFSET_MINUTES = 8 * 60;

function todayInShanghai(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MINUTES * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface QuotaSnapshot {
  used: number;
  reserved: number;
  committed: number;
  limit: number;
  remaining: number;
}

@Injectable()
export class MinimaxQuotaService {
  private readonly logger = new Logger(MinimaxQuotaService.name);
  // 当日已经告警过的 "model:date" key，跨日期自然失效（key 含日期）
  private readonly warnedToday = new Set<string>();

  constructor(
    @InjectRepository(MinimaxQuotaEntity)
    private readonly repo: Repository<MinimaxQuotaEntity>,
  ) {}

  // 配额耗尽预警：reserve 成功后，如果剩余 ≤ 1，写一次性 warn 日志，
  // 方便 ops 在日志里抓，避免频繁 reserve 触发日志洪水。
  private maybeWarnLowRemaining(model: string, remaining: number): void {
    if (remaining > 1) return;
    const key = `${model}:${todayInShanghai()}`;
    if (this.warnedToday.has(key)) return;
    this.warnedToday.add(key);
    this.logger.warn(
      `minimax quota low: model=${model} remaining=${remaining} (day=${todayInShanghai()})`,
    );
  }

  async availableToday(model: string): Promise<number> {
    const limit = getDailyLimit(model);
    if (limit <= 0) return 0;
    const row = await this.repo.findOne({
      where: { model, usageDate: todayInShanghai() },
    });
    if (!row) return limit;
    return Math.max(0, limit - row.reserved - row.committed);
  }

  async tryReserve(model: string): Promise<boolean> {
    const limit = getDailyLimit(model);
    if (limit <= 0) {
      this.logger.warn(`tryReserve unknown model=${model}`);
      return false;
    }
    const usageDate = todayInShanghai();
    const ok = await this.repo.manager.transaction(async (mgr) => {
      const row = await mgr.findOne(MinimaxQuotaEntity, {
        where: { model, usageDate },
      });
      if (!row) {
        const created = mgr.create(MinimaxQuotaEntity, {
          model,
          usageDate,
          reserved: 1,
          committed: 0,
        });
        await mgr.save(created);
        return true;
      }
      if (row.reserved + row.committed >= limit) {
        return false;
      }
      const result = await mgr
        .createQueryBuilder()
        .update(MinimaxQuotaEntity)
        .set({ reserved: () => 'reserved + 1' })
        .where(
          'id = :id AND reserved + committed < :limit',
          { id: row.id, limit },
        )
        .execute();
      return (result.affected ?? 0) === 1;
    });
    if (ok) {
      const remaining = await this.availableToday(model);
      this.maybeWarnLowRemaining(model, remaining);
    }
    return ok;
  }

  async commit(model: string): Promise<void> {
    const usageDate = todayInShanghai();
    await this.repo
      .createQueryBuilder()
      .update(MinimaxQuotaEntity)
      .set({
        reserved: () => 'CASE WHEN reserved > 0 THEN reserved - 1 ELSE 0 END',
        committed: () => 'committed + 1',
      })
      .where('model = :model AND usageDate = :usageDate', { model, usageDate })
      .execute();
  }

  async release(model: string): Promise<void> {
    const usageDate = todayInShanghai();
    await this.repo
      .createQueryBuilder()
      .update(MinimaxQuotaEntity)
      .set({
        reserved: () => 'CASE WHEN reserved > 0 THEN reserved - 1 ELSE 0 END',
      })
      .where('model = :model AND usageDate = :usageDate', { model, usageDate })
      .execute();
  }

  async snapshotToday(): Promise<Record<string, QuotaSnapshot>> {
    const usageDate = todayInShanghai();
    const rows = await this.repo.find({ where: { usageDate } });
    const byModel = new Map(rows.map((r) => [r.model, r] as const));
    const out: Record<string, QuotaSnapshot> = {};
    for (const [model, limit] of Object.entries(TOKEN_PLAN_DAILY_LIMITS)) {
      const row = byModel.get(model);
      const reserved = row?.reserved ?? 0;
      const committed = row?.committed ?? 0;
      const used = reserved + committed;
      out[model] = {
        used,
        reserved,
        committed,
        limit,
        remaining: Math.max(0, limit - used),
      };
    }
    return out;
  }
}

// i18n-ignore-end
