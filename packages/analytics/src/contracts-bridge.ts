import {
  _emitTyped,
  getApiCallSampleRate,
  getEndpoint,
  isInitialized,
} from "./index";

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
      // 401 + 没带 Authorization = "用户还没登录 / cloud session 还在 rehydrate"。
      // 这是 boot 期的预期状态（DesktopRuntimeGuard 等 polling 在 token 注入前
      // 就会发请求），不是 bug。早期占据 cloud-console error-rate 视图里 1/3 体积，
      // 把真错误（500/真 502）的信号埋没了，从源头滤掉。
      if (observation.status === 401 && observation.hadAuth === false) {
        return;
      }
      const sampleRate = getApiCallSampleRate();
      if (sampleRate < 1 && Math.random() > sampleRate) return;
      _emitTyped("api_call", "api_call", {
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
  hadAuth?: boolean;
}) => void;
