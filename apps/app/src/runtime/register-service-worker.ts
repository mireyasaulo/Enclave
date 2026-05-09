import { detectAppPlatform } from "./platform";

// SW 只在公网生产域名注册——本地 / 局域网 / 127.0.0.1 一律不装。
// 公网隧道带宽窄，SW precache 能省下大量重复下载；本地预览不缺带宽，
// 反而会被 precache 锁住吃不到新构建。Devops 切换公网域名时同步更新这个清单。
const PROD_SW_HOSTNAMES = new Set<string>([
  "1gw06751dd053.vicp.fun",
]);

function isProdSwHost(): boolean {
  if (typeof window === "undefined") return false;
  return PROD_SW_HOSTNAMES.has(window.location.hostname);
}

async function unregisterAllAndClearCaches(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  let didSomething = false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length > 0) {
      didSomething = true;
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      if (keys.length > 0) {
        didSomething = true;
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    }
  } catch {
    // ignore
  }
  return didSomething;
}

// 仅在「web 端 + 生产构建 + 浏览器支持 SW + 命中公网生产域名」时注册：
// - Capacitor (iOS/Android) 和 Tauri (desktop) 各自有原生缓存机制，不需要 SW；
//   且 SW 在 file:// scheme 上根本注册不了。
// - 开发服务器（vite dev）下 SW 容易缓存到旧 chunk 引起调试困惑，已在
//   vite-plugin-pwa devOptions.enabled=false 关掉 dev 期 SW 生成。
// - 本地预览（127.0.0.1:5180、局域网 IP）不在 PROD_SW_HOSTNAMES，跳过注册，
//   并主动清掉历史遗留的 SW + caches，避免被旧 precache 锁住。
// 注册时机放在首屏渲染之后（idleCallback），避免与首屏 JS 抢带宽。
export function registerAppServiceWorker() {
  if (!import.meta.env.PROD) {
    return;
  }
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }
  if (!("serviceWorker" in navigator)) {
    return;
  }
  if (detectAppPlatform() !== "web") {
    return;
  }

  if (!isProdSwHost()) {
    // 不在生产域名 → 主动清残留 SW + caches。清完如果发现确实清掉过东西，
    // reload 一次让页面拿到不被旧 SW 拦截的资源。
    // sessionStorage 守护避免反复触发 reload 死循环。
    const GUARD_KEY = "yinjie:sw-cleanup-reload";
    let alreadyTried = false;
    try {
      alreadyTried = window.sessionStorage.getItem(GUARD_KEY) === "1";
    } catch {
      alreadyTried = true;
    }
    if (alreadyTried) return;
    void (async () => {
      const didCleanup = await unregisterAllAndClearCaches();
      try {
        window.sessionStorage.setItem(GUARD_KEY, "1");
      } catch {
        // ignore
      }
      if (didCleanup) {
        window.location.reload();
      }
    })();
    return;
  }

  const run = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // SW 注册失败不影响业务，沉默忽略即可。
      });
  };

  type IdleScheduler = {
    requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
  };
  const idle = globalThis as Partial<IdleScheduler>;
  if (typeof idle.requestIdleCallback === "function") {
    idle.requestIdleCallback(run, { timeout: 4000 });
    return;
  }

  window.setTimeout(run, 1500);
}
