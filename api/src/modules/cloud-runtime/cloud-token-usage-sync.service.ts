import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageLedgerService } from '../analytics/ai-usage-ledger.service';

type LedgerOverview = {
  currency: 'CNY' | 'USD';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
  successCount: number;
  failedCount: number;
  activeCharacterCount: number;
};

type LedgerBreakdownItem = {
  key: string;
  label: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
  successCount: number;
  failedCount: number;
};

type LedgerBreakdownResponse = {
  currency: 'CNY' | 'USD';
  byCharacter: LedgerBreakdownItem[];
  byConversation: LedgerBreakdownItem[];
  byScene: LedgerBreakdownItem[];
  byModel: LedgerBreakdownItem[];
  byBillingSource: LedgerBreakdownItem[];
};

type DailyPushItem = {
  dimension:
    | 'character'
    | 'conversation'
    | 'scene'
    | 'model'
    | 'billingSource';
  key: string;
  label?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
  successCount: number;
  failedCount: number;
};

type DailyPushPayload = {
  worldId: string;
  bucketDate: string;
  overview: LedgerOverview;
  breakdowns: DailyPushItem[];
};

type SyncConfig = {
  cloudPlatformBaseUrl: string;
  worldId: string;
  callbackToken: string;
  intervalMs: number;
};

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class CloudTokenUsageSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudTokenUsageSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private syncing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly usageLedger: AiUsageLedgerService,
  ) {}

  onModuleInit() {
    const config = this.getConfig();
    if (!config) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runSync();
    }, config.intervalMs);
    this.timer.unref?.();
    void this.runSync();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runSync(): Promise<void> {
    if (this.syncing) {
      return;
    }
    const config = this.getConfig();
    if (!config) {
      return;
    }
    this.syncing = true;
    try {
      const today = isoDate(new Date());
      const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      await this.syncBucket(config, yesterday);
      await this.syncBucket(config, today);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Token usage cloud sync failed: ${message}`);
    } finally {
      this.syncing = false;
    }
  }

  private async syncBucket(config: SyncConfig, bucketDate: string) {
    const range = bucketRange(bucketDate);
    const overview = (await this.usageLedger.getOverview({
      from: range.from,
      to: range.to,
    })) as LedgerOverview;

    if (overview.requestCount === 0) {
      return;
    }

    const breakdown = (await this.usageLedger.getBreakdown({
      from: range.from,
      to: range.to,
    })) as LedgerBreakdownResponse;

    const breakdowns = flattenBreakdown(breakdown);
    const payload: DailyPushPayload = {
      worldId: config.worldId,
      bucketDate,
      overview,
      breakdowns,
    };

    await this.postWithRetry(config, payload);
  }

  private async postWithRetry(
    config: SyncConfig,
    payload: DailyPushPayload,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const ok = await this.postOnce(config, payload);
      if (ok) {
        return;
      }
      if (attempt < maxAttempts) {
        await sleep(500 * 2 ** (attempt - 1));
      }
    }
    this.logger.warn(
      `Token usage daily push failed after ${maxAttempts} attempts for ${payload.bucketDate}.`,
    );
  }

  private async postOnce(
    config: SyncConfig,
    payload: DailyPushPayload,
  ): Promise<boolean> {
    const response = await fetch(
      `${config.cloudPlatformBaseUrl}/internal/cloud/token-usage/daily`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-world-callback-token': config.callbackToken,
        },
        body: JSON.stringify(payload),
      },
    ).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Token usage push request error: ${message}`);
      return null;
    });

    if (!response) {
      return false;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Token usage push rejected with ${response.status}: ${body || 'no body'}`,
      );
      return false;
    }
    return true;
  }

  private getConfig(): SyncConfig | null {
    const cloudPlatformBaseUrl = trimTrailingSlash(
      this.configService.get<string>('CLOUD_PLATFORM_BASE_URL'),
    );
    const worldId = trimToNull(this.configService.get<string>('CLOUD_WORLD_ID'));
    const callbackToken = trimToNull(
      this.configService.get<string>('CLOUD_WORLD_CALLBACK_TOKEN'),
    );
    if (!cloudPlatformBaseUrl || !worldId || !callbackToken) {
      return null;
    }
    return {
      cloudPlatformBaseUrl,
      worldId,
      callbackToken,
      intervalMs: parsePositiveInteger(
        this.configService.get<string>('CLOUD_TOKEN_USAGE_SYNC_INTERVAL_MS'),
        DEFAULT_INTERVAL_MS,
      ),
    };
  }
}

function flattenBreakdown(
  breakdown: LedgerBreakdownResponse,
): DailyPushItem[] {
  const out: DailyPushItem[] = [];
  pushDimension(out, 'character', breakdown.byCharacter);
  pushDimension(out, 'conversation', breakdown.byConversation);
  pushDimension(out, 'scene', breakdown.byScene);
  pushDimension(out, 'model', breakdown.byModel);
  pushDimension(out, 'billingSource', breakdown.byBillingSource);
  return out;
}

function pushDimension(
  bucket: DailyPushItem[],
  dimension: DailyPushItem['dimension'],
  items: LedgerBreakdownItem[] | undefined,
) {
  if (!items) return;
  for (const item of items) {
    bucket.push({
      dimension,
      key: item.key,
      label: item.label,
      promptTokens: item.promptTokens,
      completionTokens: item.completionTokens,
      totalTokens: item.totalTokens,
      estimatedCost: item.estimatedCost,
      requestCount: item.requestCount,
      successCount: item.successCount,
      failedCount: item.failedCount,
    });
  }
}

function bucketRange(bucketDate: string) {
  return {
    from: `${bucketDate}T00:00:00.000Z`,
    to: `${bucketDate}T23:59:59.999Z`,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function trimToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function trimTrailingSlash(value: string | undefined | null) {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number) {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
