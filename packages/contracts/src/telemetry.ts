export type TelemetryAppId = "app" | "site" | "wiki";

export type TelemetryEventType =
  | "pv"
  | "business"
  | "api_call"
  | "error"
  | "performance"
  | "session";

export interface TelemetryEventInput {
  /**
   * Stable client-generated event id. If provided, the server uses it as
   * the row primary key and silently ignores duplicate inserts (i.e. idempotency
   * on retries / localStorage replay). If omitted, the server falls back to
   * generating one — duplicates are then possible.
   */
  id?: string;
  eventName: string;
  eventType: TelemetryEventType;
  occurredAt: string;
  sessionId: string;
  anonId: string;
  userId?: string | null;
  /**
   * 当前用户所在的云世界 id（CloudWorldEntity.id）。app 端进入世界后填，
   * site/wiki 与世界无关恒为 null。用于 cloud-console 按世界切片分析。
   */
  worldId?: string | null;
  pagePath?: string | null;
  referrer?: string | null;
  release?: string | null;
  props?: Record<string, unknown> | null;
}

export interface TelemetryBatchRequest {
  appId: TelemetryAppId;
  events: TelemetryEventInput[];
}

export interface TelemetryBatchResponse {
  accepted: number;
  rejected: number;
}

export type TelemetryRange = "24h" | "7d" | "30d";

export interface TelemetryOverviewResponse {
  range: TelemetryRange;
  pvCount: number;
  uvCount: number;
  sessionCount: number;
  errorCount: number;
  avgSessionDurationMs: number;
  sparkline: TelemetryTimeseriesPoint[];
}

export interface TelemetryTimeseriesPoint {
  date: string;
  group: string;
  value: number;
}

export interface TelemetryTimeseriesResponse {
  eventName: string;
  range: TelemetryRange;
  groupBy: string;
  points: TelemetryTimeseriesPoint[];
}

export interface TelemetryTopEventRow {
  appId: TelemetryAppId;
  eventName: string;
  eventType: TelemetryEventType;
  count: number;
  uniqueUsers: number;
  uniqueAnons: number;
}

export interface TelemetryTopEventsResponse {
  range: TelemetryRange;
  rows: TelemetryTopEventRow[];
}

export interface TelemetryFunnelStep {
  eventName: string;
  count: number;
  conversionFromPrev: number;
  conversionFromStart: number;
}

export interface TelemetryFunnelResponse {
  range: TelemetryRange;
  steps: TelemetryFunnelStep[];
}

export interface TelemetryApiHealthRow {
  pagePath: string;
  totalCalls: number;
  successRate: number;
  p50Ms: number;
  p95Ms: number;
}

export interface TelemetryApiHealthResponse {
  range: TelemetryRange;
  rows: TelemetryApiHealthRow[];
}

export interface TelemetryErrorRow {
  id: string;
  appId: TelemetryAppId;
  eventName: string;
  occurredAt: string;
  pagePath: string | null;
  message: string | null;
  stack: string | null;
  userAgent: string | null;
  release: string | null;
}

export interface TelemetryErrorsResponse {
  range: TelemetryRange;
  rows: TelemetryErrorRow[];
}

export interface TelemetryWorldRow {
  worldId: string;
  worldName: string | null;
  eventCount: number;
  uniqueUsers: number;
  errorCount: number;
}

export interface TelemetryTopWorldsResponse {
  range: TelemetryRange;
  rows: TelemetryWorldRow[];
}
