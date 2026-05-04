import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type {
  RevenueAllocationLedgerItem,
  RevenueAllocationStatus,
  RevenueContributionEventInput,
  RevenueContributionEventSummary,
  RevenueContributionEventType,
  RevenueContributionWeightRule,
  RevenueEventIngestResponse,
  RevenueEventListResponse,
  RevenueEventPriceRule,
  RevenueFixedShareRule,
  RevenueLedgerListResponse,
  RevenuePayeeExternalRefType,
  RevenuePayeeStatus,
  RevenuePayeeSummary,
  RevenueParticipantType,
  RevenueSettlementBatchSummary,
  RevenueSettlementPreviewRequest,
  RevenueSettlementPreviewResponse,
  RevenueSharingPolicyConfig,
  RevenueSharingPolicySummary,
  RevenueUsageEventInput,
  RevenueUsageEventSummary,
  RevenueUsageEventType,
  UpdateRevenueSharingPolicyRequest,
  UpsertRevenuePayeeRequest,
} from "@yinjie/contracts";
import { Between, DataSource, FindOptionsWhere, In, IsNull, Repository } from "typeorm";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import { RevenueAllocationLedgerEntity } from "../entities/revenue-allocation-ledger.entity";
import { RevenueContributionEventEntity } from "../entities/revenue-contribution-event.entity";
import { RevenuePayeeEntity } from "../entities/revenue-payee.entity";
import { RevenueSettlementBatchEntity } from "../entities/revenue-settlement-batch.entity";
import { RevenueSharingPolicyEntity } from "../entities/revenue-sharing-policy.entity";
import { RevenueUsageEventEntity } from "../entities/revenue-usage-event.entity";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EVENT_PRICES: RevenueEventPriceRule[] = [
  { eventType: "character_chat_message", unitAmountCents: 0 },
  { eventType: "character_voice_turn", unitAmountCents: 0 },
  { eventType: "character_video_turn", unitAmountCents: 0 },
  { eventType: "character_content_use", unitAmountCents: 0 },
  { eventType: "character_logic_run", unitAmountCents: 0 },
];
const DEFAULT_FIXED_SHARES: RevenueFixedShareRule[] = [
  { participantType: "platform", basisPoints: 3000, payeeId: null },
  { participantType: "world_owner", basisPoints: 2000, payeeId: null },
  { participantType: "runtime_operator", basisPoints: 1000, payeeId: null },
];
const DEFAULT_CONTRIBUTION_WEIGHTS: RevenueContributionWeightRule[] = [
  {
    eventType: "character_create",
    participantType: "character_creator",
    weight: 30,
  },
  {
    eventType: "character_content_edit_approved",
    participantType: "character_editor",
    weight: 12,
  },
  {
    eventType: "character_logic_edit_approved",
    participantType: "character_editor",
    weight: 18,
  },
  {
    eventType: "character_review_approved",
    participantType: "character_reviewer",
    weight: 5,
  },
  {
    eventType: "character_patrol",
    participantType: "character_patroller",
    weight: 2,
  },
  {
    eventType: "character_logic_publish",
    participantType: "logic_publisher",
    weight: 20,
  },
];
const DEFAULT_POLICY_CONFIG: RevenueSharingPolicyConfig = {
  enabled: false,
  currency: "CNY",
  eventPrices: DEFAULT_EVENT_PRICES,
  fixedShares: DEFAULT_FIXED_SHARES,
  contributionPoolBasisPoints: 4000,
  contributionWeights: DEFAULT_CONTRIBUTION_WEIGHTS,
  contributionWindowDays: 180,
  minimumSettlementCents: 100,
};
const VALID_USAGE_EVENT_TYPES = new Set<RevenueUsageEventType>(
  DEFAULT_EVENT_PRICES.map((item) => item.eventType),
);
const VALID_CONTRIBUTION_EVENT_TYPES = new Set<RevenueContributionEventType>(
  DEFAULT_CONTRIBUTION_WEIGHTS.map((item) => item.eventType),
);
const VALID_EXTERNAL_REF_TYPES = new Set<RevenuePayeeExternalRefType>([
  "world_owner",
  "wiki_user",
  "character",
  "system",
  "provider",
  "runtime_operator",
]);
const VALID_PAYEE_STATUSES = new Set<RevenuePayeeStatus>([
  "pending",
  "active",
  "paused",
  "archived",
]);
const VALID_FIXED_PARTICIPANTS = new Set<RevenueFixedShareRule["participantType"]>([
  "platform",
  "world_owner",
  "runtime_operator",
]);
const VALID_CONTRIBUTION_PARTICIPANTS = new Set<
  RevenueContributionWeightRule["participantType"]
>([
  "character_creator",
  "character_editor",
  "character_reviewer",
  "character_patroller",
  "logic_publisher",
]);

type AllocationDraft = {
  payeeId: string | null;
  participantType: RevenueParticipantType;
  sourceType: "fixed" | "contribution" | "unassigned_hold";
  amountCents: number;
  contributionScore: number | null;
};

