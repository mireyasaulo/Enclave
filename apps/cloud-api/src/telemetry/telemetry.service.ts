import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type {
  TelemetryAppId,
  TelemetryBatchResponse,
  TelemetryEventInput,
} from "@yinjie/contracts";
import { createHash, randomUUID } from "crypto";
import { Repository } from "typeorm";
import { ClientTelemetryEventEntity } from "../entities/client-telemetry-event.entity";

const MAX_PROPS_BYTES = 32 * 1024;
const MAX_USER_AGENT_LEN = 500;
const RATE_LIMIT_BUCKET_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

type IngestContext = {
  ip: string | null;
  userAgent: string | null;
};

type Bucket = { count: number; resetAt: number };

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly buckets = new Map<string, Bucket>();
  private readonly dailySaltCache = new Map<string, string>();

  constructor(
    @InjectRepository(ClientTelemetryEventEntity)
    private readonly events: Repository<ClientTelemetryEventEntity>,
  ) {}

  async ingestBatch(
    appId: TelemetryAppId,
    inputs: TelemetryEventInput[],
    ctx: IngestContext,
  ): Promise<TelemetryBatchResponse> {
    const ipHash = this.hashIp(ctx.ip);
    const bucketKey = `${appId}:${ipHash ?? "noip"}`;
    if (!this.allowBucket(bucketKey, inputs.length)) {
      return { accepted: 0, rejected: inputs.length };
    }

    const userAgent = ctx.userAgent ? ctx.userAgent.slice(0, MAX_USER_AGENT_LEN) : null;
    const now = new Date();

    const rows = inputs
      .map((input) => this.buildRow(appId, input, ipHash, userAgent, now))
      .filter((row): row is ClientTelemetryEventEntity => row !== null);

    const rejected = inputs.length - rows.length;
    if (rows.length === 0) {
      return { accepted: 0, rejected };
    }

    try {
      const chunkSize = 50;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await this.events.insert(rows.slice(i, i + chunkSize));
      }
      return { accepted: rows.length, rejected };
    } catch (error) {
      this.logger.error(
        `telemetry insert failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return { accepted: 0, rejected: inputs.length };
    }
  }

  private buildRow(
    appId: TelemetryAppId,
    input: TelemetryEventInput,
    ipHash: string | null,
    userAgent: string | null,
    now: Date,
  ): ClientTelemetryEventEntity | null {
    let propsJson: string | null = null;
    if (input.props && Object.keys(input.props).length > 0) {
      try {
        const json = JSON.stringify(input.props);
        if (json.length > MAX_PROPS_BYTES) return null;
        propsJson = json;
      } catch {
        return null;
      }
    }

    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return null;

    const row = this.events.create({
      id: randomUUID(),
      appId,
      eventName: input.eventName,
      eventType: input.eventType,
      anonId: input.anonId,
      userId: input.userId ?? null,
      sessionId: input.sessionId,
      pagePath: input.pagePath ?? null,
      referrer: input.referrer ?? null,
      propsJson,
      userAgent,
      ipHash,
      release: input.release ?? null,
      occurredAt,
      serverReceivedAt: now,
    });
    return row;
  }

  private hashIp(ip: string | null): string | null {
    if (!ip) return null;
    const today = new Date().toISOString().slice(0, 10);
    let salt = this.dailySaltCache.get(today);
    if (!salt) {
      salt = `yinjie-tel-${today}`;
      this.dailySaltCache.set(today, salt);
      if (this.dailySaltCache.size > 7) {
        const oldest = this.dailySaltCache.keys().next().value;
        if (oldest) this.dailySaltCache.delete(oldest);
      }
    }
    return createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 16);
  }

  private allowBucket(key: string, cost: number): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: cost, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return cost <= RATE_LIMIT_BUCKET_MAX;
    }
    if (bucket.count + cost > RATE_LIMIT_BUCKET_MAX) return false;
    bucket.count += cost;
    return true;
  }
}
