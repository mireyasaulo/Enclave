import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEMETRY_UPSTREAM =
  process.env.SITE_TELEMETRY_UPSTREAM ?? "http://127.0.0.1:3001";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  transpilePackages: ["@yinjie/i18n", "@yinjie/ui"],
  experimental: {
    swcPlugins: [["@lingui/swc-plugin", {}]],
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.po$/,
      use: ["@lingui/loader"],
    });
    return config;
  },
  async rewrites() {
    // beforeFiles 让代理在 i18n middleware 的 locale 重定向之前命中，
    // 否则 /telemetry/events/batch 会被改写成 /zh-CN/telemetry/... 308。
    return {
      beforeFiles: [
        {
          source: "/telemetry/:path*",
          destination: `${TELEMETRY_UPSTREAM}/telemetry/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default config;
