import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const shellConfigPath = path.resolve(cwd, "ios-shell.config.json");
const shellLocalConfigPath = path.resolve(cwd, "ios-shell.config.local.json");
const templatePath = path.resolve(cwd, "runtime-config.example.json");
const outputPath = path.resolve(cwd, "../app/dist-mobile/runtime-config.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to parse ${path.relative(cwd, filePath)}: ${error.message}`);
    process.exit(1);
  }
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function pickEnv(name) {
  return normalizeOptionalString(process.env[name]) || null;
}

const shellConfig = readJsonIfExists(shellConfigPath);
if (!shellConfig) {
  console.error(`Missing ios-shell.config.json at ${shellConfigPath}`);
  process.exit(1);
}

const localConfig = readJsonIfExists(shellLocalConfigPath) ?? {};
const template = readJsonIfExists(templatePath) ?? {};

const baseRuntime = shellConfig.runtime ?? {};
const localRuntime = localConfig.runtime ?? {};

// 优先级：env > local > shell config > template
const apiBaseUrl =
  pickEnv("YINJIE_IOS_CORE_API_BASE_URL") ||
  normalizeOptionalString(localRuntime.apiBaseUrl) ||
  normalizeOptionalString(baseRuntime.apiBaseUrl) ||
  normalizeOptionalString(template.apiBaseUrl);

if (!apiBaseUrl) {
  console.error(
    "Missing apiBaseUrl. Set runtime.apiBaseUrl in ios-shell.config.json (or ios-shell.config.local.json) or export YINJIE_IOS_CORE_API_BASE_URL.",
  );
  process.exit(1);
}

const socketBaseUrl =
  pickEnv("YINJIE_IOS_SOCKET_BASE_URL") ||
  normalizeOptionalString(localRuntime.socketBaseUrl) ||
  normalizeOptionalString(baseRuntime.socketBaseUrl) ||
  normalizeOptionalString(template.socketBaseUrl) ||
  apiBaseUrl;

const environment =
  pickEnv("YINJIE_IOS_ENVIRONMENT") ||
  normalizeOptionalString(localRuntime.environment) ||
  normalizeOptionalString(baseRuntime.environment) ||
  normalizeOptionalString(template.environment) ||
  "production";

const publicAppName =
  pickEnv("YINJIE_IOS_PUBLIC_APP_NAME") ||
  normalizeOptionalString(localRuntime.publicAppName) ||
  normalizeOptionalString(baseRuntime.publicAppName) ||
  normalizeOptionalString(template.publicAppName) ||
  "Yinjie";

const applicationId =
  pickEnv("YINJIE_IOS_BUNDLE_IDENTIFIER") ||
  normalizeOptionalString(localConfig.appId) ||
  normalizeOptionalString(shellConfig.appId);

const appVersionName =
  pickEnv("YINJIE_IOS_MARKETING_VERSION") ||
  normalizeOptionalString(localConfig.marketingVersion) ||
  normalizeOptionalString(shellConfig.marketingVersion);

const buildNumberRaw =
  pickEnv("YINJIE_IOS_BUILD_NUMBER") ||
  (localConfig.buildNumber !== undefined ? String(localConfig.buildNumber) : null) ||
  (shellConfig.buildNumber !== undefined ? String(shellConfig.buildNumber) : null);
const appVersionCode = buildNumberRaw ? Number(buildNumberRaw) : null;

const runtimeConfig = {
  ...template,
  apiBaseUrl,
  socketBaseUrl,
  environment,
  publicAppName,
  applicationId: applicationId || null,
  appVersionName: appVersionName || null,
  appVersionCode: Number.isFinite(appVersionCode) ? appVersionCode : null,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`);
console.log(`Injected iOS runtime config into ${outputPath}`);
console.log(
  `  applicationId=${runtimeConfig.applicationId ?? "(unset)"} appVersionName=${runtimeConfig.appVersionName ?? "(unset)"} appVersionCode=${runtimeConfig.appVersionCode ?? "(unset)"} env=${runtimeConfig.environment}`,
);