@Injectable()
export class RevenueSharingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CloudWorldEntity)
    private readonly worldRepo: Repository<CloudWorldEntity>,
    @InjectRepository(RevenueSharingPolicyEntity)
    private readonly policyRepo: Repository<RevenueSharingPolicyEntity>,
    @InjectRepository(RevenuePayeeEntity)
    private readonly payeeRepo: Repository<RevenuePayeeEntity>,
    @InjectRepository(RevenueContributionEventEntity)
    private readonly contributionRepo: Repository<RevenueContributionEventEntity>,
    @InjectRepository(RevenueUsageEventEntity)
    private readonly usageRepo: Repository<RevenueUsageEventEntity>,
    @InjectRepository(RevenueAllocationLedgerEntity)
    private readonly allocationRepo: Repository<RevenueAllocationLedgerEntity>,
    @InjectRepository(RevenueSettlementBatchEntity)
    private readonly settlementRepo: Repository<RevenueSettlementBatchEntity>,
  ) {}

  async getPolicy(): Promise<RevenueSharingPolicySummary> {
    const policy = await this.policyRepo.findOne({
      where: {},
      order: { version: "DESC", createdAt: "DESC" },
    });
    if (!policy) {
      return {
        id: "default",
        version: 0,
        status: "inactive",
        config: this.clonePolicyConfig(DEFAULT_POLICY_CONFIG),
        createdBy: null,
        activatedAt: null,
        createdAt: new Date(0).toISOString(),
      };
    }
    return this.serializePolicy(policy);
  }

  async updatePolicy(
    input: UpdateRevenueSharingPolicyRequest,
    actor: string,
  ): Promise<RevenueSharingPolicySummary> {
    const current = await this.getPolicy();
    const nextConfig = this.normalizePolicyConfig({
      ...current.config,
      ...input,
    });
    const status = nextConfig.enabled ? "active" : "inactive";
    const latest = await this.policyRepo.findOne({
      where: {},
      order: { version: "DESC", createdAt: "DESC" },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const saved = await this.dataSource.transaction(async (manager) => {
      if (status === "active") {
        await manager.update(
          RevenueSharingPolicyEntity,
          { status: "active" },
          { status: "inactive" },
        );
      }
      return manager.save(
        manager.create(RevenueSharingPolicyEntity, {
          version: nextVersion,
          status,
          configJson: JSON.stringify(nextConfig),
          createdBy: actor,
          activatedAt: status === "active" ? new Date() : null,
        }),
      );
    });

    return this.serializePolicy(saved);
  }

  async listPayees(): Promise<RevenuePayeeSummary[]> {
    const payees = await this.payeeRepo.find({
      order: { updatedAt: "DESC", createdAt: "DESC" },
    });
    return payees.map((payee) => this.serializePayee(payee));
  }

  async upsertPayee(input: UpsertRevenuePayeeRequest): Promise<RevenuePayeeSummary> {
    const normalized = {
      id: this.trimToNull(input.id),
      displayName: this.requireString(input.displayName, "displayName", 128),
      status: input.status ?? "active",
      externalRefType: this.normalizeExternalRefType(input.externalRefType),
      externalRefId: this.requireString(input.externalRefId, "externalRefId", 255),
      contact: this.trimToNull(input.contact),
      payoutNote: this.trimToNull(input.payoutNote),
    };
    if (!VALID_PAYEE_STATUSES.has(normalized.status)) {
      throw new BadRequestException("收益人状态不合法。");
    }

    const existing = normalized.id
      ? await this.payeeRepo.findOne({ where: { id: normalized.id } })
      : await this.payeeRepo.findOne({
          where: {
            externalRefType: normalized.externalRefType,
            externalRefId: normalized.externalRefId,
          },
        });
    if (normalized.id && !existing) {
      throw new NotFoundException("收益人不存在。");
    }

    const entity =
      existing ??
      this.payeeRepo.create({
        externalRefType: normalized.externalRefType,
        externalRefId: normalized.externalRefId,
      });
    entity.displayName = normalized.displayName;
    entity.status = normalized.status;
    entity.externalRefType = normalized.externalRefType;
    entity.externalRefId = normalized.externalRefId;
    entity.contact = normalized.contact;
    entity.payoutNote = normalized.payoutNote;

    return this.serializePayee(await this.payeeRepo.save(entity));
  }

  async ingestContributionEvents(
    worldId: string,
    events: RevenueContributionEventInput[] | undefined,
    callbackToken?: string,
  ): Promise<RevenueEventIngestResponse> {
    await this.requireRuntimeWorld(worldId, callbackToken);
    const normalizedEvents = Array.isArray(events) ? events.slice(0, 100) : [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const event of normalizedEvents) {
      const normalized = this.normalizeContributionEvent(event);
      const payee = await this.findOrCreatePayeeByExternalRef({
        externalRefType: normalized.contributorExternalRefType,
        externalRefId: normalized.contributorExternalRefId,
        displayName:
          this.trimToNull(event.contributorDisplayName) ??
          `${normalized.contributorExternalRefType}:${normalized.contributorExternalRefId}`,
      });
      const existing = await this.contributionRepo.findOne({
        where: { worldId, sourceEventId: normalized.sourceEventId },
      });
      if (existing) {
        existing.reversedAt = normalized.reversedAt ?? existing.reversedAt;
        existing.contributorPayeeId = payee.id;
        existing.metadataJson = this.stringifyMetadata(normalized.metadata);
        await this.contributionRepo.save(existing);
        updated += 1;
        continue;
      }

      await this.contributionRepo.save(
        this.contributionRepo.create({
          worldId,
          sourceEventId: normalized.sourceEventId,
          eventType: normalized.eventType,
          characterId: normalized.characterId,
          contributorPayeeId: payee.id,
          contributorExternalRefType: normalized.contributorExternalRefType,
          contributorExternalRefId: normalized.contributorExternalRefId,
          occurredAt: normalized.occurredAt,
          reversedAt: normalized.reversedAt,
          metadataJson: this.stringifyMetadata(normalized.metadata),
        }),
      );
      inserted += 1;
    }

    skipped = normalizedEvents.length - inserted - updated;
    return { accepted: normalizedEvents.length, inserted, updated, skipped };
  }

  async ingestUsageEvents(
    worldId: string,
    events: RevenueUsageEventInput[] | undefined,
    callbackToken?: string,
  ): Promise<RevenueEventIngestResponse> {
    const world = await this.requireRuntimeWorld(worldId, callbackToken);
    const normalizedEvents = Array.isArray(events) ? events.slice(0, 100) : [];
    let inserted = 0;
    let skipped = 0;

    for (const event of normalizedEvents) {
      const existing = await this.usageRepo.findOne({
        where: { worldId, sourceEventId: event.sourceEventId },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await this.createUsageEventWithAllocations(world, event);
      inserted += 1;
    }

    return {
      accepted: normalizedEvents.length,
      inserted,
      updated: 0,
      skipped,
    };
  }

  async listEvents(query: {
    worldId?: string;
    characterId?: string;
  }): Promise<RevenueEventListResponse> {
    const where = this.buildWorldCharacterWhere(query);
    const [usageEvents, contributionEvents] = await Promise.all([
      this.usageRepo.find({
        where,
        order: { occurredAt: "DESC", createdAt: "DESC" },
        take: 30,
      }),
      this.contributionRepo.find({
        where,
        order: { occurredAt: "DESC", createdAt: "DESC" },
        take: 30,
      }),
    ]);
    return {
      usageEvents: usageEvents.map((event) => this.serializeUsageEvent(event)),
      contributionEvents: contributionEvents.map((event) =>
        this.serializeContributionEvent(event),
      ),
    };
  }

  async listLedger(query: {
    worldId?: string;
    characterId?: string;
    payeeId?: string;
    status?: RevenueAllocationStatus;
    page?: number;
    pageSize?: number;
  }): Promise<RevenueLedgerListResponse> {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where = this.buildLedgerWhere(query);
    const [items, total] = await this.allocationRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const allMatching = await this.allocationRepo.find({ where });
    const payeeMap = await this.getPayeeMap(items.map((item) => item.payeeId));

    return {
      items: items.map((item) => this.serializeAllocation(item, payeeMap)),
      summary: this.summarizeAllocations(allMatching),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
    };
  }

  async previewSettlement(
    input: RevenueSettlementPreviewRequest,
  ): Promise<RevenueSettlementPreviewResponse> {
    const policy = await this.getPolicy();
    const allocations = await this.findSettlementCandidates(input);
    const payeeMap = await this.getPayeeMap(allocations.map((item) => item.payeeId));
    const grouped = new Map<string, { amountCents: number; allocationCount: number }>();

    for (const allocation of allocations) {
      if (!allocation.payeeId) continue;
      const current = grouped.get(allocation.payeeId) ?? {
        amountCents: 0,
        allocationCount: 0,
      };
      current.amountCents += allocation.amountCents;
      current.allocationCount += 1;
      grouped.set(allocation.payeeId, current);
    }

    const payees = Array.from(grouped.entries())
      .map(([payeeId, group]) => ({
        payeeId,
        payeeDisplayName:
          payeeMap.get(payeeId)?.displayName ?? `Unknown payee ${payeeId}`,
        amountCents: group.amountCents,
        allocationCount: group.allocationCount,
      }))
      .filter((group) => group.amountCents >= policy.config.minimumSettlementCents)
      .sort((left, right) => right.amountCents - left.amountCents);

    return {
      generatedAt: new Date().toISOString(),
      currency: policy.config.currency,
      totalAmountCents: payees.reduce((sum, item) => sum + item.amountCents, 0),
      allocationCount: payees.reduce((sum, item) => sum + item.allocationCount, 0),
      payees,
    };
  }

  async generateSettlement(
    input: RevenueSettlementPreviewRequest,
    actor: string,
  ): Promise<RevenueSettlementBatchSummary> {
    const preview = await this.previewSettlement(input);
    if (preview.totalAmountCents <= 0 || preview.allocationCount <= 0) {
      throw new BadRequestException("没有达到最低结算额的可结算收益。");
    }
    const allowedPayeeIds = new Set(preview.payees.map((payee) => payee.payeeId));
    const allocations = (await this.findSettlementCandidates(input)).filter(
      (allocation) => allocation.payeeId && allowedPayeeIds.has(allocation.payeeId),
    );
    const allocationIds = allocations.map((allocation) => allocation.id);
    const batch = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(RevenueSettlementBatchEntity, {
          status: "generated",
          currency: preview.currency,
          totalAmountCents: preview.totalAmountCents,
          allocationCount: allocations.length,
          periodFrom: this.parseOptionalDate(input.from, "from"),
          periodTo: this.parseOptionalDate(input.to, "to"),
          generatedBy: actor,
          metadataJson: JSON.stringify({ payees: preview.payees }),
        }),
      );
      if (allocationIds.length) {
        await manager.update(
          RevenueAllocationLedgerEntity,
          { id: In(allocationIds) },
          { status: "settled", settlementBatchId: saved.id },
        );
      }
      return saved;
    });

    return this.serializeSettlementBatch(batch);
  }

  private async createUsageEventWithAllocations(
    world: CloudWorldEntity,
    rawEvent: RevenueUsageEventInput,
  ) {
    const event = this.normalizeUsageEvent(rawEvent);
    const policy = await this.getActivePolicy();
    const price = policy?.config.eventPrices.find(
      (item) => item.eventType === event.eventType,
    );
    const unitAmountCents = policy?.config.enabled ? (price?.unitAmountCents ?? 0) : 0;
    const grossAmountCents = unitAmountCents * event.quantity;
    const usage = await this.usageRepo.save(
      this.usageRepo.create({
        worldId: world.id,
        sourceEventId: event.sourceEventId,
        eventType: event.eventType,
        characterId: event.characterId,
        characterName: event.characterName,
        quantity: event.quantity,
        unitAmountCents,
        grossAmountCents,
        currency: policy?.config.currency ?? "CNY",
        policyId: policy?.id ?? null,
        processedAt: new Date(),
        occurredAt: event.occurredAt,
        metadataJson: this.stringifyMetadata(event.metadata),
      }),
    );

    if (!policy || !policy.config.enabled || grossAmountCents <= 0) {
      return usage;
    }

    const allocations = await this.calculateAllocations(world, usage, policy);
    if (allocations.length) {
      const payeeMap = await this.getPayeeMap(
        allocations.map((allocation) => allocation.payeeId),
      );
      await this.allocationRepo.save(
        allocations.map((allocation) =>
          this.allocationRepo.create({
            usageEventId: usage.id,
            worldId: usage.worldId,
            characterId: usage.characterId,
            payeeId: allocation.payeeId,
            participantType: allocation.participantType,
            sourceType: allocation.sourceType,
            amountCents: allocation.amountCents,
            currency: usage.currency,
            contributionScore: allocation.contributionScore,
            status: this.resolveAllocationStatus(allocation, payeeMap),
            settlementBatchId: null,
            policyId: policy.id,
          }),
        ),
      );
    }

    return usage;
  }

  private async calculateAllocations(
    world: CloudWorldEntity,
    usage: RevenueUsageEventEntity,
    policy: RevenueSharingPolicyEntity & { config: RevenueSharingPolicyConfig },
  ): Promise<AllocationDraft[]> {
    const config = policy.config;
    const drafts: AllocationDraft[] = [];
    let configuredTarget = 0;

    for (const share of config.fixedShares) {
      const amountCents = Math.floor(
        (usage.grossAmountCents * share.basisPoints) / 10000,
      );
      configuredTarget += amountCents;
      if (amountCents <= 0) continue;
      drafts.push({
        payeeId: await this.resolveFixedPayeeId(world, share),
        participantType: share.participantType,
        sourceType: "fixed",
        amountCents,
        contributionScore: null,
      });
    }

    const contributionPoolAmount = Math.floor(
      (usage.grossAmountCents * config.contributionPoolBasisPoints) / 10000,
    );
    configuredTarget += contributionPoolAmount;
    if (contributionPoolAmount > 0) {
      drafts.push(
        ...(await this.calculateContributionAllocations(
          usage,
          config,
          contributionPoolAmount,
        )),
      );
    }

    const allocatedConfigured = drafts.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );
    const roundingTail = configuredTarget - allocatedConfigured;
    if (roundingTail > 0) {
      const target = drafts
        .filter((item) => item.sourceType !== "unassigned_hold")
        .sort((left, right) => right.amountCents - left.amountCents)[0];
      if (target) {
        target.amountCents += roundingTail;
      } else {
        drafts.push(this.createHeldAllocation(roundingTail, "unassigned_hold"));
      }
    }

    const unconfiguredHold = usage.grossAmountCents - configuredTarget;
    if (unconfiguredHold > 0) {
      drafts.push(this.createHeldAllocation(unconfiguredHold, "unassigned_hold"));
    }

    return drafts.filter((draft) => draft.amountCents > 0);
  }

  private async calculateContributionAllocations(
    usage: RevenueUsageEventEntity,
    config: RevenueSharingPolicyConfig,
    poolAmountCents: number,
  ): Promise<AllocationDraft[]> {
    const windowStart = new Date(
      usage.occurredAt.getTime() - config.contributionWindowDays * DAY_MS,
    );
    const events = await this.contributionRepo.find({
      where: {
        worldId: usage.worldId,
        characterId: usage.characterId,
        occurredAt: Between(windowStart, usage.occurredAt),
      },
    });
    const weightByType = new Map(
      config.contributionWeights.map((rule) => [rule.eventType, rule]),
    );
    const scoreByKey = new Map<
      string,
      {
        payeeId: string | null;
        participantType: RevenueParticipantType;
        score: number;
      }
    >();

    for (const event of events) {
      if (event.reversedAt) continue;
      const rule = weightByType.get(event.eventType as RevenueContributionEventType);
      if (!rule || rule.weight <= 0) continue;
      const key = `${event.contributorPayeeId ?? "pending"}:${rule.participantType}`;
      const current = scoreByKey.get(key) ?? {
        payeeId: event.contributorPayeeId,
        participantType: rule.participantType,
        score: 0,
      };
      current.score += rule.weight;
      scoreByKey.set(key, current);
    }

    const groups = Array.from(scoreByKey.values()).filter((group) => group.score > 0);
    const totalScore = groups.reduce((sum, item) => sum + item.score, 0);
    if (!groups.length || totalScore <= 0) {
      return [this.createHeldAllocation(poolAmountCents, "unassigned_hold")];
    }

    const drafts = groups.map((group) => ({
      payeeId: group.payeeId,
      participantType: group.participantType,
      sourceType: "contribution" as const,
      amountCents: Math.floor((poolAmountCents * group.score) / totalScore),
      contributionScore: group.score,
    }));
    const allocated = drafts.reduce((sum, item) => sum + item.amountCents, 0);
    const tail = poolAmountCents - allocated;
    if (tail > 0) {
      drafts.sort((left, right) => right.amountCents - left.amountCents)[0].amountCents += tail;
    }
    return drafts;
  }

  private createHeldAllocation(
    amountCents: number,
    sourceType: "contribution" | "unassigned_hold",
  ): AllocationDraft {
    return {
      payeeId: null,
      participantType: "unassigned_hold",
      sourceType,
      amountCents,
      contributionScore: null,
    };
  }

  private async resolveFixedPayeeId(
    world: CloudWorldEntity,
    share: RevenueFixedShareRule,
  ) {
    if (share.payeeId) {
      const payee = await this.payeeRepo.findOne({ where: { id: share.payeeId } });
      return payee?.id ?? null;
    }
    if (share.participantType === "platform") {
      return (
        await this.findOrCreatePayeeByExternalRef({
          externalRefType: "system",
          externalRefId: "platform",
          displayName: "Yinjie platform",
        })
      ).id;
    }
    if (share.participantType === "world_owner") {
      return (
        await this.findOrCreatePayeeByExternalRef({
          externalRefType: "world_owner",
          externalRefId: world.id,
          displayName: `${world.name} owner`,
        })
      ).id;
    }
    return (
      await this.findOrCreatePayeeByExternalRef({
        externalRefType: "runtime_operator",
        externalRefId: world.providerKey ?? world.id,
        displayName: `${world.providerKey ?? "runtime"} operator`,
      })
    ).id;
  }

  private resolveAllocationStatus(
    allocation: AllocationDraft,
    payeeMap: Map<string, RevenuePayeeEntity>,
  ): RevenueAllocationStatus {
    if (!allocation.payeeId || allocation.sourceType === "unassigned_hold") {
      return "held";
    }
    return payeeMap.get(allocation.payeeId)?.status === "active"
      ? "payable"
      : "held";
  }

  private async findSettlementCandidates(input: RevenueSettlementPreviewRequest) {
    const where: FindOptionsWhere<RevenueAllocationLedgerEntity> = {
      status: "payable",
      settlementBatchId: IsNull(),
    };
    if (input.payeeId) where.payeeId = input.payeeId;
    const from = this.parseOptionalDate(input.from, "from");
    const to = this.parseOptionalDate(input.to, "to");
    if (from && to) where.createdAt = Between(from, to);
    return this.allocationRepo.find({ where, order: { createdAt: "ASC" } });
  }

  private async getActivePolicy() {
    const entity = await this.policyRepo.findOne({
      where: { status: "active" },
      order: { version: "DESC", createdAt: "DESC" },
    });
    if (!entity) return null;
    return Object.assign(entity, { config: this.parsePolicyConfig(entity.configJson) });
  }

  private async findOrCreatePayeeByExternalRef(input: {
    externalRefType: RevenuePayeeExternalRefType;
    externalRefId: string;
    displayName: string;
  }) {
    const existing = await this.payeeRepo.findOne({
      where: {
        externalRefType: input.externalRefType,
        externalRefId: input.externalRefId,
      },
    });
    if (existing) {
      return existing;
    }
    return this.payeeRepo.save(
      this.payeeRepo.create({
        displayName: input.displayName,
        status: "pending",
        externalRefType: input.externalRefType,
        externalRefId: input.externalRefId,
        contact: null,
        payoutNote: null,
      }),
    );
  }

  private async requireRuntimeWorld(worldId: string, callbackToken?: string) {
    const world = await this.worldRepo.findOne({ where: { id: worldId } });
    if (!world) {
      throw new NotFoundException("World not found.");
    }
    const expected = this.trimToNull(world.callbackToken);
    const actual = this.trimToNull(callbackToken);
    if (!expected || !actual || expected !== actual) {
      throw new UnauthorizedException("Invalid world callback token.");
    }
    return world;
  }

  private normalizePolicyConfig(
    input: RevenueSharingPolicyConfig,
  ): RevenueSharingPolicyConfig {
    const config: RevenueSharingPolicyConfig = {
      enabled: Boolean(input.enabled),
      currency: this.requireString(input.currency, "currency", 8).toUpperCase(),
      eventPrices: this.normalizeEventPrices(input.eventPrices),
      fixedShares: this.normalizeFixedShares(input.fixedShares),
      contributionPoolBasisPoints: this.normalizeInteger(
        input.contributionPoolBasisPoints,
        "contributionPoolBasisPoints",
        0,
        10000,
      ),
      contributionWeights: this.normalizeContributionWeights(
        input.contributionWeights,
      ),
      contributionWindowDays: this.normalizeInteger(
        input.contributionWindowDays,
        "contributionWindowDays",
        1,
        3650,
      ),
      minimumSettlementCents: this.normalizeInteger(
        input.minimumSettlementCents,
        "minimumSettlementCents",
        0,
        100000000,
      ),
    };
    const fixedBps = config.fixedShares.reduce(
      (sum, share) => sum + share.basisPoints,
      0,
    );
    if (fixedBps + config.contributionPoolBasisPoints > 10000) {
      throw new BadRequestException("固定分成与贡献池比例之和不能超过 10000 bps。");
    }
    return config;
  }

  private normalizeEventPrices(raw: unknown): RevenueEventPriceRule[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException("eventPrices 必须是数组。");
    }
    return raw.map((item) => {
      if (!item || typeof item !== "object") {
        throw new BadRequestException("eventPrices 包含非法项。");
      }
      const candidate = item as Partial<RevenueEventPriceRule>;
      if (!VALID_USAGE_EVENT_TYPES.has(candidate.eventType as RevenueUsageEventType)) {
        throw new BadRequestException("eventPrices 包含非法事件类型。");
      }
      return {
        eventType: candidate.eventType as RevenueUsageEventType,
        unitAmountCents: this.normalizeInteger(
          candidate.unitAmountCents,
          "unitAmountCents",
          0,
          100000000,
        ),
      };
    });
  }

  private normalizeFixedShares(raw: unknown): RevenueFixedShareRule[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException("fixedShares 必须是数组。");
    }
    return raw.map((item) => {
      if (!item || typeof item !== "object") {
        throw new BadRequestException("fixedShares 包含非法项。");
      }
      const candidate = item as Partial<RevenueFixedShareRule>;
      if (
        !VALID_FIXED_PARTICIPANTS.has(
          candidate.participantType as RevenueFixedShareRule["participantType"],
        )
      ) {
        throw new BadRequestException("fixedShares 包含非法参与方。");
      }
      return {
        participantType:
          candidate.participantType as RevenueFixedShareRule["participantType"],
        basisPoints: this.normalizeInteger(
          candidate.basisPoints,
          "basisPoints",
          0,
          10000,
        ),
        payeeId: this.trimToNull(candidate.payeeId),
      };
    });
  }

  private normalizeContributionWeights(
    raw: unknown,
  ): RevenueContributionWeightRule[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException("contributionWeights 必须是数组。");
    }
    return raw.map((item) => {
      if (!item || typeof item !== "object") {
        throw new BadRequestException("contributionWeights 包含非法项。");
      }
      const candidate = item as Partial<RevenueContributionWeightRule>;
      if (
        !VALID_CONTRIBUTION_EVENT_TYPES.has(
          candidate.eventType as RevenueContributionEventType,
        )
      ) {
        throw new BadRequestException("contributionWeights 包含非法事件类型。");
      }
      if (
        !VALID_CONTRIBUTION_PARTICIPANTS.has(
          candidate.participantType as RevenueContributionWeightRule["participantType"],
        )
      ) {
        throw new BadRequestException("contributionWeights 包含非法参与方。");
      }
      return {
        eventType: candidate.eventType as RevenueContributionEventType,
        participantType:
          candidate.participantType as RevenueContributionWeightRule["participantType"],
        weight: this.normalizeInteger(candidate.weight, "weight", 0, 100000),
      };
    });
  }

  private normalizeContributionEvent(input: RevenueContributionEventInput) {
    const sourceEventId = this.requireString(input.sourceEventId, "sourceEventId", 255);
    if (!VALID_CONTRIBUTION_EVENT_TYPES.has(input.eventType)) {
      throw new BadRequestException("贡献事件类型不合法。");
    }
    return {
      sourceEventId,
      eventType: input.eventType,
      characterId: this.requireString(input.characterId, "characterId", 255),
      contributorExternalRefType: this.normalizeExternalRefType(
        input.contributorExternalRefType,
      ),
      contributorExternalRefId: this.requireString(
        input.contributorExternalRefId,
        "contributorExternalRefId",
        255,
      ),
      occurredAt: this.parseOptionalDate(input.occurredAt, "occurredAt") ?? new Date(),
      reversedAt: this.parseOptionalDate(input.reversedAt, "reversedAt"),
      metadata: input.metadata ?? null,
    };
  }

  private normalizeUsageEvent(input: RevenueUsageEventInput) {
    const sourceEventId = this.requireString(input.sourceEventId, "sourceEventId", 255);
    if (!VALID_USAGE_EVENT_TYPES.has(input.eventType)) {
      throw new BadRequestException("角色使用事件类型不合法。");
    }
    return {
      sourceEventId,
      eventType: input.eventType,
      characterId: this.requireString(input.characterId, "characterId", 255),
      characterName: this.trimToNull(input.characterName),
      quantity: this.normalizeInteger(input.quantity ?? 1, "quantity", 1, 100000),
      occurredAt: this.parseOptionalDate(input.occurredAt, "occurredAt") ?? new Date(),
      metadata: input.metadata ?? null,
    };
  }

  private normalizeExternalRefType(value: unknown): RevenuePayeeExternalRefType {
    if (!VALID_EXTERNAL_REF_TYPES.has(value as RevenuePayeeExternalRefType)) {
      throw new BadRequestException("收益人外部引用类型不合法。");
    }
    return value as RevenuePayeeExternalRefType;
  }

  private parsePolicyConfig(configJson: string): RevenueSharingPolicyConfig {
    try {
      return this.normalizePolicyConfig(JSON.parse(configJson) as RevenueSharingPolicyConfig);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("收益分成策略配置无法解析。");
    }
  }

  private serializePolicy(
    policy: RevenueSharingPolicyEntity,
  ): RevenueSharingPolicySummary {
    return {
      id: policy.id,
      version: policy.version,
      status: policy.status === "active" ? "active" : "inactive",
      config: this.parsePolicyConfig(policy.configJson),
      createdBy: policy.createdBy,
      activatedAt: policy.activatedAt?.toISOString() ?? null,
      createdAt: policy.createdAt.toISOString(),
    };
  }

  private serializePayee(payee: RevenuePayeeEntity): RevenuePayeeSummary {
    return {
      id: payee.id,
      displayName: payee.displayName,
      status: payee.status as RevenuePayeeStatus,
      externalRefType: payee.externalRefType as RevenuePayeeExternalRefType,
      externalRefId: payee.externalRefId,
      contact: payee.contact,
      payoutNote: payee.payoutNote,
      createdAt: payee.createdAt.toISOString(),
      updatedAt: payee.updatedAt.toISOString(),
    };
  }

  private serializeUsageEvent(
    event: RevenueUsageEventEntity,
  ): RevenueUsageEventSummary {
    return {
      id: event.id,
      worldId: event.worldId,
      sourceEventId: event.sourceEventId,
      eventType: event.eventType as RevenueUsageEventType,
      characterId: event.characterId,
      characterName: event.characterName,
      quantity: event.quantity,
      unitAmountCents: event.unitAmountCents,
      grossAmountCents: event.grossAmountCents,
      currency: event.currency,
      policyId: event.policyId,
      processedAt: event.processedAt?.toISOString() ?? null,
      occurredAt: event.occurredAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    };
  }

  private serializeContributionEvent(
    event: RevenueContributionEventEntity,
  ): RevenueContributionEventSummary {
    return {
      id: event.id,
      worldId: event.worldId,
      sourceEventId: event.sourceEventId,
      eventType: event.eventType as RevenueContributionEventType,
      characterId: event.characterId,
      contributorPayeeId: event.contributorPayeeId,
      contributorExternalRefType:
        event.contributorExternalRefType as RevenuePayeeExternalRefType,
      contributorExternalRefId: event.contributorExternalRefId,
      occurredAt: event.occurredAt.toISOString(),
      reversedAt: event.reversedAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private serializeAllocation(
    allocation: RevenueAllocationLedgerEntity,
    payeeMap: Map<string, RevenuePayeeEntity>,
  ): RevenueAllocationLedgerItem {
    const payee = allocation.payeeId ? payeeMap.get(allocation.payeeId) : null;
    return {
      id: allocation.id,
      usageEventId: allocation.usageEventId,
      worldId: allocation.worldId,
      characterId: allocation.characterId,
      payeeId: allocation.payeeId,
      payeeDisplayName: payee?.displayName ?? null,
      participantType: allocation.participantType as RevenueParticipantType,
      sourceType: allocation.sourceType as RevenueAllocationLedgerItem["sourceType"],
      amountCents: allocation.amountCents,
      currency: allocation.currency,
      contributionScore: allocation.contributionScore,
      status: allocation.status as RevenueAllocationStatus,
      settlementBatchId: allocation.settlementBatchId,
      createdAt: allocation.createdAt.toISOString(),
    };
  }

  private serializeSettlementBatch(
    batch: RevenueSettlementBatchEntity,
  ): RevenueSettlementBatchSummary {
    return {
      id: batch.id,
      status: batch.status as RevenueSettlementBatchSummary["status"],
      currency: batch.currency,
      totalAmountCents: batch.totalAmountCents,
      allocationCount: batch.allocationCount,
      periodFrom: batch.periodFrom?.toISOString() ?? null,
      periodTo: batch.periodTo?.toISOString() ?? null,
      generatedBy: batch.generatedBy,
      generatedAt: batch.generatedAt.toISOString(),
      metadata: this.parseJsonObject(batch.metadataJson),
    };
  }

  private summarizeAllocations(allocations: RevenueAllocationLedgerEntity[]) {
    const currency = allocations[0]?.currency ?? "CNY";
    return {
      currency,
      totalGrossCents: allocations.reduce((sum, item) => sum + item.amountCents, 0),
      totalPayableCents: allocations
        .filter((item) => item.status === "payable")
        .reduce((sum, item) => sum + item.amountCents, 0),
      totalHeldCents: allocations
        .filter((item) => item.status === "held")
        .reduce((sum, item) => sum + item.amountCents, 0),
      totalSettledCents: allocations
        .filter((item) => item.status === "settled")
        .reduce((sum, item) => sum + item.amountCents, 0),
    };
  }

  private async getPayeeMap(payeeIds: Array<string | null>) {
    const ids = Array.from(new Set(payeeIds.filter((id): id is string => Boolean(id))));
    if (!ids.length) return new Map<string, RevenuePayeeEntity>();
    const payees = await this.payeeRepo.find({ where: { id: In(ids) } });
    return new Map(payees.map((payee) => [payee.id, payee]));
  }

  private buildWorldCharacterWhere(query: {
    worldId?: string;
    characterId?: string;
  }) {
    const where: FindOptionsWhere<
      RevenueUsageEventEntity | RevenueContributionEventEntity
    > = {};
    if (query.worldId) where.worldId = query.worldId;
    if (query.characterId) where.characterId = query.characterId;
    return where;
  }

  private buildLedgerWhere(query: {
    worldId?: string;
    characterId?: string;
    payeeId?: string;
    status?: RevenueAllocationStatus;
  }): FindOptionsWhere<RevenueAllocationLedgerEntity> {
    const where: FindOptionsWhere<RevenueAllocationLedgerEntity> = {};
    if (query.worldId) where.worldId = query.worldId;
    if (query.characterId) where.characterId = query.characterId;
    if (query.payeeId) where.payeeId = query.payeeId;
    if (query.status) where.status = query.status;
    return where;
  }

  private normalizeInteger(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${field} 必须是 ${min} 到 ${max} 之间的整数。`);
    }
    return parsed;
  }

  private normalizePage(value: unknown) {
    const parsed = Number(value ?? 1);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  private normalizePageSize(value: unknown) {
    const parsed = Number(value ?? 20);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : 20;
  }

  private requireString(value: unknown, field: string, maxLength: number) {
    const normalized = this.trimToNull(value);
    if (!normalized) {
      throw new BadRequestException(`${field} 不能为空。`);
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${field} 不能超过 ${maxLength} 个字符。`);
    }
    return normalized;
  }

  private parseOptionalDate(value: string | null | undefined, field: string) {
    const normalized = this.trimToNull(value);
    if (!normalized) return null;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} 必须是合法 ISO 时间。`);
    }
    return parsed;
  }

  private trimToNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private stringifyMetadata(value: Record<string, unknown> | null | undefined) {
    if (!value || typeof value !== "object") return null;
    return JSON.stringify(value);
  }

  private parseJsonObject(value: string | null) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private clonePolicyConfig(config: RevenueSharingPolicyConfig) {
    return JSON.parse(JSON.stringify(config)) as RevenueSharingPolicyConfig;
  }
}
