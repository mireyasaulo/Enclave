import type { TelemetryEventInput, TelemetryEventType } from "@yinjie/contracts";
import { ensureAnonId } from "./anon-id";
import { newSessionId } from "./session";
import {
  clearPending,
  persistPending,
  readPending,
  sendBatchBeacon,
  sendWithRetry,
} from "./transport";
import type { InitOptions, InternalState } from "./types";

const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_BATCH_SIZE = 30;
const DEFAULT_API_CALL_SAMPLE_RATE = 1.0;

let state: InternalState | null = null;
let unloadHandlersInstalled = false;

function defaultUserIdProvider(): string | null {
  return null;
}

function getCurrentPagePath(): string {
  if (typeof location === "undefined") return "";
  return location.pathname + location.search;
}

function getCurrentReferrer(): string | null {
  if (typeof document === "undefined") return null;
  return document.referrer || null;
}

function nowIsoSqliteSafe(): string {
  return new Date().toISOString();
}

export function init(options: InitOptions): void {
  if (state?.initialized) {
    if (options.debug) {
      console.warn("[analytics] init called twice; ignoring");
    }
    return;
  }

  const wrappedUserIdProvider: () => string | null = () => {
    if (!options.userIdProvider) return null;
    try {
      const v = options.userIdProvider();
      return typeof v === "string" && v.length > 0 ? v : null;
    } catch {
      return null;
    }
  };

  const merged: InternalState["options"] = {
    appId: options.appId,
    endpoint: options.endpoint,
    userIdProvider: options.userIdProvider ? wrappedUserIdProvider : defaultUserIdProvider,
    release: options.release ?? null,
    flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    maxBatchSize: options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
    apiCallSampleRate: options.apiCallSampleRate ?? DEFAULT_API_CALL_SAMPLE_RATE,
    debug: options.debug ?? false,
    enableAutoCapture: options.enableAutoCapture ?? true,
    enableAutoPageView: options.enableAutoPageView ?? true,
    enableContractsBridge: options.enableContractsBridge ?? true,
  };

  state = {
    options: merged,
    anonId: ensureAnonId(),
    sessionId: newSessionId(),
    sessionStartedAt: Date.now(),
    visibleSinceMs:
      typeof document !== "undefined" && document.visibilityState === "hidden"
        ? 0
        : Date.now(),
    visibleAccumMs: 0,
    pageMountedAt: Date.now(),
    currentPagePath: getCurrentPagePath(),
    queue: [],
    flushTimer: null,
    flushing: false,
    initialized: true,
  };

  installLifecycleHandlers();

  state.flushTimer = setInterval(() => {
    void flushInternal();
  }, merged.flushIntervalMs);
  const timerWithUnref = state.flushTimer as unknown as { unref?: () => void };
  if (timerWithUnref && typeof timerWithUnref.unref === "function") {
    timerWithUnref.unref();
  }

  // Lazily attach auto-capture and contracts bridge to avoid pulling them in
  // when consumers have intentionally disabled them.
  if (merged.enableAutoCapture) {
    void import("./auto-capture").then((m) => m.attachAutoCapture()).catch(() => {});
  }
  if (merged.enableAutoPageView) {
    void import("./auto-page-view").then((m) => m.attachAutoPageView()).catch(() => {});
  }
  if (merged.enableContractsBridge) {
    void import("./contracts-bridge").then((m) => m.attachContractsBridge()).catch(() => {});
  }

  // Replay any pending events from prior sessions before emitting session_start.
  const pending = readPending();
  if (pending.length > 0) {
    state.queue.push(...pending);
    clearPending();
  }

  trackInternal("session_start", "session", {
    pageMountedAt: state.pageMountedAt,
  });

  if (typeof document !== "undefined") {
    trackInternal("page_view", "pv", {});
  }

  if (merged.debug) {
    type DebugWindow = Window & {
      __analytics?: {
        track: typeof track;
        trackPageView: typeof trackPageView;
        flush: typeof flush;
      };
    };
    if (typeof window !== "undefined") {
      (window as DebugWindow).__analytics = { track, trackPageView, flush };
    }
  }
}

export function track(eventName: string, props?: Record<string, unknown>): void {
  trackInternal(eventName, "business", props);
}

