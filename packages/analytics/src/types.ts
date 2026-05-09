import type {
  TelemetryAppId,
  TelemetryEventInput,
  TelemetryEventType,
} from "@yinjie/contracts";

export type { TelemetryAppId, TelemetryEventInput, TelemetryEventType };

export interface InitOptions {
  appId: TelemetryAppId;
  /**
   * Static endpoint URL. Either this or {@link InitOptions.endpointProvider}
   * must be set. If both are set, endpointProvider wins.
   */
  endpoint?: string;
  /**
   * Lazy endpoint resolver, called before every flush. Use this when the
   * cloud-api base URL changes after init (e.g. the user logs into a
   * different world). Return null to skip the flush — the events stay in
   * the queue and will be retried later.
   */
  endpointProvider?: () => string | null | undefined;
  userIdProvider?: () => string | null | undefined;
  /**
   * Lazy resolver for the current cloud world id, called on every event.
   * Returns the worldId the user is currently inside, or null when the
   * surface has no world concept (site/wiki) or the user hasn't entered
   * one yet. Mirrors the userIdProvider pattern.
   */
  worldIdProvider?: () => string | null | undefined;
  release?: string | null;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  apiCallSampleRate?: number;
  debug?: boolean;
  enableAutoCapture?: boolean;
  enableAutoPageView?: boolean;
  enableContractsBridge?: boolean;
}

export interface InternalState {
  options: Required<
    Omit<
      InitOptions,
      | "userIdProvider"
      | "worldIdProvider"
      | "release"
      | "endpoint"
      | "endpointProvider"
    >
  > & {
    endpointProvider: () => string | null;
    userIdProvider: () => string | null;
    worldIdProvider: () => string | null;
    release: string | null;
  };
  anonId: string;
  sessionId: string;
  sessionStartedAt: number;
  visibleSinceMs: number;
  visibleAccumMs: number;
  pageMountedAt: number;
  currentPagePath: string;
  queue: TelemetryEventInput[];
  flushTimer: ReturnType<typeof setInterval> | null;
  flushing: boolean;
  initialized: boolean;
}
