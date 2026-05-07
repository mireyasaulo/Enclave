import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClientTelemetryDailyEntity } from "../entities/client-telemetry-daily.entity";
import { ClientTelemetryEventEntity } from "../entities/client-telemetry-event.entity";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class TelemetryAggregatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryAggregatorService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ClientTelemetryEventEntity)
    private readonly events: Repository<ClientTelemetryEventEntity>,
    @InjectRepository(ClientTelemetryDailyEntity)
    private readonly daily: Repository<ClientTelemetryDailyEntity>,
  ) {}

  async onModuleInit() {
    void this.runSweep();
    this.timer = setInterval(() => {
      void this.runSweep();
    }, SWEEP_INTERVAL_MS);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runSweep() {
    try {
      const today = isoDate(new Date());
      const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      await this.aggregateForDate(yesterday);
      await this.aggregateForDate(today);
    } catch (error) {
      this.logger.error(
        `telemetry aggregator sweep failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async aggregateForDate(date: string) {
    const baseRows = await this.events
      .createQueryBuilder("e")
      .select("e.appId", "appId")
      .addSelect("e.eventName", "eventName")
      .addSelect("COUNT(*)", "count")
      .addSelect("COUNT(DISTINCT e.userId)", "uniqueUsers")
      .addSelect("COUNT(DISTINCT e.anonId)", "uniqueAnons")
      .addSelect(
        "SUM(CASE WHEN e.eventType = 'pv' THEN 1 ELSE 0 END)",
        "pvCount",
      )
      .addSelect(
        "SUM(CASE WHEN e.eventType = 'error' THEN 1 ELSE 0 END)",
        "errorCount",
      )
      .where("substr(e.occurredAt, 1, 10) = :date", { date })
      .groupBy("e.appId")
      .addGroupBy("e.eventName")
      .getRawMany<{
        appId: string;
        eventName: string;
        count: string | number;
        uniqueUsers: string | number;
        uniqueAnons: string | number;
        pvCount: string | number;
        errorCount: string | number;
      }>();

    if (baseRows.length === 0) return;

    for (const row of baseRows) {
      let apiP50Ms: number | null = null;
      let apiP95Ms: number | null = null;
      let apiSuccessRate: number | null = null;

      if (row.eventName === "api_call") {
        const stats = await this.computeApiStats(row.appId, date);
        apiP50Ms = stats.p50;
        apiP95Ms = stats.p95;
        apiSuccessRate = stats.successRate;
      }

      await this.daily
        .createQueryBuilder()
        .insert()
        .into(ClientTelemetryDailyEntity)
        .values({
          date,
          appId: row.appId,
          eventName: row.eventName,
          count: toInt(row.count),
          uniqueUsers: toInt(row.uniqueUsers),
          uniqueAnons: toInt(row.uniqueAnons),
          pvCount: toInt(row.pvCount),
          errorCount: toInt(row.errorCount),
          apiP50Ms,
          apiP95Ms,
          apiSuccessRate,
          updatedAt: new Date(),
        })
        .orUpdate(
          [
            "count",
            "uniqueUsers",
            "uniqueAnons",
            "pvCount",
            "errorCount",
            "apiP50Ms",
            "apiP95Ms",
            "apiSuccessRate",
            "updatedAt",
          ],
          ["date", "appId", "eventName"],
        )
        .execute();
    }
  }

  private async computeApiStats(
    appId: string,
    date: string,
  ): Promise<{ p50: number | null; p95: number | null; successRate: number | null }> {
    const rows = await this.events
      .createQueryBuilder("e")
      .select("e.propsJson", "propsJson")
      .where("e.eventName = 'api_call'")
      .andWhere("e.appId = :appId", { appId })
      .andWhere("substr(e.occurredAt, 1, 10) = :date", { date })
      .getRawMany<{ propsJson: string | null }>();

    const durations: number[] = [];
    let okCount = 0;
    let total = 0;
    for (const r of rows) {
      if (!r.propsJson) continue;
      try {
        const p = JSON.parse(r.propsJson) as {
          durationMs?: number;
          ok?: boolean;
        };
        if (typeof p.durationMs === "number") {
          durations.push(p.durationMs);
        }
        total += 1;
        if (p.ok) okCount += 1;
      } catch {
        // ignore
      }
    }

    const p50 = percentile(durations, 0.5);
    const p95 = percentile(durations, 0.95);
    const successRate = total > 0 ? okCount / total : null;
    return { p50, p95, successRate };
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toInt(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function percentile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return Math.round(sorted[idx]);
}
