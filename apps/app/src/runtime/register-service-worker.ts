import { detectAppPlatform } from "./platform";

// 仅在「web 端 + 生产构建 + 浏览器支持 SW」时注册：
// - Capacitor (iOS/Android) 和 Tauri (desktop) 各自有原生缓存机制，不需要 SW；
//   且 SW 在 file:// scheme 上根本注册不了。
// - 开发服务器（vite dev）下 SW 容易缓存到旧 chunk 引起调试困惑，已在
//   vite-plugin-pwa devOptions.enabled=false 关掉 dev 期 SW 生成。
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
