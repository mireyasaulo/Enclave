import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDir = dirname(fileURLToPath(import.meta.url));
const shellDir = resolve(currentDir, "..");
const iosRoot = resolve(shellDir, "ios", "App");
const buildDir = resolve(shellDir, "build", "ios");
const archivePath = resolve(buildDir, "App.xcarchive");
const exportDir = resolve(buildDir, "Export");
const renderedExportOptionsPath = resolve(buildDir, "ExportOptions.plist");
const exportOptionsTemplatePath = resolve(
  shellDir,
  "xcode-template",
  "ExportOptions.plist.example",
);

const args = process.argv.slice(2);
const stopAt = (() => {
  for (const arg of args) {
    if (arg.startsWith("--stop-at=")) {
      return arg.slice("--stop-at=".length);
    }
  }
  return "ipa";
})();

const skipPrepareWeb = args.includes("--skip-prepare-web");
const skipSync = args.includes("--skip-sync");
const skipConfigure = args.includes("--skip-configure");
const skipPodInstall = args.includes("--skip-pod-install");

function fail(message) {
  console.error(`error  ${message}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    fail(`${name} is required for iOS release builds`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  const value = (process.env[name] ?? "").trim();
  return value || fallback;
}

function run(command, commandArgs, options = {}) {
  console.log(`$ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? shellDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    fail(`${command} exited with status ${result.status}`);
  }

  if (result.error) {
    fail(`${command} failed: ${result.error.message}`);
  }
}

function ensureBuildDir() {
  if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true, force: true });
  }
  mkdirSync(buildDir, { recursive: true });
}

function ensureMacOs() {
  if (process.platform !== "darwin") {
    fail(
      `iOS IPA builds require macOS + Xcode; current platform is ${process.platform}`,
    );
  }
}

function ensureXcodebuild() {
  const result = spawnSync("xcodebuild", ["-version"], { stdio: "pipe" });
  if (typeof result.status !== "number" || result.status !== 0) {
    fail("xcodebuild is not available — install Xcode + command line tools");
  }
}

function ensurePod() {
  const result = spawnSync("pod", ["--version"], { stdio: "pipe" });
  if (typeof result.status !== "number" || result.status !== 0) {
    fail("CocoaPods (pod) is not installed — run `sudo gem install cocoapods`");
  }
}

// Xcode 15+ uses new method names; xcodebuild on Xcode <15 still wants legacy names.
function resolveExportMethod(method) {
  const known = new Set([
    "app-store-connect",
    "release-testing",
    "debugging",
    "enterprise",
    "app-store",
    "ad-hoc",
    "development",
  ]);

  if (!known.has(method)) {
    fail(
      `YINJIE_IOS_EXPORT_METHOD must be one of: app-store-connect, release-testing, debugging, enterprise (current value: "${method}")`,
    );
  }

  return method;
}

