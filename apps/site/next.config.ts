import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  transpilePackages: ["@yinjie/i18n", "@yinjie/ui"],
  webpack(config) {
    config.module.rules.push({
      test: /\.po$/,
      use: ["@lingui/loader"],
    });
    return config;
  },
};

export default config;
