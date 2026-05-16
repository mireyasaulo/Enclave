import { canSafelyNavigateBack } from "../lib/history-back";

import { isAndroidPlatform } from "./adapters/android";

const ANDROID_BACK_EVENT = "yinjie:android-back";
const DOUBLE_TAP_EXIT_WINDOW_MS = 1500;
const EXIT_TOAST_DURATION_MS = 1500;

let lastBackPressAt = 0;
let registered = false;

type CapacitorAppPlugin = {
  addListener: (
    event: "backButton",
    callback: (data: { canGoBack: boolean }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
  minimizeApp?: () => Promise<void>;
  exitApp: () => Promise<void>;
};

type CapacitorAppStateListenerHandle = { remove: () => Promise<void> };

export type AndroidBackInterceptor = (event: AndroidBackEvent) => boolean;

export type AndroidBackEvent = {
  /** Set by an interceptor to claim the back press — no further handling will run. */
  preventDefault: () => void;
  defaultPrevented: boolean;
  canGoBack: boolean;
};

const interceptors = new Set<AndroidBackInterceptor>();

/**
 * Register an interceptor that may claim the hardware back press.
 * Higher priority (later registered) interceptors run first.
 * Return `true` (or call `event.preventDefault()`) to consume the press.
 */
export function registerAndroidBackInterceptor(
  interceptor: AndroidBackInterceptor,
) {
  interceptors.add(interceptor);
  return () => {
    interceptors.delete(interceptor);
  };
}

async function importCapacitorApp(): Promise<CapacitorAppPlugin | null> {
  try {
    const mod = (await import("@capacitor/app")) as { App: CapacitorAppPlugin };
    return mod.App ?? null;
  } catch {
    return null;
  }
}

function getOpenModalCount() {
  if (typeof document === "undefined") {
    return 0;
  }
  // 任何可见的 dialog / sheet / overlay 都应该用 [data-yinjie-dismissable] 标注
  return document.querySelectorAll(
    "[data-yinjie-dismissable='true'], dialog[open]",
  ).length;
}

function dispatchDismissEvent() {
  if (typeof window === "undefined") {
    return false;
  }
  const event = new CustomEvent(ANDROID_BACK_EVENT, { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function runInterceptors(canGoBack: boolean) {
  // 倒序触发（最后注册的最先生效）
  const ordered = Array.from(interceptors).reverse();
  let prevented = false;
  const event: AndroidBackEvent = {
    canGoBack,
    get defaultPrevented() {
      return prevented;
    },
    preventDefault() {
      prevented = true;
    },
  };
  for (const handler of ordered) {
    try {
      const consumed = handler(event);
      if (consumed === true || event.defaultPrevented) {
        prevented = true;
        break;
      }
    } catch {
      // 单个 interceptor 异常不应该卡死 back 链路
    }
  }
  return prevented;
}

function showExitHintToast() {
  if (typeof document === "undefined") {
    return;
  }
  const existing = document.getElementById("yj-android-exit-hint");
  if (existing) {
    existing.remove();
  }
  const node = document.createElement("div");
  node.id = "yj-android-exit-hint";
  node.textContent = "再按一次返回键退出";
  Object.assign(node.style, {
    position: "fixed",
    left: "50%",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
    transform: "translateX(-50%)",
    padding: "10px 18px",
    borderRadius: "9999px",
    background: "rgba(20, 20, 20, 0.82)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "500",
    pointerEvents: "none",
    zIndex: "2147483647",
    boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
    transition: "opacity 240ms ease",
    opacity: "1",
  } as CSSStyleDeclaration);
  document.body.appendChild(node);
  window.setTimeout(() => {
    node.style.opacity = "0";
  }, EXIT_TOAST_DURATION_MS - 240);
  window.setTimeout(() => {
    node.remove();
  }, EXIT_TOAST_DURATION_MS);
}

function isAtRootRoute() {
  if (typeof window === "undefined") {
    return true;
  }
  const path = window.location.pathname.replace(/\/+$/, "");
  // 4 个主 tab + 根路径 → 视为根
  return (
    path === "" ||
    path === "/" ||
    path === "/chat-list" ||
    path === "/contacts" ||
    path === "/discover" ||
    path === "/me"
  );
}

async function handleBackPressed(
  app: CapacitorAppPlugin,
  data: { canGoBack: boolean },
) {
  // 1. 让 DOM 内的可关闭层（sheet/modal/drawer）优先消费
  if (getOpenModalCount() > 0 && dispatchDismissEvent()) {
    return;
  }
  if (dispatchDismissEvent()) {
    return;
  }

  // 2. 让业务 interceptor 消费
  if (runInterceptors(data.canGoBack)) {
    return;
  }

  // 3. 路由能 safe back → history.back
  if (canSafelyNavigateBack()) {
    window.history.back();
    return;
  }

  // 4. 在根 tab：双击退出
  if (isAtRootRoute()) {
    const now = Date.now();
    if (now - lastBackPressAt < DOUBLE_TAP_EXIT_WINDOW_MS) {
      lastBackPressAt = 0;
      try {
        await app.exitApp();
      } catch {
        // ignore
      }
      return;
    }
    lastBackPressAt = now;
    showExitHintToast();
    return;
  }

  // 5. 兜底：能 minimize 就 minimize，否则 history.back
  try {
    if (app.minimizeApp) {
      await app.minimizeApp();
      return;
    }
  } catch {
    // fall through
  }
  if (data.canGoBack) {
    window.history.back();
  }
}

export async function registerAndroidBackButton() {
  if (registered || !isAndroidPlatform()) {
    return;
  }
  const app = await importCapacitorApp();
  if (!app) {
    return;
  }
  registered = true;
  await app.addListener("backButton", (data) => {
    void handleBackPressed(app, data);
  });
}

type AppStateChangeHandler = (state: { isActive: boolean }) => void;

const appStateHandlers = new Set<AppStateChangeHandler>();
let appStateRegistered = false;

export function registerAppStateChangeListener(handler: AppStateChangeHandler) {
  appStateHandlers.add(handler);
  return () => {
    appStateHandlers.delete(handler);
  };
}

export async function registerAndroidAppStateChange() {
  if (appStateRegistered || !isAndroidPlatform()) {
    return;
  }
  const app = await importCapacitorApp();
  if (!app) {
    return;
  }
  appStateRegistered = true;
  type AppStatePlugin = CapacitorAppPlugin & {
    addListener: (
      event: "appStateChange",
      callback: (state: { isActive: boolean }) => void,
    ) => Promise<CapacitorAppStateListenerHandle>;
  };
  const appWithStateListener = app as unknown as AppStatePlugin;
  await appWithStateListener.addListener("appStateChange", (state) => {
    for (const handler of appStateHandlers) {
      try {
        handler(state);
      } catch {
        // 单个 handler 异常不应阻塞下一个
      }
    }
  });
}
