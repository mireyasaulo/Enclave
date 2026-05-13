import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import type { CloudWorldEntity } from "../entities/cloud-world.entity";

type ConfigReader = {
  get<T = string>(propertyPath: string): T | undefined;
};

// cloud-api 在 dev-services.mjs 里 cwd=rootDir 启动；走到这里时 process.cwd() 就是
// 仓库根。打包后 __dirname 在 dist 子树里深度不固定，用 cwd 兜底最稳。
const REPO_ROOT = process.cwd();

function trim(value?: string | null) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || null;
}

// 默认指向 dev-services.mjs 里 admin app 的 vite 端口。线上部署需通过 env 覆盖。
const DEFAULT_DEV_ADMIN_FRONTEND_BASE_URL = "http://127.0.0.1:5181";

export function resolveAdminFrontendBaseUrl(
  world: Pick<CloudWorldEntity, "adminUrl">,
  config: ConfigReader,
): string | null {
  const fromWorld = trim(world.adminUrl);
  if (fromWorld) {
    return fromWorld;
  }

  const fromConfig = trim(config.get<string>("CLOUD_ADMIN_FRONTEND_BASE_URL"));
  if (fromConfig) {
    return fromConfig;
  }

  return DEFAULT_DEV_ADMIN_FRONTEND_BASE_URL;
}

let cachedSecretFromFile: { value: string; loadedAt: number } | null = null;
const FILE_CACHE_TTL_MS = 60_000;

export function resolveWorldAdminSecret(config: ConfigReader): string | null {
  const fromEnv = config.get<string>("ADMIN_SECRET")?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (
    cachedSecretFromFile &&
    Date.now() - cachedSecretFromFile.loadedAt < FILE_CACHE_TTL_MS
  ) {
    return cachedSecretFromFile.value;
  }

  // 子 world api 进程的 cwd=api，NestJS ConfigModule 加载 api/.env。
  // cloud-api 本身没声明 ADMIN_SECRET 时，sniff 子进程会用的那个值，
  // 这样云控制台一键进后台不需要额外配置就能 work。
  const apiEnvPath = path.join(REPO_ROOT, "api", ".env");
  if (!existsSync(apiEnvPath)) {
    return null;
  }

  try {
    const contents = readFileSync(apiEnvPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*ADMIN_SECRET\s*=\s*(.+?)\s*$/.exec(line);
      if (!match) continue;
      const rawValue = match[1].trim();
      const unquoted =
        rawValue.startsWith('"') && rawValue.endsWith('"')
          ? rawValue.slice(1, -1)
          : rawValue.startsWith("'") && rawValue.endsWith("'")
            ? rawValue.slice(1, -1)
            : rawValue;
      if (unquoted) {
        cachedSecretFromFile = { value: unquoted, loadedAt: Date.now() };
        return unquoted;
      }
    }
  } catch {
    return null;
  }

  return null;
}