function renderExportOptions(envForRender) {
  const explicitPath = optionalEnv("YINJIE_IOS_EXPORT_OPTIONS_PLIST");
  if (explicitPath) {
    const resolved = resolve(shellDir, explicitPath);
    if (!existsSync(resolved)) {
      fail(`YINJIE_IOS_EXPORT_OPTIONS_PLIST points to a missing file: ${resolved}`);
    }
    return resolved;
  }

  if (!existsSync(exportOptionsTemplatePath)) {
    fail(`Missing ExportOptions template: ${exportOptionsTemplatePath}`);
  }

  let rendered = readFileSync(exportOptionsTemplatePath, "utf8");
  rendered = rendered.replace(
    /<key>method<\/key>\s*<string>[^<]*<\/string>/m,
    `<key>method</key>\n  <string>${envForRender.method}</string>`,
  );
  rendered = rendered.replace(
    /__YINJIE_IOS_DEVELOPMENT_TEAM__/g,
    envForRender.teamId,
  );
  rendered = rendered.replace(
    /__YINJIE_IOS_BUNDLE_IDENTIFIER__/g,
    envForRender.bundleId,
  );
  rendered = rendered.replace(
    /__YINJIE_IOS_PROVISIONING_PROFILE_SPECIFIER__/g,
    envForRender.provisioningProfile ?? "",
  );

  if (envForRender.signingStyle === "Manual") {
    rendered = rendered.replace(
      /<key>signingStyle<\/key>\s*<string>[^<]*<\/string>/m,
      `<key>signingStyle</key>\n  <string>manual</string>`,
    );

    // Uncomment the manual signing block when style=manual.
    //
    // 老实现拿 `<!--\s*[\s\S]*?<key>signingCertificate</key>...<\/dict>\s*-->`
    // 起头匹配「第一个 <!-- 一直延伸到 signingCertificate 那行所在的 -->」，
    // 但模板文件最顶上还有一段「method options」中文 doc 注释、其后又有一段
    // 「手动签名时取消下面 4 行注释」中文小注释 —— 正则的 `<!--` 命中的是
    // 最顶上的 method options 注释，`[\s\S]*?` 一路吃到 signingCertificate
    // 块。然后 replace 里 `^\s*<!--\s*` / `-->\s*$` 也只剥最外层的一对，
    // 导致：
    //   1. method options 中文 doc 注释失去外壳，变成裸露在 <dict> 下的
    //      raw XML 文本，xcodebuild 解析 plist 直接 syntax-error；
    //   2. signingCertificate 块本身的 <!-- ... --> 内层注释还在，依旧整段
    //      被注释掉，xcodebuild manual 导出缺 signingCertificate /
    //      provisioningProfiles 必死。
    //
    // CI workflow ios-release.yml job-level env 写死 CODE_SIGN_STYLE=Manual，
    // 这条路径就是 CI 跑 export 的唯一通路 —— 任何一次 manual 签名导出都
    // 会撞这个 bug，目前从没人在 CI 上把 IPA 真正出过。
    //
    // 改成精确匹配「signingCertificate 块自己的 <!-- ... -->」+ 捕获内层
    // 内容做 single-pass 替换，不会再误伤前面的中文 doc 注释。
    rendered = rendered.replace(
      /<!--\s*(<key>signingCertificate<\/key>[\s\S]*?<\/dict>)\s*-->/m,
      "$1",
    );
  }

  writeFileSync(renderedExportOptionsPath, rendered);
  console.log(`info  rendered ExportOptions.plist -> ${renderedExportOptionsPath}`);
  return renderedExportOptionsPath;
}

