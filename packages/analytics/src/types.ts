import type {
  TelemetryAppId,
  TelemetryEventInput,
  TelemetryEventType,
} from "@yinjie/contracts";

export type { TelemetryAppId, TelemetryEventInput, TelemetryEventType };

export interface InitOptions {
  appId: TelemetryAppId;
  endpoint: string;
  userIdProvider?: () => string | null | undefined;
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
    Omit<InitOptions, "userIdProvider" | "release">
  > & {
    userIdProvider: () => string | null;
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
