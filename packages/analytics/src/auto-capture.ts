import { _emitTyped, isInitialized } from "./index";

let attached = false;

function emitInternal(
  eventName: string,
  eventType: "error" | "performance",
  props: Record<string, unknown>,
): void {
  _emitTyped(eventName, eventType, props);
}

const EXTENSION_STACK_PATTERN =
  /chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\/|@user-script:/;

// 浏览器对网络瞬断给出的几种等价文案。当 stack 没有任何有用 frame 时（Safari 经常
// 整批 fetch 同一毫秒失败、stack=null），这条 rejection 没有调试价值，且对应的请求
// 失败已经被 apiCallObserver 记成 api_call ok=false，没必要再以 unhandled_rejection
// 双重上报。
const NETWORK_FAILURE_MESSAGES = new Set([
  "Load failed",
  "Failed to fetch",
  "Network request failed",
  "fetch failed",
  "NetworkError when attempting to fetch resource.",
]);

function isAbortLikeError(reason: unknown, message: string | null): boolean {
  if (
    reason &&
    typeof reason === "object" &&
    "name" in reason &&
    (reason as { name?: unknown }).name === "AbortError"
  ) {
    return true;
  }
  if (!message) return false;
  return (
    message === "signal is aborted without reason" ||
    message === "The operation was aborted." ||
    message === "The user aborted a request."
  );
}

function isApiRequestError(reason: unknown): boolean {
  return Boolean(
    reason &&
      typeof reason === "object" &&
      "name" in reason &&
      (reason as { name?: unknown }).name === "ApiRequestError",
  );
}

function hasUsefulStack(stack: string | null): boolean {
  if (!stack) return false;
  // "TypeError: Failed to fetch" 这种只有错误名、没有 frame 的不算有用
  const lines = stack.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return false;
  // 至少要有一行包含 ".js" 或 "at " 或 "@http" 之类的真实 frame 标记
  return lines.some((line) => /\.js|@http|\sat\s/.test(line));
}

function shouldDropUnhandled(
  reason: unknown,
  message: string | null,
  stack: string | null,
): boolean {
  if (isAbortLikeError(reason, message)) return true;
  if (stack && EXTENSION_STACK_PATTERN.test(stack)) return true;

  // ApiRequestError：服务端响应 4xx/5xx 已经被 apiCallObserver 记成 api_call，
  // 业务侧也有 apiRequestErrorHandler 全局通道；落到 unhandled_rejection 是双重上报。
  if (isApiRequestError(reason)) return true;

  // 网络瞬断（多浏览器变体）且 stack 没有真实 frame —— 无调试价值、且已被 api_call 覆盖。
  if (message && NETWORK_FAILURE_MESSAGES.has(message) && !hasUsefulStack(stack)) {
    return true;
  }

  const trimmed = message?.trim() ?? "";
  if (
    trimmed === "" ||
    trimmed === "{}" ||
    trimmed === "null" ||
    trimmed === "undefined"
  ) {
    return true;
  }
  return false;
}

function shouldDropFrontendError(event: ErrorEvent): boolean {
  if (event.message === "Script error." && !event.filename) return true;
  const stack = (event.error as Error | undefined)?.stack;
  if (stack && EXTENSION_STACK_PATTERN.test(stack)) return true;
  if (event.filename && EXTENSION_STACK_PATTERN.test(event.filename)) return true;
  return false;
}

export function attachAutoCapture(): void {
  if (attached || typeof window === "undefined" || !isInitialized()) return;
  attached = true;

  window.addEventListener("error", (event) => {
    if (shouldDropFrontendError(event)) return;
    emitInternal("frontend_error", "error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: (event.error as Error | undefined)?.stack?.slice(0, 2000) ?? null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    let message: string | null = null;
    let stack: string | null = null;
    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack?.slice(0, 2000) ?? null;
    } else if (typeof reason === "string") {
      message = reason.slice(0, 1000);
    } else {
      try {
        message = JSON.stringify(reason).slice(0, 1000);
      } catch {
        message = String(reason).slice(0, 1000);
      }
    }
    if (shouldDropUnhandled(reason, message, stack)) return;
    emitInternal("unhandled_rejection", "error", { message, stack });
  });

  // White-screen heuristic
  window.setTimeout(() => {
    if (!document.body) return;
    const hasContent = document.body.children.length > 0 && document.body.scrollHeight > 0;
    if (!hasContent) {
      emitInternal("white_screen", "error", {
        url: location?.href ?? null,
      });
    }
  }, 5000);

  // Performance metrics
  if (typeof PerformanceObserver !== "undefined") {
    const perf: Record<string, number> = {};
    let emitted = false;

    const tryEmit = () => {
      if (emitted) return;
      if (perf.fcp || perf.lcp || perf.ttfb || perf.dcl) {
        emitted = true;
        emitInternal("performance", "performance", { ...perf });
      }
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            perf.fcp = Math.round(entry.startTime);
          }
        }
      }).observe({ type: "paint", buffered: true });
    } catch {
      // ignore
    }

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) perf.lcp = Math.round(last.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // ignore
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceNavigationTiming[]) {
          if (typeof entry.responseStart === "number") {
            perf.ttfb = Math.round(entry.responseStart);
          }
          if (typeof entry.domContentLoadedEventEnd === "number") {
            perf.dcl = Math.round(entry.domContentLoadedEventEnd);
          }
        }
      }).observe({ type: "navigation", buffered: true });
    } catch {
      // ignore
    }

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") tryEmit();
      },
      { once: false },
    );
    window.setTimeout(tryEmit, 8000);
  }
}
