import { fileURLToPath, URL } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["@lingui/babel-plugin-lingui-macro"],
      },
    }),
    lingui(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@yinjie/ui/tokens.css": fileURLToPath(
        new URL("../../packages/ui/src/tokens.css", import.meta.url),
      ),
      "@yinjie/ui": fileURLToPath(
        new URL("../../packages/ui/src/index.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    allowedHosts: ["yinjieai.top", "1gw06751dd053.vicp.fun"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3045",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3045",
        changeOrigin: true,
      },
      "/telemetry": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  // vite preview 不读 server.*，必须单独配；否则 yinjieai.top 直接被 Vite 拒成
  // "Blocked request: Host not in allowedHosts"。`pnpm wiki:prod` 走的就是这块。
  preview: {
    host: "127.0.0.1",
    port: 5184,
    strictPort: true,
    allowedHosts: ["yinjieai.top", "1gw06751dd053.vicp.fun"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3045",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3045",
        changeOrigin: true,
      },
      "/telemetry": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
