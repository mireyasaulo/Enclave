// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type {
  CloudTokenPricingCatalogResponse,
  CloudTokenPricingItem,
  CloudTokenUsageBreakdownPushItem,
  CloudTokenUsageBudgetItem,
  CloudTokenUsageBudgetResponse,
  CloudTokenUsageDailyPushPayload,
  CloudTokenUsageOverviewResponse,
  CloudTokenUsageWorldConfigResponse,
  CloudTokenUsageWorldListResponse,
  CloudTokenUsageWorldRow,
  TokenPricingCatalog,
  TokenUsageBreakdownItem,
  TokenUsageBreakdownResponse,
  TokenUsageBudgetEnforcement,
  TokenUsageBudgetMetric,
  TokenUsageBudgetRule,
  TokenUsageTrendPoint,
  UpdateCloudTokenUsageBudgetRequest,
  UpsertCloudTokenPricingRequest,
} from "@yinjie/contracts";
import { Between, In, IsNull, Repository } from "typeorm";
import { CloudTokenPricingCatalogEntity } from "../entities/cloud-token-pricing-catalog.entity";
import { CloudTokenUsageBreakdownDailyEntity } from "../entities/cloud-token-usage-breakdown-daily.entity";
import { CloudTokenUsageBudgetEntity } from "../entities/cloud-token-usage-budget.entity";
import { CloudTokenUsageDailyEntity } from "../entities/cloud-token-usage-daily.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import { isRequestGatePlaceholderWorld } from "../request-gate-placeholder";

const ALLOWED_DIMENSIONS: ReadonlyArray<
  CloudTokenUsageBreakdownPushItem["dimension"]
> = ["character", "conversation", "scene", "model", "billingSource"];

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COST_PRECISION_SCALE = 100; // store cents as integer

type RangeFilter = { from: string; to: string };

