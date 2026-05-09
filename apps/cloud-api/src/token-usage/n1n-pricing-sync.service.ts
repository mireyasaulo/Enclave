import {
  BadGatewayException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CloudTokenPricingCatalogEntity } from "../entities/cloud-token-pricing-catalog.entity";
import { CloudTokenUsageBreakdownDailyEntity } from "../entities/cloud-token-usage-breakdown-daily.entity";
import { CloudTokenUsageDailyEntity } from "../entities/cloud-token-usage-daily.entity";

const N1N_RATIO_CONFIG_URL = "https://api.n1n.ai/api/ratio_config";
const FETCH_TIMEOUT_MS = 15_000;
// n1n.ai (and one-api / new-api forks) normalize prices so that
//   model_ratio = 1 means $0.002 per 1k input tokens (= $2 per 1M).
const N1N_BASE_PRICE_USD_PER_1K = 0.002;
const UPSERT_CHUNK_SIZE = 200;
// estimatedCostCents stores cost × 100, matching token-usage.service toCents().
const COST_PRECISION_SCALE = 100;
const TARGET_CURRENCY = "USD";

type RatioConfigData = {
  model_ratio?: Record<string, number | undefined>;
  completion_ratio?: Record<string, number | undefined>;
};

export type N1nPricingSyncResult = {
  source: "n1n.ai";
  fetchedAt: string;
  upserted: number;
  skipped: number;
  recomputedDays: number;
  recomputedRows: number;
};

type PricingMap = Map<
  string,
  { inputUsdPer1k: number; outputUsdPer1k: number }
>;

@Injectable()
export class N1nPricingSyncService {
  private readonly logger = new Logger(N1nPricingSyncService.name);

  constructor(
    @InjectRepository(CloudTokenPricingCatalogEntity)
    private readonly pricing: Repository<CloudTokenPricingCatalogEntity>,
    @InjectRepository(CloudTokenUsageDailyEntity)
    private readonly daily: Repository<CloudTokenUsageDailyEntity>,
    @InjectRepository(CloudTokenUsageBreakdownDailyEntity)
    private readonly breakdown: Repository<CloudTokenUsageBreakdownDailyEntity>,
  ) {}

  async syncFromN1n(): Promise<N1nPricingSyncResult> {
    const data = await this.fetchRatioConfig();
    const modelRatio = data.model_ratio ?? {};
    const completionRatio = data.completion_ratio ?? {};

    const rows: Array<Partial<CloudTokenPricingCatalogEntity>> = [];
    // Keep full-precision prices in memory for the recompute step so we don't
    // re-suffer the millicents-per-1k integer rounding (cheap models such as
    // gpt-4o-mini at $0.00015/1k round to 0 in the catalog).
    const precisePricing: PricingMap = new Map();
    let skipped = 0;

    for (const [model, rawRatio] of Object.entries(modelRatio)) {
      const trimmed = (model ?? "").trim();
      if (!trimmed) {
        skipped += 1;
        continue;
      }
      const ratio = Number(rawRatio);
      if (!Number.isFinite(ratio) || ratio <= 0) {
        // 0 or missing ratios are typically embedding / rerank / per-call models
        // — they are not priced per 1k tokens.
        skipped += 1;
        continue;
      }
      const compRaw = Number(completionRatio[trimmed]);
      const compRatio =
        Number.isFinite(compRaw) && compRaw > 0 ? compRaw : 1;

      const inputUsdPer1k = ratio * N1N_BASE_PRICE_USD_PER_1K;
      const outputUsdPer1k = inputUsdPer1k * compRatio;

      precisePricing.set(trimmed, { inputUsdPer1k, outputUsdPer1k });

      // entity stores millicents per 1k tokens (1 USD = 100 cents = 100_000 millicents).
      // existing convention (token-usage.service.ts:565) uses
      //   inputPer1kMillicents = inputPer1kTokens * 1000
      // i.e. the field stores (currency-unit/1k tokens) * 1000.
      // We follow that contract exactly for read-side compatibility, even
      // though it loses precision below $0.001/1k ($1/M tokens).
      rows.push({
        currency: "USD",
        model: trimmed,
        inputPer1kMillicents: Math.max(
          0,
          Math.round(inputUsdPer1k * 1000),
        ),
        outputPer1kMillicents: Math.max(
          0,
          Math.round(outputUsdPer1k * 1000),
        ),
        enabled: true,
        note: "Synced from n1n.ai",
      });
    }

    let upserted = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
      await this.pricing.upsert(chunk, {
        conflictPaths: ["currency", "model"],
        skipUpdateIfNoValuesChanged: true,
      });
      upserted += chunk.length;
    }

