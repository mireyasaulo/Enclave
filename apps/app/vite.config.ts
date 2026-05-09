import { fileURLToPath, URL } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteCompression from "vite-plugin-compression";

function resolveManualChunk(id: string) {
  const normalizedId = id.replace(/\\/g, "/");

  if (normalizedId.includes("/node_modules/")) {
    if (
      normalizedId.includes("/react/") ||
      normalizedId.includes("/react-dom/") ||
      normalizedId.includes("/scheduler/")
    ) {
      return "vendor-react";
    }

    if (normalizedId.includes("/@tanstack/")) {
      return "vendor-tanstack";
    }

    if (normalizedId.includes("/lucide-react/")) {
      return "vendor-icons";
    }

    if (
      normalizedId.includes("/socket.io-client/") ||
      normalizedId.includes("/engine.io-client/") ||
      normalizedId.includes("/socket.io-parser/")
    ) {
      return "vendor-socket";
    }

    if (
      normalizedId.includes("/react-hook-form/") ||
      normalizedId.includes("/@hookform/resolvers/")
    ) {
      return "vendor-forms";
    }

    if (normalizedId.includes("/zustand/")) {
      return "vendor-state";
    }

    if (
      normalizedId.includes("/@tauri-apps/api/") ||
      normalizedId.includes("/@capacitor/core/")
    ) {
      return "vendor-shell";
    }

    return "vendor-misc";
  }

  if (normalizedId.includes("/packages/ui/src/")) {
    return "workspace-ui";
  }

  if (normalizedId.includes("/packages/contracts/src/")) {
    return "workspace-contracts";
  }

  if (normalizedId.includes("/packages/config/src/")) {
    return "workspace-config";
  }

  return undefined;
}

function resolveAppBase(command: "build" | "serve") {
  if (command !== "build") {
    return "/";
  }

  return process.env.YINJIE_APP_BUILD_BASE === "relative" ? "./" : "/";
}

function shouldEmptyOutDir(_command: "build" | "serve") {
  // 历史上为兼容已打开页签的 lazy-load 需求保留过旧 hash chunk，但实际部署
  // 现场会无限堆积（dist/assets 曾累积到 25k 文件 / 434MB）；main.tsx 已内置
  // vite:preloadError 兜底监听，旧版本页签拉不到旧 chunk 时会自动 reload，
  // 因此这里直接清空，最稳。
  return true;
}

// 公网隧道下首屏多了一个被 Vite 注入的 <link rel="stylesheet"> 阻塞渲染。
// app 的 boot screen 自带 inline critical CSS（index.html 头部），browser 完全
// 可以先把 boot screen 画出来，主 CSS 异步到位后再切到正式 UI。把 build 输出的
// stylesheet link 改成 preload + onload 切换 rel='stylesheet' 的异步加载形态，
// 省掉 1 个阻塞渲染的 RTT。<noscript> 兜底覆盖禁用 JS 的极端情况。
function asyncCssPlugin() {
  return {
    name: "yinjie-app-async-css",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /<link\s+rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/g,
        (_match, before, href, after) => {
          const otherAttrs = `${before}${after}`.trim();
          return `<link rel="preload" as="style" href="${href}" ${otherAttrs} onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${href}" ${otherAttrs}></noscript>`;
        },
      );
    },
  };
}

export default defineConfig(({ command }) => ({
  base: resolveAppBase(command),
  plugins: [
    react({
      babel: {
        plugins: ["@lingui/babel-plugin-lingui-macro"],
      },
    }),
    lingui(),
    tailwindcss(),
    asyncCssPlugin(),
    // 公网隧道下首屏要省字节，vite-plugin-compression 在构建期生成 *.gz 同名
    // 兄弟文件，nginx 通过 gzip_static on 直接吐，不再现压（CPU + 体积同省）。
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
      deleteOriginFile: false,
    }),
    // SW 已下线（之前 vite-plugin-pwa generateSW 把所有 chunk precache + CacheFirst
    // 拦截，多次构建之间用户死活拿不到新代码）。public/sw.js 改成「自毁开关」
    // 接管历史装机，main.tsx 也不再 register，新用户根本不会装 SW。
  ],
  build: {
    emptyOutDir: shouldEmptyOutDir(command),
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  resolve: {
    alias: {
      "@yinjie/ui/tokens.css": fileURLToPath(new URL("../../packages/ui/src/tokens.css", import.meta.url)),
      "@yinjie/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
      "@yinjie/config": fileURLToPath(new URL("../../packages/config/src/index.ts", import.meta.url)),
      "@yinjie/i18n": fileURLToPath(new URL("../../packages/i18n/src/index.ts", import.meta.url)),
      "@yinjie/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5180,
    allowedHosts: ["1gw06751dd053.vicp.fun"],
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "ws://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
      },
      // 远程访问（花生壳/反代）时，前端 cloudApiBaseUrl 回落到浏览器同源，
      // 这里把 /cloud/* 转发到本机 cloud-api（端口 3001）。
      "/cloud": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/admin/cloud": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      // 客户端埋点 SDK 上报到 cloud-api 的 telemetry 入口。
      "/telemetry": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
}));