type WorldsSortKey = "tokens" | "cost" | "requests" | "failureRate";

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);

  constructor(
    @InjectRepository(CloudTokenUsageDailyEntity)
    private readonly daily: Repository<CloudTokenUsageDailyEntity>,
    @InjectRepository(CloudTokenUsageBreakdownDailyEntity)
    private readonly breakdown: Repository<CloudTokenUsageBreakdownDailyEntity>,
    @InjectRepository(CloudTokenUsageBudgetEntity)
    private readonly budgets: Repository<CloudTokenUsageBudgetEntity>,
    @InjectRepository(CloudTokenPricingCatalogEntity)
    private readonly pricing: Repository<CloudTokenPricingCatalogEntity>,
    @InjectRepository(CloudWorldEntity)
    private readonly worlds: Repository<CloudWorldEntity>,
  ) {}

  // -------- Push (runtime ingest) --------

  async ingestDaily(
    payload: CloudTokenUsageDailyPushPayload,
    headerToken: string | undefined,
  ): Promise<{ ok: true }> {
    const worldId = (payload.worldId ?? "").trim();
    if (!worldId) {
      throw new BadRequestException("worldId is required.");
    }
    const bucketDate = (payload.bucketDate ?? "").trim();
    if (!DATE_RE.test(bucketDate)) {
      throw new BadRequestException("bucketDate must be YYYY-MM-DD.");
    }

    const world = await this.worlds.findOne({ where: { id: worldId } });
    if (!world || isRequestGatePlaceholderWorld(world)) {
      throw new NotFoundException("World not found.");
    }
    this.assertCallbackToken(world, headerToken, payload.callbackToken);

    const overview = payload.overview;
    if (!overview) {
      throw new BadRequestException("overview is required.");
    }
    const syncedAt = new Date();
    const currency = overview.currency ?? "CNY";

    const existingDaily = await this.daily.findOne({
      where: { worldId, bucketDate },
    });
    const dailyRow =
      existingDaily ??
      this.daily.create({
        worldId,
        bucketDate,
      });
    dailyRow.currency = currency;
    dailyRow.promptTokens = toInt(overview.promptTokens);
    dailyRow.completionTokens = toInt(overview.completionTokens);
    dailyRow.totalTokens = toInt(overview.totalTokens);
    dailyRow.estimatedCostCents = toCents(overview.estimatedCost);
    dailyRow.requestCount = toInt(overview.requestCount);
    dailyRow.successCount = toInt(overview.successCount);
    dailyRow.failedCount = toInt(overview.failedCount);
    dailyRow.activeCharacterCount = toInt(overview.activeCharacterCount);
    dailyRow.syncedAt = syncedAt;
    await this.daily.save(dailyRow);

    const incoming = Array.isArray(payload.breakdowns) ? payload.breakdowns : [];
    const sanitizedKeys = new Set<string>();
    for (const item of incoming) {
      if (!ALLOWED_DIMENSIONS.includes(item.dimension)) continue;
      const key = (item.key ?? "").trim() || "__unknown__";
      const dedupeKey = `${item.dimension}::${key}`;
      if (sanitizedKeys.has(dedupeKey)) continue;
      sanitizedKeys.add(dedupeKey);

      const existing = await this.breakdown.findOne({
        where: { worldId, bucketDate, dimension: item.dimension, key },
      });
      const row =
        existing ??
        this.breakdown.create({
          worldId,
          bucketDate,
          dimension: item.dimension,
          key,
        });
      row.label = (item.label ?? null) || null;
      row.currency = currency;
      row.promptTokens = toInt(item.promptTokens);
      row.completionTokens = toInt(item.completionTokens);
      row.totalTokens = toInt(item.totalTokens);
      row.estimatedCostCents = toCents(item.estimatedCost);
      row.requestCount = toInt(item.requestCount);
      row.successCount = toInt(item.successCount);
      row.failedCount = toInt(item.failedCount);
      row.syncedAt = syncedAt;
      await this.breakdown.save(row);
    }

    // Drop stale breakdown rows for the bucket that were not in this push.
    const stale = await this.breakdown.find({
      where: { worldId, bucketDate },
    });
    const removable = stale.filter(
      (row) => !sanitizedKeys.has(`${row.dimension}::${row.key}`),
    );
    if (removable.length > 0) {
      await this.breakdown.remove(removable);
    }

    return { ok: true };
  }

  // -------- Read (admin) --------

  async getOverview(
    range: Partial<RangeFilter>,
  ): Promise<CloudTokenUsageOverviewResponse> {
    const { from, to } = this.normalizeRange(range);
    const rows = await this.daily.find({
      where: this.buildDailyWhere(from, to),
    });

    const promptTokens = sum(rows, "promptTokens");
    const completionTokens = sum(rows, "completionTokens");
    const totalTokens = sum(rows, "totalTokens");
    const estimatedCostCents = sum(rows, "estimatedCostCents");
    const requestCount = sum(rows, "requestCount");
    const successCount = sum(rows, "successCount");
    const failedCount = sum(rows, "failedCount");
    const activeCharacterCount = sum(rows, "activeCharacterCount");
    const activeWorldCount = new Set(
      rows.filter((row) => row.totalTokens > 0).map((row) => row.worldId),
    ).size;
    const currency = pickCurrency(rows);

    return {
      currency,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: fromCents(estimatedCostCents),
      requestCount,
      successCount,
      failedCount,
      activeCharacterCount,
      activeWorldCount,
    };
  }

  async getTrends(
    range: Partial<RangeFilter>,
  ): Promise<TokenUsageTrendPoint[]> {
    const { from, to } = this.normalizeRange(range);
    const rows = await this.daily
      .createQueryBuilder("d")
      .select("d.bucketDate", "bucketDate")
      .addSelect("SUM(d.promptTokens)", "promptTokens")
      .addSelect("SUM(d.completionTokens)", "completionTokens")
      .addSelect("SUM(d.totalTokens)", "totalTokens")
      .addSelect("SUM(d.estimatedCostCents)", "estimatedCostCents")
      .addSelect("SUM(d.requestCount)", "requestCount")
      .addSelect("SUM(d.successCount)", "successCount")
      .addSelect("SUM(d.failedCount)", "failedCount")
      .where("d.bucketDate >= :from AND d.bucketDate <= :to", { from, to })
      .groupBy("d.bucketDate")
      .orderBy("d.bucketDate", "ASC")
      .getRawMany<{
        bucketDate: string;
        promptTokens: string | number;
        completionTokens: string | number;
        totalTokens: string | number;
        estimatedCostCents: string | number;
        requestCount: string | number;
        successCount: string | number;
        failedCount: string | number;
      }>();

    return rows.map((row) => ({
      bucketStart: row.bucketDate,
      label: row.bucketDate,
      promptTokens: toInt(row.promptTokens),
      completionTokens: toInt(row.completionTokens),
      totalTokens: toInt(row.totalTokens),
      estimatedCost: fromCents(toInt(row.estimatedCostCents)),
      requestCount: toInt(row.requestCount),
      successCount: toInt(row.successCount),
      failedCount: toInt(row.failedCount),
    }));
  }

  async listWorlds(filters: {
    from?: string;
    to?: string;
    sort?: WorldsSortKey;
    dir?: "asc" | "desc";
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<CloudTokenUsageWorldListResponse> {
    const { from, to } = this.normalizeRange(filters);
    const sort: WorldsSortKey = filters.sort ?? "tokens";
    const dir: "asc" | "desc" = filters.dir === "asc" ? "asc" : "desc";
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const aggregated = await this.daily
      .createQueryBuilder("d")
      .select("d.worldId", "worldId")
      .addSelect("MAX(d.currency)", "currency")
      .addSelect("SUM(d.promptTokens)", "promptTokens")
      .addSelect("SUM(d.completionTokens)", "completionTokens")
      .addSelect("SUM(d.totalTokens)", "totalTokens")
      .addSelect("SUM(d.estimatedCostCents)", "estimatedCostCents")
      .addSelect("SUM(d.requestCount)", "requestCount")
      .addSelect("SUM(d.successCount)", "successCount")
      .addSelect("SUM(d.failedCount)", "failedCount")
      .addSelect("MAX(d.activeCharacterCount)", "activeCharacterCount")
      .addSelect("MAX(d.syncedAt)", "lastSyncedAt")
      .where("d.bucketDate >= :from AND d.bucketDate <= :to", { from, to })
      .groupBy("d.worldId")
      .getRawMany<{
        worldId: string;
        currency: string | null;
        promptTokens: string | number;
        completionTokens: string | number;
        totalTokens: string | number;
        estimatedCostCents: string | number;
        requestCount: string | number;
        successCount: string | number;
        failedCount: string | number;
        activeCharacterCount: string | number;
        lastSyncedAt: string | null;
      }>();

    if (aggregated.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }

    const worldIds = aggregated.map((row) => row.worldId);
    const worldRows =
      worldIds.length > 0
        ? await this.worlds.find({ where: { id: In(worldIds) } })
        : [];
    const worldsById = new Map(worldRows.map((world) => [world.id, world]));
    const search = (filters.search ?? "").trim().toLowerCase();

    let items: CloudTokenUsageWorldRow[] = aggregated.map((row) => {
      const world = worldsById.get(row.worldId);
      const requestCount = toInt(row.requestCount);
      const failedCount = toInt(row.failedCount);
      const currency: "CNY" | "USD" =
        row.currency === "USD" ? "USD" : "CNY";
      return {
        worldId: row.worldId,
        worldSlug: world?.slug ?? null,
        worldName: world?.name ?? world?.slug ?? null,
        currency,
        promptTokens: toInt(row.promptTokens),
        completionTokens: toInt(row.completionTokens),
        totalTokens: toInt(row.totalTokens),
        estimatedCost: fromCents(toInt(row.estimatedCostCents)),
        requestCount,
        successCount: toInt(row.successCount),
        failedCount,
        activeCharacterCount: toInt(row.activeCharacterCount),
        failureRate: requestCount > 0 ? failedCount / requestCount : null,
        lastSyncedAt: row.lastSyncedAt ?? null,
      };
    });

    if (search) {
      items = items.filter((row) => {
        const haystack = `${row.worldName ?? ""} ${row.worldSlug ?? ""} ${row.worldId}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    items.sort((a, b) => {
      const left = sortValue(a, sort);
      const right = sortValue(b, sort);
      const comparison = (left ?? 0) - (right ?? 0);
      return dir === "asc" ? comparison : -comparison;
    });

    const total = items.length;
    const sliced = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: sliced, total, page, pageSize };
  }

  async getWorldBreakdown(
    worldId: string,
    range: Partial<RangeFilter>,
  ): Promise<TokenUsageBreakdownResponse> {
    const { from, to } = this.normalizeRange(range);
    const rows = await this.breakdown
      .createQueryBuilder("b")
      .select("b.dimension", "dimension")
      .addSelect("b.key", "key")
      .addSelect("MAX(b.label)", "label")
      .addSelect("SUM(b.promptTokens)", "promptTokens")
      .addSelect("SUM(b.completionTokens)", "completionTokens")
      .addSelect("SUM(b.totalTokens)", "totalTokens")
      .addSelect("SUM(b.estimatedCostCents)", "estimatedCostCents")
      .addSelect("SUM(b.requestCount)", "requestCount")
      .addSelect("SUM(b.successCount)", "successCount")
      .addSelect("SUM(b.failedCount)", "failedCount")
      .where("b.worldId = :worldId", { worldId })
      .andWhere("b.bucketDate >= :from AND b.bucketDate <= :to", { from, to })
      .groupBy("b.dimension")
      .addGroupBy("b.key")
      .getRawMany<{
        dimension: string;
        key: string;
        label: string | null;
        promptTokens: string | number;
        completionTokens: string | number;
        totalTokens: string | number;
        estimatedCostCents: string | number;
        requestCount: string | number;
        successCount: string | number;
        failedCount: string | number;
      }>();

    const buckets: Record<string, TokenUsageBreakdownItem[]> = {
      character: [],
      conversation: [],
      scene: [],
      model: [],
      billingSource: [],
    };

    for (const row of rows) {
      const item: TokenUsageBreakdownItem = {
        key: row.key,
        label: row.label ?? row.key,
        promptTokens: toInt(row.promptTokens),
        completionTokens: toInt(row.completionTokens),
        totalTokens: toInt(row.totalTokens),
        estimatedCost: fromCents(toInt(row.estimatedCostCents)),
        requestCount: toInt(row.requestCount),
        successCount: toInt(row.successCount),
        failedCount: toInt(row.failedCount),
      };
      if (buckets[row.dimension]) {
        buckets[row.dimension].push(item);
      }
    }

    for (const list of Object.values(buckets)) {
      list.sort((a, b) => b.totalTokens - a.totalTokens);
    }

    const dailyRows = await this.daily.find({
      where: { worldId },
      take: 1,
      order: { bucketDate: "DESC" },
    });
    const currency = (dailyRows[0]?.currency as "CNY" | "USD" | undefined) ?? "CNY";

    return {
      currency,
      byCharacter: buckets.character,
      byConversation: buckets.conversation,
      byScene: buckets.scene,
      byModel: buckets.model,
      byBillingSource: buckets.billingSource,
    };
  }

  async getWorldDaily(worldId: string, range: Partial<RangeFilter>) {
    const { from, to } = this.normalizeRange(range);
    const rows = await this.daily.find({
      where: this.buildDailyWhere(from, to, worldId),
      order: { bucketDate: "ASC" },
    });
    return rows.map((row) => ({
      bucketDate: row.bucketDate,
      currency: row.currency,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      estimatedCost: fromCents(row.estimatedCostCents),
      requestCount: row.requestCount,
      successCount: row.successCount,
      failedCount: row.failedCount,
      activeCharacterCount: row.activeCharacterCount,
      syncedAt: row.syncedAt.toISOString(),
    }));
  }

  // -------- World config snapshot (for runtime pull) --------

  async getWorldConfigSnapshot(
    worldId: string,
    headerToken: string | undefined,
  ): Promise<CloudTokenUsageWorldConfigResponse> {
    const trimmed = (worldId ?? "").trim();
    if (!trimmed) {
      throw new BadRequestException("worldId is required.");
    }
    const world = await this.worlds.findOne({ where: { id: trimmed } });
    if (!world || isRequestGatePlaceholderWorld(world)) {
      throw new NotFoundException("World not found.");
    }
    this.assertCallbackToken(world, headerToken, null);

    const [globalRow, worldRow] = await Promise.all([
      this.budgets.findOne({ where: { worldId: IsNull() } }),
      this.budgets.findOne({ where: { worldId: trimmed } }),
    ]);
    const global = globalRow ? this.toBudgetItem(globalRow) : null;
    const worldItem = worldRow ? this.toBudgetItem(worldRow) : null;
    const resolved = worldItem ?? global;

    const pricingRows = await this.pricing.find({
      where: { enabled: true },
      order: { currency: "ASC", model: "ASC" },
    });
    const pricing: TokenPricingCatalog | null =
      pricingRows.length === 0
        ? null
        : {
            currency:
              (pricingRows[0]?.currency as "CNY" | "USD" | undefined) ?? "CNY",
            items: pricingRows.map((row) => ({
              model: row.model,
              inputPer1kTokens: row.inputPer1kMillicents / 1000,
              outputPer1kTokens: row.outputPer1kMillicents / 1000,
              enabled: Boolean(row.enabled),
              note: row.note ?? undefined,
            })),
          };

    return {
      worldId: trimmed,
      budget: { global, world: worldItem, resolved },
      pricing,
      generatedAt: new Date().toISOString(),
    };
  }

  // -------- Budget --------

  async getBudgets(): Promise<CloudTokenUsageBudgetResponse> {
    const rows = await this.budgets.find({
      order: { worldId: "ASC", updatedAt: "DESC" },
    });
    const global = rows.find((row) => row.worldId === null) ?? null;
    const worlds = rows.filter((row) => row.worldId !== null);
    return {
      global: global ? this.toBudgetItem(global) : null,
      worlds: worlds.map((row) => this.toBudgetItem(row)),
    };
  }

  async upsertBudget(
    body: UpdateCloudTokenUsageBudgetRequest,
  ): Promise<CloudTokenUsageBudgetItem> {
    const rule = this.normalizeBudgetRule(body.rule);
    const worldId = body.worldId === null ? null : (body.worldId ?? "").trim();
    if (worldId !== null && !worldId) {
      throw new BadRequestException("worldId is required.");
    }
    const existing = await this.budgets.findOne({
      where: worldId === null ? { worldId: IsNull() } : { worldId },
    });
    const row = existing ?? this.budgets.create({ worldId });
    row.enabled = rule.enabled;
    row.metric = rule.metric;
    row.enforcement = rule.enforcement ?? "monitor";
    row.downgradeModel = rule.downgradeModel ?? null;
    row.dailyLimit = rule.dailyLimit ?? null;
    row.monthlyLimit = rule.monthlyLimit ?? null;
    row.warningRatio = rule.warningRatio ?? 0.8;
    row.note = body.rule.note ?? null;
    await this.budgets.save(row);
    return this.toBudgetItem(row);
  }

  async deleteBudget(worldId: string): Promise<{ ok: true }> {
    const trimmed = (worldId ?? "").trim();
    if (!trimmed) {
      throw new BadRequestException("worldId is required.");
    }
    await this.budgets.delete({ worldId: trimmed });
    return { ok: true };
  }

  // -------- Pricing --------

  async getPricingCatalog(): Promise<CloudTokenPricingCatalogResponse> {
    const rows = await this.pricing.find({
      order: { currency: "ASC", model: "ASC" },
    });
    return { items: rows.map((row) => this.toPricingItem(row)) };
  }

  async upsertPricing(
    body: UpsertCloudTokenPricingRequest,
  ): Promise<CloudTokenPricingItem> {
    const currency = body.currency === "USD" ? "USD" : "CNY";
    const model = (body.model ?? "").trim();
    if (!model) {
      throw new BadRequestException("model is required.");
    }
    const existing = await this.pricing.findOne({ where: { currency, model } });
    const row = existing ?? this.pricing.create({ currency, model });
    row.inputPer1kMillicents = Math.max(
      0,
      Math.round(toNumber(body.inputPer1kTokens) * 1000),
    );
    row.outputPer1kMillicents = Math.max(
      0,
      Math.round(toNumber(body.outputPer1kTokens) * 1000),
    );
    row.enabled = body.enabled !== false;
    row.note = body.note ?? null;
    await this.pricing.save(row);
    return this.toPricingItem(row);
  }

  async deletePricing(currency: "CNY" | "USD", model: string): Promise<{ ok: true }> {
    const trimmed = (model ?? "").trim();
    if (!trimmed) {
      throw new BadRequestException("model is required.");
    }
    await this.pricing.delete({ currency, model: trimmed });
    return { ok: true };
  }

  // -------- Helpers --------

  private buildDailyWhere(from: string, to: string, worldId?: string) {
    if (worldId) {
      return { worldId, bucketDate: Between(from, to) };
    }
    return { bucketDate: Between(from, to) };
  }

  private normalizeRange(range: Partial<RangeFilter>) {
    const today = new Date();
    const fallbackTo = isoDate(today);
    const fallbackFrom = isoDate(new Date(today.getTime() - 29 * 86_400_000));
    const from = (range.from ?? fallbackFrom).slice(0, 10);
    const to = (range.to ?? fallbackTo).slice(0, 10);
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new BadRequestException("from / to must be YYYY-MM-DD.");
    }
    if (from > to) {
      throw new BadRequestException("from must be <= to.");
    }
    return { from, to };
  }

  private normalizeBudgetRule(rule: TokenUsageBudgetRule): TokenUsageBudgetRule {
    const metric: TokenUsageBudgetMetric = rule.metric === "cost" ? "cost" : "tokens";
    const enforcement: TokenUsageBudgetEnforcement =
      rule.enforcement === "downgrade"
        ? "downgrade"
        : rule.enforcement === "block"
          ? "block"
          : "monitor";
    return {
      enabled: Boolean(rule.enabled),
      metric,
      enforcement,
      downgradeModel: rule.downgradeModel ?? null,
      dailyLimit:
        rule.dailyLimit === null || rule.dailyLimit === undefined
          ? null
          : Math.max(0, Math.floor(rule.dailyLimit)),
      monthlyLimit:
        rule.monthlyLimit === null || rule.monthlyLimit === undefined
          ? null
          : Math.max(0, Math.floor(rule.monthlyLimit)),
      warningRatio:
        rule.warningRatio === undefined || rule.warningRatio === null
          ? 0.8
          : Math.max(0, Math.min(1, Number(rule.warningRatio) || 0.8)),
    };
  }

  private toBudgetItem(row: CloudTokenUsageBudgetEntity): CloudTokenUsageBudgetItem {
    return {
      worldId: row.worldId,
      enabled: Boolean(row.enabled),
      metric: (row.metric as TokenUsageBudgetMetric) ?? "tokens",
      enforcement:
        (row.enforcement as TokenUsageBudgetEnforcement) ?? "monitor",
      downgradeModel: row.downgradeModel,
      dailyLimit: row.dailyLimit,
      monthlyLimit: row.monthlyLimit,
      warningRatio: row.warningRatio,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPricingItem(row: CloudTokenPricingCatalogEntity): CloudTokenPricingItem {
    return {
      id: row.id,
      currency: (row.currency as "CNY" | "USD") ?? "CNY",
      model: row.model,
      inputPer1kTokens: row.inputPer1kMillicents / 1000,
      outputPer1kTokens: row.outputPer1kMillicents / 1000,
      enabled: Boolean(row.enabled),
      note: row.note ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private assertCallbackToken(
    world: Pick<CloudWorldEntity, "callbackToken">,
    headerToken?: string,
    bodyToken?: string | null,
  ) {
    const expected = (world.callbackToken ?? "").trim();
    const actual = (headerToken ?? "").trim() || (bodyToken ?? "").trim();
    if (!expected) {
      throw new UnauthorizedException("World callback token is not configured.");
    }
    if (!actual || actual !== expected) {
      throw new UnauthorizedException("Invalid world callback token.");
    }
  }
}

function sum<T>(rows: T[], key: keyof T): number {
  let total = 0;
  for (const row of rows) {
    const value = row[key] as unknown;
    total += typeof value === "number" ? value : Number(value) || 0;
  }
  return total;
}

function pickCurrency(rows: Array<{ currency?: string | null }>): "CNY" | "USD" {
  for (const row of rows) {
    if (row.currency === "CNY" || row.currency === "USD") {
      return row.currency;
    }
  }
  return "CNY";
}

function sortValue(
  row: CloudTokenUsageWorldRow,
  sort: WorldsSortKey,
): number | null {
  switch (sort) {
    case "tokens":
      return row.totalTokens;
    case "cost":
      return row.estimatedCost;
    case "requests":
      return row.requestCount;
    case "failureRate":
      return row.failureRate ?? 0;
    default:
      return row.totalTokens;
  }
}

function toInt(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCents(value: unknown): number {
  return Math.max(0, Math.round(toNumber(value) * COST_PRECISION_SCALE));
}

function fromCents(cents: number): number {
  return cents / COST_PRECISION_SCALE;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// i18n-ignore-end