export function _emitTyped(
  eventName: string,
  eventType: TelemetryEventType,
  props?: Record<string, unknown>,
): void {
  trackInternal(eventName, eventType, props);
}

export function trackPageView(
  pagePath?: string,
  extra?: Record<string, unknown>,
): void {
  if (!state) return;
  const previousPath = state.currentPagePath;
  const previousMountedAt = state.pageMountedAt;
  const previousDuration = Date.now() - previousMountedAt;

  if (previousPath) {
    trackInternal("page_view_end", "pv", {
      pagePath: previousPath,
      durationMs: previousDuration,
    });
  }

  state.currentPagePath = pagePath ?? getCurrentPagePath();
  state.pageMountedAt = Date.now();
  trackInternal("page_view", "pv", { ...extra });
}

export function identify(_userId: string | null): void {
  // userIdProvider is read on every event, so this is a no-op stub kept
  // for API parity. Consumers who want a static value can wrap a closure
  // and pass it via init.
}

export function flush(): Promise<void> {
  return flushInternal();
}

export function getAnonId(): string | null {
  return state?.anonId ?? null;
}

export function getSessionId(): string | null {
  return state?.sessionId ?? null;
}

export function getEndpoint(): string | null {
  return state?.options.endpoint ?? null;
}

export function getAppId(): string | null {
  return state?.options.appId ?? null;
}

export function getApiCallSampleRate(): number {
  return state?.options.apiCallSampleRate ?? 1.0;
}

export function isInitialized(): boolean {
  return Boolean(state?.initialized);
}

function trackInternal(
  eventName: string,
  eventType: TelemetryEventType,
  props?: Record<string, unknown>,
): void {
  if (!state) return;
  const userId = safeUserId();
  const event: TelemetryEventInput = {
    eventName,
    eventType,
    occurredAt: nowIsoSqliteSafe(),
    sessionId: state.sessionId,
    anonId: state.anonId,
    userId,
    pagePath: state.currentPagePath || null,
    referrer: getCurrentReferrer(),
    release: state.options.release,
    props: props && Object.keys(props).length > 0 ? props : undefined,
  };

  state.queue.push(event);
  if (state.options.debug) {
    console.debug("[analytics] track", event);
  }
  if (state.queue.length >= state.options.maxBatchSize) {
    void flushInternal();
  }
}

function safeUserId(): string | null {
  if (!state) return null;
  try {
    const v = state.options.userIdProvider();
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

async function flushInternal(useBeaconHint = false): Promise<void> {
  if (!state || state.flushing || state.queue.length === 0) return;
  state.flushing = true;
  const batch = state.queue.splice(0, state.options.maxBatchSize);
  const body = { appId: state.options.appId, events: batch };
  try {
    let ok = false;
    if (useBeaconHint) {
      ok = sendBatchBeacon(state.options.endpoint, body);
    }
    if (!ok) {
      ok = await sendWithRetry(state.options.endpoint, body);
    }
    if (!ok) {
      persistPending(batch);
    }
  } finally {
    state.flushing = false;
  }
}

function installLifecycleHandlers(): void {
  if (unloadHandlersInstalled) return;
  if (typeof window === "undefined") return;
  unloadHandlersInstalled = true;

  const onHidden = () => {
    if (!state) return;
    const now = Date.now();
    if (state.visibleSinceMs > 0) {
      state.visibleAccumMs += now - state.visibleSinceMs;
      state.visibleSinceMs = 0;
    }
  };
  const onVisible = () => {
    if (!state) return;
    state.visibleSinceMs = Date.now();
  };
  const onUnload = () => {
    if (!state) return;
    const now = Date.now();
    if (state.visibleSinceMs > 0) {
      state.visibleAccumMs += now - state.visibleSinceMs;
      state.visibleSinceMs = 0;
    }
    trackInternal("session_end", "session", {
      durationMs: state.visibleAccumMs,
      wallClockMs: now - state.sessionStartedAt,
    });
    void flushInternal(true);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      onHidden();
      void flushInternal(true);
    } else {
      onVisible();
    }
  });
  window.addEventListener("pagehide", onUnload);
  window.addEventListener("beforeunload", onUnload);
}

export type { InitOptions } from "./types";