    const { days: recomputedDays, rows: recomputedRows } =
      await this.recomputeHistoricalCosts(precisePricing);

    const fetchedAt = new Date().toISOString();
    this.logger.log(
      `Synced n1n.ai pricing: upserted=${upserted}, skipped=${skipped}, recomputedDays=${recomputedDays}, recomputedRows=${recomputedRows}`,
    );

    return {
      source: "n1n.ai",
      fetchedAt,
      upserted,
      skipped,
      recomputedDays,
      recomputedRows,
    };
  }

  /**
   * After the catalog is refreshed, walk every (worldId, bucketDate) tuple in
   * cloud_token_usage_daily and recompute estimatedCostCents:
   *   - dimension='model' breakdown rows: exact cost = tokens × catalog price.
   *   - other dimension rows (character / conversation / scene / billingSource):
   *     proportionally allocated by token share — they aggregate over multiple
   *     models, so exact per-row cost is not derivable on the cloud-api side
   *     (the per-call model is only known on the apps/app ai_usage_ledger).
   *   - daily aggregate row: sum of model breakdown costs (computed in float
   *     dollars first, only rounded to integer cents at the very end so we
   *     don't lose sub-cent precision across many cheap models).
   */
  private async recomputeHistoricalCosts(pricingMap: PricingMap): Promise<{
    days: number;
    rows: number;
  }> {
    if (pricingMap.size === 0) {
      return { days: 0, rows: 0 };
    }

    const dailyRows = await this.daily.find({
      order: { worldId: "ASC", bucketDate: "ASC" },
    });
    let updatedRows = 0;
    let updatedDays = 0;

    for (const dailyRow of dailyRows) {
      const breakdownRows = await this.breakdown.find({
        where: {
          worldId: dailyRow.worldId,
          bucketDate: dailyRow.bucketDate,
        },
      });
      if (breakdownRows.length === 0) continue;

      const modelRows = breakdownRows.filter(
        (row) => row.dimension === "model",
      );

      let dayTotalCostUsd = 0;
      let modelTokensSum = 0;
      const modelRowsToUpdate: CloudTokenUsageBreakdownDailyEntity[] = [];

      for (const row of modelRows) {
        const price = pricingMap.get(row.key);
        let rowCostUsd = 0;
        if (price) {
          rowCostUsd =
            (row.promptTokens / 1000) * price.inputUsdPer1k +
            (row.completionTokens / 1000) * price.outputUsdPer1k;
        }
        row.estimatedCostCents = Math.max(
          0,
          Math.round(rowCostUsd * COST_PRECISION_SCALE),
        );
        row.currency = TARGET_CURRENCY;
        modelRowsToUpdate.push(row);
        dayTotalCostUsd += rowCostUsd;
        modelTokensSum += row.totalTokens;
      }

      if (modelRowsToUpdate.length > 0) {
        await this.breakdown.save(modelRowsToUpdate);
        updatedRows += modelRowsToUpdate.length;
      }

      const dayTotalCostCents = Math.max(
        0,
        Math.round(dayTotalCostUsd * COST_PRECISION_SCALE),
      );

      // Allocate cost proportionally across non-model dimensions by token share.
      const otherRows = breakdownRows.filter(
        (row) => row.dimension !== "model",
      );
      if (otherRows.length > 0 && modelTokensSum > 0) {
        const otherToUpdate: CloudTokenUsageBreakdownDailyEntity[] = [];
        for (const row of otherRows) {
          const share = row.totalTokens / modelTokensSum;
          row.estimatedCostCents = Math.max(
            0,
            Math.round(dayTotalCostUsd * share * COST_PRECISION_SCALE),
          );
          row.currency = TARGET_CURRENCY;
          otherToUpdate.push(row);
        }
        await this.breakdown.save(otherToUpdate);
        updatedRows += otherToUpdate.length;
      }

      dailyRow.estimatedCostCents = dayTotalCostCents;
      dailyRow.currency = TARGET_CURRENCY;
      await this.daily.save(dailyRow);
      updatedDays += 1;
    }

    return { days: updatedDays, rows: updatedRows };
  }

  private async fetchRatioConfig(): Promise<RatioConfigData> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(N1N_RATIO_CONFIG_URL, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new BadGatewayException(
          `n1n.ai ratio_config returned HTTP ${response.status}`,
        );
      }
      const body = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: RatioConfigData;
      };
      if (!body || body.success === false || !body.data) {
        throw new BadGatewayException(
          `n1n.ai ratio_config response invalid: ${body?.message ?? "no data"}`,
        );
      }
      return body.data;
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
        throw new BadGatewayException("n1n.ai ratio_config request timed out");
      }
      if (error instanceof BadGatewayException) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(
        `Failed to fetch n1n.ai ratio_config: ${message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
