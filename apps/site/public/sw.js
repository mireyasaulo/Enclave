// 隐界官网 Service Worker（手写 minimal，无 workbox 依赖）。
// 策略：
//   - immutable 静态资源(/_next/static, /screenshots, /animations, /icons, /fonts,
//     /_next/image)：CacheFirst —— 重访直接从缓存吐，0 网络。
//   - HTML(/, /zh-CN, /en-US/..., /use-cases/*)：NetworkFirst —— 总是先尝试网络
//     拿最新版（chunk hash 才会指向最新 JS），离线时回 cache 兜底。
//   - 其他(/api, /telemetry, *)：passthrough，不拦截。
// 调试：DevTools → Application → Service Workers → Unregister。
//
// 版本号：改 SW 行为本身时手动 bump 一次 → 重新激活时 activate 钩子会清掉旧 cache。
//        chunk hash 自带版本，所以 immutable cache 永远有效，不需要因为发版 bump。

const CACHE_VERSION = "v1";
const STATIC_CACHE = `yinjie-site-static-${CACHE_VERSION}`;
const HTML_CACHE = `yinjie-site-html-${CACHE_VERSION}`;

const STATIC_PATH_PREFIXES = [
  "/_next/static/",
  "/_next/image",
  "/screenshots/",
  "/animations/",
  "/icons/",
  "/fonts/",
];

const HTML_PATH_PREFIXES = [
  "/zh-CN",
  "/en-US",
  "/ja-JP",
  "/ko-KR",
  "/use-cases",
];

const PASSTHROUGH_PREFIXES = ["/api/", "/telemetry/"];

self.addEventListener("install", (event) => {
  // 不预缓存任何 URL —— precache 列表会随发版变化，与其维护不如让首访自然填充。
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("yinjie-site-") && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStatic(url) {
  return STATIC_PATH_PREFIXES.some((p) => url.pathname.startsWith(p));
}

function isHtml(request, url) {
  if (request.method !== "GET") return false;
  if (PASSTHROUGH_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
  if (url.pathname === "/" ) return true;
  if (HTML_PATH_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return true;
  }
  // 兜底：Accept 头里要 HTML 的也算
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && (res.type === "basic" || res.type === "default")) {
    cache.put(request, res.clone()).catch(() => {});
  }
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PASSTHROUGH_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (isStatic(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (isHtml(request, url)) {
    event.respondWith(networkFirst(request, HTML_CACHE));
    return;
  }
});
