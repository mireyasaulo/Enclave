export type RevenueUsageEventType =
  | "character_chat_message"
  | "character_voice_turn"
  | "character_video_turn"
  | "character_content_use"
  | "character_logic_run";

export type RevenueContributionEventType =
  | "character_create"
  | "character_content_edit_approved"
  | "character_logic_edit_approved"
  | "character_review_approved"
  | "character_patrol"
  | "character_logic_publish";

export type RevenuePayeeExternalRefType =
  | "world_owner"
  | "wiki_user"
  | "character"
  | "system"
  | "provider"
  | "runtime_operator";

export type RevenuePayeeStatus = "pending" | "active" | "paused" | "archived";

export type RevenueParticipantType =
  | "platform"
  | "world_owner"
  | "runtime_operator"
  | "character_creator"
  | "character_editor"
  | "character_reviewer"
  | "character_patroller"
  | "logic_publisher"
  | "unassigned_hold";

export type RevenueAllocationStatus = "held" | "payable" | "settled";

export type RevenueSettlementBatchStatus = "generated" | "voided";

export interface RevenueEventPriceRule {
  eventType: RevenueUsageEventType;
  unitAmountCents: number;
}

export interface RevenueFixedShareRule {
  participantType: Extract<
    RevenueParticipantType,
    "platform" | "world_owner" | "runtime_operator"
  >;
  basisPoints: number;
  payeeId?: string | null;
}

export interface RevenueContributionWeightRule {
  eventType: RevenueContributionEventType;
  participantType: Extract<
    RevenueParticipantType,
    | "character_creator"
    | "character_editor"
    | "character_reviewer"
    | "character_patroller"
    | "logic_publisher"
  >;
  weight: number;
}

export interface RevenueSharingPolicyConfig {
  enabled: boolean;
  currency: string;
  eventPrices: RevenueEventPriceRule[];
  fixedShares: RevenueFixedShareRule[];
  contributionPoolBasisPoints: number;
  contributionWeights: RevenueContributionWeightRule[];
  contributionWindowDays: number;
  minimumSettlementCents: number;
}

export interface RevenueSharingPolicySummary {
  id: string;
  version: number;
  status: "active" | "inactive";
  config: RevenueSharingPolicyConfig;
  createdBy: string | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface UpdateRevenueSharingPolicyRequest
  extends Partial<RevenueSharingPolicyConfig> {}

export interface RevenuePayeeSummary {
  id: string;
  displayName: string;
  status: RevenuePayeeStatus;
  externalRefType: RevenuePayeeExternalRefType;
  externalRefId: string;
  contact: string | null;
  payoutNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertRevenuePayeeRequest {
  id?: string;
  displayName: string;
  status?: RevenuePayeeStatus;
  externalRefType: RevenuePayeeExternalRefType;
  externalRefId: string;
  contact?: string | null;
  payoutNote?: string | null;
}

export interface RevenueContributionEventInput {
  sourceEventId: string;
  eventType: RevenueContributionEventType;
  characterId: string;
  contributorExternalRefType: RevenuePayeeExternalRefType;
  contributorExternalRefId: string;
  contributorDisplayName?: string | null;
  occurredAt?: string | null;
  reversedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RevenueUsageEventInput {
  sourceEventId: string;
  eventType: RevenueUsageEventType;
  characterId: string;
  characterName?: string | null;
  quantity?: number;
  occurredAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RevenueEventIngestResponse {
  accepted: number;
  inserted: number;
  updated: number;
  skipped: number;
}

export interface RevenueUsageEventSummary {
  id: string;
  worldId: string;
  sourceEventId: string;
  eventType: RevenueUsageEventType;
  characterId: string;
  characterName: string | null;
  quantity: number;
  unitAmountCents: number;
  grossAmountCents: number;
  currency: string;
  policyId: string | null;
  processedAt: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface RevenueContributionEventSummary {
  id: string;
  worldId: string;
  sourceEventId: string;
  eventType: RevenueContributionEventType;
  characterId: string;
  contributorPayeeId: string | null;
  contributorExternalRefType: RevenuePayeeExternalRefType;
  contributorExternalRefId: string;
  occurredAt: string;
  reversedAt: string | null;
  createdAt: string;
}

export interface RevenueEventListResponse {
  usageEvents: RevenueUsageEventSummary[];
  contributionEvents: RevenueContributionEventSummary[];
}

export interface RevenueAllocationLedgerItem {
  id: string;
  usageEventId: string;
  worldId: string;
  characterId: string;
  payeeId: string | null;
  payeeDisplayName: string | null;
  participantType: RevenueParticipantType;
  sourceType: "fixed" | "contribution" | "unassigned_hold";
  amountCents: number;
  currency: string;
  contributionScore: number | null;
  status: RevenueAllocationStatus;
  settlementBatchId: string | null;
  createdAt: string;
}

export interface RevenueLedgerSummary {
  currency: string;
  totalGrossCents: number;
  totalPayableCents: number;
  totalHeldCents: number;
  totalSettledCents: number;
}

export interface RevenueLedgerListResponse {
  items: RevenueAllocationLedgerItem[];
  summary: RevenueLedgerSummary;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RevenueSettlementPayeePreview {
  payeeId: string;
  payeeDisplayName: string;
  amountCents: number;
  allocationCount: number;
}

export interface RevenueSettlementPreviewRequest {
  from?: string;
  to?: string;
  payeeId?: string;
}

export interface RevenueSettlementPreviewResponse {
  generatedAt: string;
  currency: string;
  totalAmountCents: number;
  allocationCount: number;
  payees: RevenueSettlementPayeePreview[];
}

export interface RevenueSettlementBatchSummary {
  id: string;
  status: RevenueSettlementBatchStatus;
  currency: string;
  totalAmountCents: number;
  allocationCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  generatedBy: string | null;
  generatedAt: string;
  metadata: Record<string, unknown> | null;
}
