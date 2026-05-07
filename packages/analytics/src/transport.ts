import type { TelemetryAppId, TelemetryEventInput } from "@yinjie/contracts";

const PENDING_KEY = "yinjie_telemetry_pending";
const PENDING_MAX_EVENTS = 50;
const PENDING_MAX_BYTES = 64 * 1024;

interface PostBody {
  appId: TelemetryAppId;
  events: TelemetryEventInput[];
}

export function sendBatchBeacon(endpoint: string, body: PostBody): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  try {
    const blob = new Blob([JSON.stringify(body)], {
      type: "application/json",
    });
    return navigator.sendBeacon(endpoint, blob);
  } catch {
    return false;
  }
}

export async function sendBatchFetch(
  endpoint: string,
  body: PostBody,
  options: { timeoutMs?: number; keepalive?: boolean } = {},
): Promise<boolean> {
  const { timeoutMs = 5000, keepalive = false } = options;
  if (typeof fetch !== "function") return false;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
      signal: controller?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sendWithRetry(
  endpoint: string,
  body: PostBody,
  attempts = 3,
): Promise<boolean> {
  const delays = [0, 2000, 5000];
  for (let i = 0; i < attempts; i += 1) {
    if (delays[i] > 0) await sleep(delays[i] + Math.floor(Math.random() * 500));
    const ok = await sendBatchFetch(endpoint, body, { keepalive: true });
    if (ok) return true;
  }
  return false;
}

export function persistPending(events: TelemetryEventInput[]): void {
  if (typeof localStorage === "undefined" || events.length === 0) return;
  try {
    const existing = readPending();
    const merged = [...existing, ...events].slice(-PENDING_MAX_EVENTS);
    let json = JSON.stringify(merged);
    while (json.length > PENDING_MAX_BYTES && merged.length > 1) {
      merged.shift();
      json = JSON.stringify(merged);
    }
    localStorage.setItem(PENDING_KEY, json);
  } catch {
    // ignore
  }
}

export function readPending(): TelemetryEventInput[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as TelemetryEventInput[];
    return [];
  } catch {
    return [];
  }
}

export function clearPending(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
