import { isInitialized } from "./index";

let attached = false;

function emitInternal(
  eventName: string,
  eventType: "error" | "performance",
  props: Record<string, unknown>,
): void {
  void import("./internal-emitter").then((m) => {
    m.emitInternalEvent(eventName, eventType, props);
  });
}

export function attachAutoCapture(): void {
  if (attached || typeof window === "undefined" || !isInitialized()) return;
  attached = true;

  window.addEventListener("error", (event) => {
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
      if (perf.fcp || perf.lcp || perf.ttfb) {
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
