// SW 已经从 app 整体下线：
//   - vite.config.ts 不再用 vite-plugin-pwa 生成 sw.js；
//   - public/sw.js 是「自毁开关」，浏览器 update check 拿到后会 unregister
//     自己 + 清掉所有 caches，让历史装机的 SW 干净退出；
//   - 这个函数保留只是为了让 main.tsx 现有调用点不报错；调用即 no-op。
// 之前的 SW precache 在多次构建之间锁住旧 chunk，导致用户拿不到新代码，
// 这条路径不再值得维护——索性彻底走 nginx + 浏览器 HTTP 缓存。
export function registerAppServiceWorker() {
  // intentionally no-op
}
