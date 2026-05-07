import { getApiCallSampleRate, getEndpoint, isInitialized } from "./index";
import { emitInternalEvent } from "./internal-emitter";

let attached = false;

export async function attachContractsBridge(): Promise<void> {
  if (attached || !isInitialized()) return;
  attached = true;

  let setApiCallObserver: ((fn: ApiCallObserver | null) => void) | null = null;
  try {
    const mod = (await import("@yinjie/contracts")) as Record<string, unknown>;
    const fn = mod.setApiCallObserver as
      | ((f: ApiCallObserver | null) => void)
      | undefined;
    if (typeof fn === "function") setApiCallObserver = fn;
  } catch {
    return;
  }
  if (!setApiCallObserver) return;

  setApiCallObserver((observation) => {
    try {
      const endpoint = getEndpoint();
      // Avoid recursion: drop calls to the telemetry endpoint itself.
      if (endpoint && observation.path && endpoint.endsWith(observation.path)) {
        return;
      }
      const sampleRate = getApiCallSampleRate();
      if (sampleRate < 1 && Math.random() > sampleRate) return;
      emitInternalEvent("api_call", "api_call", {
        method: observation.method,
        path: observation.path,
        status: observation.status,
        durationMs: observation.durationMs,
        ok: observation.ok,
        errorCode: observation.errorCode ?? null,
      });
    } catch {
      // never let observer affect business code
    }
  });
}

type ApiCallObserver = (o: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ok: boolean;
  errorCode?: string | null;
}) => void;
