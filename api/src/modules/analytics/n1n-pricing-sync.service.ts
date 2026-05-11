// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiUsageLedgerEntity } from './ai-usage-ledger.entity';
import { AiUsageLedgerService } from './ai-usage-ledger.service';

const N1N_RATIO_CONFIG_URL = 'https://api.n1n.ai/api/ratio_config';
const FETCH_TIMEOUT_MS = 15_000;
// n1n.ai (and one-api / new-api forks) normalize prices so that
//   model_ratio = 1 means $0.002 per 1k input tokens (= $2 per 1M).
const N1N_BASE_PRICE_USD_PER_1K = 0.002;
const TARGET_CURRENCY: 'USD' = 'USD';
const RECOMPUTE_BATCH_SIZE = 500;

type RatioConfigData = {
  model_ratio?: Record<string, number | undefined>;
  completion_ratio?: Record<string, number | undefined>;
};

type PrecisePrice = {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
};

export type N1nPricingSyncResult = {
  source: 'n1n.ai';
  fetchedAt: string;
  catalogItems: number;
  recomputedRows: number;
};

@Injectable()
export class N1nPricingSyncService {
  private readonly logger = new Logger(N1nPricingSyncService.name);

  constructor(
    @InjectRepository(AiUsageLedgerEntity)
    private readonly ledger: Repository<AiUsageLedgerEntity>,
    private readonly usageLedger: AiUsageLedgerService,
  ) {}

  async syncFromN1n(): Promise<N1nPricingSyncResult> {
    const data = await this.fetchRatioConfig();
    const modelRatio = data.model_ratio ?? {};
    const completionRatio = data.completion_ratio ?? {};

    const items: Array<{
      model: string;
      inputPer1kTokens: number;
      outputPer1kTokens: number;
      enabled: boolean;
      note: string;
    }> = [];
    const precise = new Map<string, PrecisePrice>();

    for (const [model, rawRatio] of Object.entries(modelRatio)) {
      const trimmed = (model ?? '').trim();
      if (!trimmed) continue;
      const ratio = Number(rawRatio);
      if (!Number.isFinite(ratio) || ratio <= 0) continue;

      const compRaw = Number(completionRatio[trimmed]);
      const compRatio =
        Number.isFinite(compRaw) && compRaw > 0 ? compRaw : 1;

      const inputUsdPer1k = ratio * N1N_BASE_PRICE_USD_PER_1K;
      const outputUsdPer1k = inputUsdPer1k * compRatio;

      items.push({
        model: trimmed,
        inputPer1kTokens: inputUsdPer1k,
        outputPer1kTokens: outputUsdPer1k,
        enabled: true,
        note: 'Synced from n1n.ai',
      });
      precise.set(trimmed, { inputUsdPer1k, outputUsdPer1k });
    }

    await this.usageLedger.setPricingCatalog({
      currency: TARGET_CURRENCY,
      items,
    });

    const recomputedRows = await this.recomputeLedgerCosts(precise);

    this.logger.log(
      `Synced n1n.ai pricing into local catalog: items=${items.length}, recomputedRows=${recomputedRows}`,
    );

    return {
      source: 'n1n.ai',
      fetchedAt: new Date().toISOString(),
      catalogItems: items.length,
      recomputedRows,
    };
  }

  /**
   * Walks ai_usage_ledger and recomputes estimatedCost / unit prices / currency
   * for every row whose model is present in the new catalog. Rows with unknown
   * models are left untouched so we don't overwrite previously stored numbers
   * with zeros.
   */
  private async recomputeLedgerCosts(
    precise: Map<string, PrecisePrice>,
  ): Promise<number> {
    if (precise.size === 0) return 0;

    const knownModels = Array.from(precise.keys());
    const rows = await this.ledger.find({
      where: { model: In(knownModels) },
    });
    if (rows.length === 0) return 0;

    for (const row of rows) {
      const price = precise.get(row.model ?? '');
      if (!price) continue;

      const promptTokens = row.promptTokens ?? 0;
      const completionTokens = row.completionTokens ?? 0;
      const cost =
        (promptTokens / 1000) * price.inputUsdPer1k +
        (completionTokens / 1000) * price.outputUsdPer1k;
      row.inputUnitPrice = price.inputUsdPer1k;
      row.outputUnitPrice = price.outputUsdPer1k;
      row.estimatedCost = Math.max(0, Number(cost.toFixed(8)));
      row.currency = TARGET_CURRENCY;
    }

    for (let i = 0; i < rows.length; i += RECOMPUTE_BATCH_SIZE) {
      await this.ledger.save(rows.slice(i, i + RECOMPUTE_BATCH_SIZE));
    }
    return rows.length;
  }

  private async fetchRatioConfig(): Promise<RatioConfigData> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(N1N_RATIO_CONFIG_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
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
          `n1n.ai ratio_config response invalid: ${body?.message ?? 'no data'}`,
        );
      }
      return body.data;
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new BadGatewayException('n1n.ai ratio_config request timed out');
      }
      if (error instanceof BadGatewayException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(
        `Failed to fetch n1n.ai ratio_config: ${message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
// i18n-ignore-end
