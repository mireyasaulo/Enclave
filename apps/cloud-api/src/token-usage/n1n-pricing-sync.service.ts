import {
  BadGatewayException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CloudTokenPricingCatalogEntity } from "../entities/cloud-token-pricing-catalog.entity";

const N1N_RATIO_CONFIG_URL = "https://api.n1n.ai/api/ratio_config";
const FETCH_TIMEOUT_MS = 15_000;
// n1n.ai (and one-api / new-api forks) normalize prices so that
//   model_ratio = 1 means $0.002 per 1k input tokens (= $2 per 1M).
const N1N_BASE_PRICE_USD_PER_1K = 0.002;
const UPSERT_CHUNK_SIZE = 200;

type RatioConfigData = {
  model_ratio?: Record<string, number | undefined>;
  completion_ratio?: Record<string, number | undefined>;
};

export type N1nPricingSyncResult = {
  source: "n1n.ai";
  fetchedAt: string;
  upserted: number;
  skipped: number;
};

@Injectable()
export class N1nPricingSyncService {
  private readonly logger = new Logger(N1nPricingSyncService.name);

  constructor(
    @InjectRepository(CloudTokenPricingCatalogEntity)
    private readonly pricing: Repository<CloudTokenPricingCatalogEntity>,
  ) {}

  async syncFromN1n(): Promise<N1nPricingSyncResult> {
    const data = await this.fetchRatioConfig();
    const modelRatio = data.model_ratio ?? {};
    const completionRatio = data.completion_ratio ?? {};

    const rows: Array<Partial<CloudTokenPricingCatalogEntity>> = [];
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

      // entity stores millicents per 1k tokens (1 USD = 100 cents = 100_000 millicents).
      // input millicents = USD/1k * 100_000.
      // existing convention (token-usage.service.ts:565) uses
      //   inputPer1kMillicents = inputPer1kTokens * 1000
      // i.e. the field stores (currency-unit/1k tokens) * 1000.
      // We follow that contract exactly for read-side compatibility.
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

    const fetchedAt = new Date().toISOString();
    this.logger.log(
      `Synced n1n.ai pricing: upserted=${upserted}, skipped=${skipped}`,
    );

    return {
      source: "n1n.ai",
      fetchedAt,
      upserted,
      skipped,
    };
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
