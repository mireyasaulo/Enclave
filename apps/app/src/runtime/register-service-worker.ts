// SW 已经从 app 整体下线：
//   - vite.config.ts 不再用 vite-plugin-pwa 生成 sw.js；
//   - public/sw.js 是「自毁开关」：浏览器 update check 拿到后会 claim →
//     清 caches → 让 client 刷新 → unregister 自己；
//   - 这个函数原本负责注册 SW，现在改成「兜底清理已存量 SW」+
//     「监听自毁开关发的 postMessage 触发 reload」，确保历史装机能干净退出。
// SW precache 在多次构建之间锁住旧 chunk，导致用户拿不到新代码，这条路径
// 不再值得维护——索性彻底走 nginx + 浏览器 HTTP 缓存。
//
// 兜底清理用 sessionStorage 守护避免反复 reload。一个标签页内最多 reload
// 一次；关掉再开就重新跑一次（理论上那时已经没 SW 了，立即返回）。

const CLEANUP_GUARD_KEY = "yinjie:sw-cleanup-done";

function hasNavigatorSW(): boolean {
  if (typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator;
}

async function unregisterAllAndClearCaches(): Promise<boolean> {
  if (!hasNavigatorSW()) return false;
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

export function registerAppServiceWorker() {
  if (typeof window === "undefined") return;
  if (!hasNavigatorSW()) return;

  // 自毁开关 SW 在 activate 阶段会 postMessage({type: "yinjie-sw-please-reload"})
  // 兜底（如果 client.navigate 在某些平台被禁止）。一旦收到，主动 reload。
  try {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data as { type?: string } | null;
      if (data && data.type === "yinjie-sw-please-reload") {
        try {
          window.sessionStorage.setItem(CLEANUP_GUARD_KEY, "1");
        } catch {
          // ignore
        }
        window.location.reload();
      }
    });
  } catch {
    // ignore
  }

  // 兜底清理：sessionStorage 守护，每个标签页最多 reload 一次。
  let alreadyCleaned = false;
  try {
    alreadyCleaned = window.sessionStorage.getItem(CLEANUP_GUARD_KEY) === "1";
  } catch {
    alreadyCleaned = true;
  }
  if (alreadyCleaned) {
    return;
  }

  void (async () => {
    const didCleanup = await unregisterAllAndClearCaches();
    try {
      window.sessionStorage.setItem(CLEANUP_GUARD_KEY, "1");
    } catch {
      // ignore
    }
    if (didCleanup) {
      window.location.reload();
    }
  })();
}
