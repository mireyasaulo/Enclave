// Service Worker 「自毁开关」
//
// 历史版本（vite-plugin-pwa generateSW）会 precache 所有 assets 并 CacheFirst
// 拦截，导致重新构建后用户死活拿不到新 chunk。彻底放弃 SW 缓存，用这段脚本
// 替换掉之前所有版本的 SW：
//   1. 浏览器周期性 fetch /sw.js 做 update check，拿到这一段后视为新版本；
//   2. install 阶段 skipWaiting，立刻进入 activating；
//   3. activate 阶段：claim → 清 caches → 通知 client 刷新 → unregister 自己。
//
// 顺序很重要：必须先 claim 才能 matchAll 到原来由旧 SW 控制的 tab；必须在
// unregister 之前 navigate 客户端，否则 SW 被销毁后 navigate 无法兜底。

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. 抢占已经被旧 SW 控制的 tab —— 没有这一步 matchAll 会返回空集合。
      try {
        await self.clients.claim();
      } catch (e) {
        // ignore
      }
      // 2. 清掉旧 SW 的所有 caches（precache + 运行时 cache）。
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // ignore
      }
      // 3. 让所有受控 tab 重新加载，刷新到「无 SW + 拿新 chunk」的状态。
      try {
        const clientList = await self.clients.matchAll({ type: "window" });
        for (const client of clientList) {
          try {
            client.navigate(client.url);
          } catch (e) {
            // 部分平台/iframe 禁止 navigate，忽略；postMessage 兜底
            try {
              client.postMessage({ type: "yinjie-sw-please-reload" });
            } catch (e2) {
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore
      }
      // 4. 最后 unregister 自己。放最后做：早 unregister 会让 navigate 失败。
      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }
    })(),
  );
});

// fetch handler 必须存在但 passthrough，不能 respondWith 任何东西，
// 让 SW 控制下的请求都直接走网络。
self.addEventListener("fetch", () => {
  // intentionally empty — browser handles the request via the network stack
});
