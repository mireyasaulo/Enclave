// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MinimaxQuotaEntity } from './minimax-quota.entity';
import { getDailyLimit, TOKEN_PLAN_DAILY_LIMITS } from './minimax-quota.constants';

const SHANGHAI_OFFSET_MINUTES = 8 * 60;

export function todayInShanghai(): string {
  return shanghaiDateOf(new Date());
}

export function shanghaiDateOf(date: Date): string {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MINUTES * 60 * 1000);
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

const EXHAUSTED_CACHE_TTL_MS = 30_000;

@Injectable()
export class MinimaxQuotaService {
  private readonly logger = new Logger(MinimaxQuotaService.name);
  // 当日已经告警过的 "model:date" key，跨日期自然失效（key 含日期）
  private readonly warnedToday = new Set<string>();
  // 内存层熔断：minimax 返回 2056/1042 后立即写入，避免热路径反复打 DB。
  // 同时 markExhaustedToday 也持久化到 DB（exhaustedAt 列），跨进程/重启共享。
  // key=model:Shanghai-day，跨日自然失效。
  private readonly exhaustedToday = new Set<string>();
  // DB 查询结果缓存：每个 key 最多查一次 / TTL，避免 tryReserve 热路径反复 SELECT。
  private readonly exhaustedDbCache = new Map<
    string,
    { value: boolean; expiresAt: number }
  >();

  constructor(
    @InjectRepository(MinimaxQuotaEntity)
    private readonly repo: Repository<MinimaxQuotaEntity>,
  ) {}

  private exhaustedKey(model: string): string {
    return `${model}:${todayInShanghai()}`;
  }

  // 当 minimax 真的回 2056/1042 时，调用方在 catch 里调这个。
  // 写两处：1) 进程内 Set；2) DB row.exhaustedAt（让其他 child / 重启后的本进程能看见）。
  async markExhaustedToday(model: string): Promise<void> {
    const key = this.exhaustedKey(model);
    if (!this.exhaustedToday.has(key)) {
      this.exhaustedToday.add(key);
      this.logger.warn(
        `minimax model=${model} marked exhausted for ${todayInShanghai()} (Shanghai); skipping all reservations until next-day reset`,
      );
    }
    // 同步把 DB cache 翻成 true（哪怕 DB 写失败也不影响本进程立刻熔断）
    this.exhaustedDbCache.set(key, {
      value: true,
      expiresAt: Date.now() + EXHAUSTED_CACHE_TTL_MS,
    });

    const usageDate = todayInShanghai();
    try {
      await this.repo.manager.transaction(async (mgr) => {
        const row = await mgr.findOne(MinimaxQuotaEntity, {
          where: { model, usageDate },
        });
        if (!row) {
          const created = mgr.create(MinimaxQuotaEntity, {
            model,
            usageDate,
            reserved: 0,
            committed: 0,
            exhaustedAt: new Date(),
          });
          await mgr.save(created);
          return;
        }
        if (row.exhaustedAt) return;
        await mgr.update(MinimaxQuotaEntity, row.id, { exhaustedAt: new Date() });
      });
    } catch (err) {
      // DB 写失败仅记日志：内存层已经熔断，重启后还能再撞一次 2056 重置而已。
      this.logger.warn(
        `markExhaustedToday DB persist failed model=${model}: ${(err as Error)?.message}`,
      );
    }
  }

  async isExhaustedToday(model: string): Promise<boolean> {
    const key = this.exhaustedKey(model);
    if (this.exhaustedToday.has(key)) return true;
    const cached = this.exhaustedDbCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    let value = false;
    try {
      const row = await this.repo.findOne({
        where: { model, usageDate: todayInShanghai() },
      });
      value = !!row?.exhaustedAt;
      if (value) this.exhaustedToday.add(key);
    } catch (err) {
      // DB 失败时返回 false：宁可多打一次必败请求，也不让热路径卡住
      this.logger.warn(
        `isExhaustedToday DB lookup failed model=${model}: ${(err as Error)?.message}`,
      );
    }
    this.exhaustedDbCache.set(key, {
      value,
      expiresAt: Date.now() + EXHAUSTED_CACHE_TTL_MS,
    });
    return value;
  }

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
    if (await this.isExhaustedToday(model)) {
      // 今天已经被 minimax 服务端确认耗尽，直接拒绝，避免再打一次必败请求。
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