function findFirstIpaUnder(directory) {
  if (!existsSync(directory)) {
    return null;
  }

  const entries = readdirSync(directory);
  for (const entry of entries) {
    const entryPath = resolve(directory, entry);
    const stats = statSync(entryPath);
    if (stats.isFile() && entryPath.endsWith(".ipa")) {
      return entryPath;
    }

    if (stats.isDirectory()) {
      const nested = findFirstIpaUnder(entryPath);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function uploadToAppStoreConnectIfRequested(ipaPath) {
  const apiKeyId = optionalEnv("YINJIE_IOS_APPSTORE_API_KEY_ID");
  const issuerId = optionalEnv("YINJIE_IOS_APPSTORE_API_ISSUER_ID");
  const apiKeyPath = optionalEnv("YINJIE_IOS_APPSTORE_API_KEY_PATH");

  if (!apiKeyId && !issuerId && !apiKeyPath) {
    return;
  }

  if (!apiKeyId || !issuerId || !apiKeyPath) {
    console.log(
      "warn  App Store Connect upload requested but YINJIE_IOS_APPSTORE_API_KEY_ID / _ISSUER_ID / _KEY_PATH are not all set; skipping upload.",
    );
    return;
  }

  if (!existsSync(apiKeyPath)) {
    fail(`YINJIE_IOS_APPSTORE_API_KEY_PATH points to a missing file: ${apiKeyPath}`);
  }

  run("xcrun", [
    "altool",
    "--upload-app",
    "--type",
    "ios",
    "--file",
    ipaPath,
    "--apiKey",
    apiKeyId,
    "--apiIssuer",
    issuerId,
  ]);
}

ensureMacOs();
ensureXcodebuild();

// ---- 1. Web bundle + runtime config + native sync ----
if (!skipPrepareWeb) {
  run("pnpm", ["run", "prepare:web"]);
}

if (!skipSync) {
  run("pnpm", ["run", "sync"]);
}

if (!skipConfigure) {
  run("pnpm", ["run", "configure"]);
}

// ---- 2. CocoaPods ----
if (!skipPodInstall) {
  ensurePod();
  run("pod", ["install"], { cwd: iosRoot });
}

if (stopAt === "configure") {
  console.log("info  --stop-at=configure reached; skipping archive/export");
  process.exit(0);
}

// ---- 3. Archive ----
const scheme = optionalEnv("YINJIE_IOS_XCODE_SCHEME", "App");
const configuration = optionalEnv("YINJIE_IOS_XCODE_CONFIGURATION", "Release");
const teamId = requireEnv("YINJIE_IOS_DEVELOPMENT_TEAM");
const bundleId = requireEnv("YINJIE_IOS_BUNDLE_IDENTIFIER");
const marketingVersion = requireEnv("YINJIE_IOS_MARKETING_VERSION");
const buildNumber = requireEnv("YINJIE_IOS_BUILD_NUMBER");
const codeSignStyle = optionalEnv("YINJIE_IOS_CODE_SIGN_STYLE", "Automatic");
const provisioningProfile = optionalEnv(
  "YINJIE_IOS_PROVISIONING_PROFILE_SPECIFIER",
);
const codeSignIdentity = optionalEnv("YINJIE_IOS_CODE_SIGN_IDENTITY");
const exportMethod = resolveExportMethod(
  optionalEnv("YINJIE_IOS_EXPORT_METHOD", "ad-hoc"),
);

if (codeSignStyle === "Manual" && !provisioningProfile) {
  fail(
    "CODE_SIGN_STYLE=Manual but YINJIE_IOS_PROVISIONING_PROFILE_SPECIFIER is empty",
  );
}

ensureBuildDir();

const archiveArgs = [
  "-workspace",
  resolve(iosRoot, "App.xcworkspace"),
  "-scheme",
  scheme,
  "-configuration",
  configuration,
  "-destination",
  "generic/platform=iOS",
  "-archivePath",
  archivePath,
  `DEVELOPMENT_TEAM=${teamId}`,
  `PRODUCT_BUNDLE_IDENTIFIER=${bundleId}`,
  `MARKETING_VERSION=${marketingVersion}`,
  `CURRENT_PROJECT_VERSION=${buildNumber}`,
  `CODE_SIGN_STYLE=${codeSignStyle}`,
  "archive",
];

if (codeSignStyle === "Manual") {
  archiveArgs.push(`PROVISIONING_PROFILE_SPECIFIER=${provisioningProfile}`);
  if (codeSignIdentity) {
    archiveArgs.push(`CODE_SIGN_IDENTITY=${codeSignIdentity}`);
  }
}

run("xcodebuild", archiveArgs);
console.log(`info  archive ready at ${archivePath}`);

if (stopAt === "archive") {
  console.log("info  --stop-at=archive reached; skipping export");
  process.exit(0);
}

// ---- 4. Export ----
const exportOptionsPlist = renderExportOptions({
  method: exportMethod,
  teamId,
  bundleId,
  signingStyle: codeSignStyle,
  provisioningProfile,
});

run("xcodebuild", [
  "-exportArchive",
  "-archivePath",
  archivePath,
  "-exportPath",
  exportDir,
  "-exportOptionsPlist",
  exportOptionsPlist,
  "-allowProvisioningUpdates",
]);

const ipaPath = findFirstIpaUnder(exportDir);
if (!ipaPath) {
  fail(`expected an .ipa under ${exportDir} after export, but none was found`);
}

console.log("");
console.log(`info  iOS IPA exported to ${ipaPath}`);

if (stopAt === "export") {
  console.log("info  --stop-at=export reached; skipping App Store Connect upload");
  process.exit(0);
}

// ---- 5. Optional App Store Connect upload ----
uploadToAppStoreConnectIfRequested(ipaPath);

console.log("");
console.log("done.");
