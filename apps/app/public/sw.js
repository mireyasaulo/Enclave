// Service Worker 「自毁开关」
//
// 历史版本（vite-plugin-pwa generateSW）会 precache 所有 assets 并 CacheFirst
// 拦截，导致重新构建后用户死活拿不到新 chunk。彻底放弃 SW 缓存，用这段脚本
// 替换掉之前所有版本的 SW：
//   1. 浏览器周期性 fetch /sw.js 做 update check，拿到这一段后视为新版本；
//   2. install 阶段 skipWaiting，立刻进入 activating；
//   3. activate 阶段清掉所有 caches、unregister 自己、并 navigate 所有受控
//      client，让它们刷新到「无 SW」的状态。
// 后续访问 navigator.serviceWorker.controller 一直为空，请求直接走 nginx。
//
// 不再让任何代码主动 register('/sw.js')；这份脚本只是兜底处理已存量装机。

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // ignore
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          // navigate(client.url) 兼容性比 client.postMessage 触发 reload 更稳。
          // 注意：unregister 之后这次 navigate 仍会被这个 SW 兜底一会儿，
          // 但下一次刷新就完全脱离 SW 了。
          try {
            client.navigate(client.url);
          } catch (e) {
            // 忽略（部分平台禁止跨 origin navigate，不影响 unregister 已完成）
          }
        }
      } catch (e) {
        // ignore
      }
    })(),
  );
});

// fetch 直接 passthrough，不缓存任何东西。activate 之前的过渡期也不会拦截。
self.addEventListener("fetch", () => {
  // intentionally empty — let the browser handle the request
});
