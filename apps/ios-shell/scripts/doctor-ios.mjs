import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const shellRoot = path.resolve(scriptDir, "..");
const iosAppRoot = path.join(shellRoot, "ios", "App", "App");
const infoPlistPath = path.join(iosAppRoot, "Info.plist");
const appDelegatePath = path.join(iosAppRoot, "AppDelegate.swift");
const runtimePluginPath = path.join(
  iosAppRoot,
  "Plugins",
  "YinjieRuntimePlugin.swift",
);
const secureStoragePluginPath = path.join(
  iosAppRoot,
  "Plugins",
  "YinjieSecureStoragePlugin.swift",
);
const mobileBridgePluginPath = path.join(
  iosAppRoot,
  "Plugins",
  "YinjieMobileBridgePlugin.swift",
);
const projectPath = path.join(shellRoot, "ios", "App", "App.xcodeproj", "project.pbxproj");
const entitlementsPath = path.join(iosAppRoot, "App.entitlements");
const privacyManifestPath = path.join(iosAppRoot, "PrivacyInfo.xcprivacy");
const capacitorConfigPath = path.join(shellRoot, "capacitor.config.ts");
const webDistIndexPath = path.resolve(shellRoot, "..", "app", "dist-mobile", "index.html");
const shellConfigPath = path.join(shellRoot, "ios-shell.config.json");
const shellLocalConfigPath = path.join(shellRoot, "ios-shell.config.local.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveConfiguredApiBaseUrl() {
  const envValue = (process.env.YINJIE_IOS_CORE_API_BASE_URL ?? "").trim();
  if (envValue) return { value: envValue, source: "env" };
  const local = readJsonIfExists(shellLocalConfigPath);
  const localValue = (local?.runtime?.apiBaseUrl ?? "").trim();
  if (localValue) return { value: localValue, source: "ios-shell.config.local.json" };
  const base = readJsonIfExists(shellConfigPath);
  const baseValue = (base?.runtime?.apiBaseUrl ?? "").trim();
  if (baseValue) return { value: baseValue, source: "ios-shell.config.json" };
  return { value: null, source: null };
}

function resolveConfiguredCloudApiBaseUrl() {
  const envValue = (process.env.YINJIE_IOS_CLOUD_API_BASE_URL ?? "").trim();
  if (envValue) return { value: envValue, source: "env" };
  const local = readJsonIfExists(shellLocalConfigPath);
  const localValue = (local?.runtime?.cloudApiBaseUrl ?? "").trim();
  if (localValue) return { value: localValue, source: "ios-shell.config.local.json" };
  const base = readJsonIfExists(shellConfigPath);
  const baseValue = (base?.runtime?.cloudApiBaseUrl ?? "").trim();
  if (baseValue) return { value: baseValue, source: "ios-shell.config.json" };
  return { value: null, source: null };
}
const infoPlistStringLocalizations = ["zh-Hans", "en", "ja", "ko"];
const requiredInfoPlistStringKeys = [
  "CFBundleDisplayName",
  "YinjiePublicAppName",
  "NSCameraUsageDescription",
  "NSPhotoLibraryUsageDescription",
  "NSPhotoLibraryAddUsageDescription",
  "NSMicrophoneUsageDescription",
];

function fileIncludes(filePath, pattern) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return fs.readFileSync(filePath, "utf8").includes(pattern);
}

function fileIncludesAll(filePath, patterns) {
  return patterns.every((pattern) => fileIncludes(filePath, pattern));
}

function fileMatches(filePath, regex) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  return regex.test(fs.readFileSync(filePath, "utf8"));
}

function plistKeyHasEmptyString(filePath, key) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const source = fs.readFileSync(filePath, "utf8");
  const pattern = new RegExp(
    `<key>${key}</key>\\s*<string></string>`,
    "m",
  );
  return pattern.test(source);
}

const checks = [
  {
    label: "platform",
    ok: process.platform === "darwin",
    detail: process.platform === "darwin" ? "running on macOS" : `current platform is ${process.platform}, Xcode work must run on macOS`,
  },
  {
    label: "xcode-template",
    ok:
      fs.existsSync(path.join(shellRoot, "xcode-template", "Info.plist.example")) &&
      fs.existsSync(path.join(shellRoot, "xcode-template", "AppDelegatePush.example.swift")),
    detail: "xcode-template samples are present",
  },
  {
    label: "runtime-config-template",
    ok: fs.existsSync(path.join(shellRoot, "runtime-config.example.json")),
    detail: "runtime-config.example.json is present",
  },
  {
    label: "plugin-stubs",
    ok:
      fs.existsSync(path.join(shellRoot, "plugins", "swift-stub", "YinjieRuntimePlugin.swift")) &&
      fs.existsSync(path.join(shellRoot, "plugins", "swift-stub", "YinjieSecureStoragePlugin.swift")) &&
      fs.existsSync(path.join(shellRoot, "plugins", "swift-stub", "YinjieMobileBridgePlugin.swift")),
    detail: "native plugin stubs are present",
  },
  (() => {
    // configure-ios-project.mjs 用 overwrite:false 把 swift-stub/ 下的文件复制到
    // ios/App/App/Plugins/。fresh checkout 上线时 stub 就是真正装上设备的代码。
    // 如果 stub 跟 installed 漂移（比如 installed 加了剪贴板、推送 token listener
    // 后忘了同步 stub），任何全新打的包都会缺这些方法 → JS 调用直接抛 unimplemented。
    const stubMobileBridge = path.join(
      shellRoot,
      "plugins",
      "swift-stub",
      "YinjieMobileBridgePlugin.swift",
    );
    const stubRuntime = path.join(
      shellRoot,
      "plugins",
      "swift-stub",
      "YinjieRuntimePlugin.swift",
    );
    const stubSecure = path.join(
      shellRoot,
      "plugins",
      "swift-stub",
      "YinjieSecureStoragePlugin.swift",
    );
    const stubMobileBridgeOk = fileIncludesAll(stubMobileBridge, [
      "CAPPluginMethod(name: \"writeClipboardText\"",
      "CAPPluginMethod(name: \"readClipboardText\"",
      "CAPPluginMethod(name: \"writeClipboardImage\"",
      "CAPPluginMethod(name: \"showLocalNotification\"",
      "handlePushTokenChanged",
      "override public func load()",
    ]);
    const stubRuntimeOk = fileIncludesAll(stubRuntime, [
      "bundledConfig[\"cloudApiBaseUrl\"]",
      "CAPPluginMethod(name: \"setLocale\"",
    ]);
    const stubSecureOk = fileIncludes(stubSecure, "struct KeychainError");
    return {
      label: "plugin-stubs-in-sync",
      ok: stubMobileBridgeOk && stubRuntimeOk && stubSecureOk,
      detail:
        stubMobileBridgeOk && stubRuntimeOk && stubSecureOk
          ? "swift-stub plugins carry clipboard/push/locale/cloudApiBaseUrl/KeychainError parity with installed copies"
          : "swift-stub plugins are stale vs ios/App/App/Plugins/ — fresh checkouts will be missing native bridge methods (re-copy from installed)",
    };
  })(),
  {
    label: "ios-project",
    ok: fs.existsSync(path.join(shellRoot, "ios")),
    detail: fs.existsSync(path.join(shellRoot, "ios"))
      ? "Capacitor iOS project directory exists"
      : "no ios/ project yet, run `pnpm ios:sync` on macOS",
  },
  {
    label: "info-plist-privacy",
    ok:
      !fs.existsSync(infoPlistPath) ||
      (fileIncludes(infoPlistPath, "NSCameraUsageDescription") &&
        fileIncludes(infoPlistPath, "NSPhotoLibraryUsageDescription") &&
        fileIncludes(infoPlistPath, "NSPhotoLibraryAddUsageDescription") &&
        fileIncludes(infoPlistPath, "NSMicrophoneUsageDescription")),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist includes camera, photo library, and microphone usage descriptions"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-runtime-keys",
    ok:
      !fs.existsSync(infoPlistPath) ||
      fileIncludesAll(infoPlistPath, [
        "YinjieApiBaseUrl",
        "YinjieSocketBaseUrl",
        "YinjieEnvironment",
        "YinjiePublicAppName",
      ]),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist includes runtime fallback keys for native config injection"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-localizations",
    ok: infoPlistStringLocalizations.every((region) => {
      const stringsPath = path.join(
        iosAppRoot,
        `${region}.lproj`,
        "InfoPlist.strings",
      );
      return fs.existsSync(stringsPath) && fileIncludesAll(stringsPath, requiredInfoPlistStringKeys);
    }),
    detail:
      "InfoPlist.strings exists for zh-Hans, en, ja, and ko with app name and permission strings",
  },
  {
    label: "appdelegate-push-cache",
    ok:
      !fs.existsSync(appDelegatePath) ||
      (fileIncludes(appDelegatePath, "didRegisterForRemoteNotificationsWithDeviceToken") &&
        fileIncludes(appDelegatePath, "YinjiePushToken") &&
        fileIncludes(appDelegatePath, "YinjiePendingLaunchTarget")),
    detail: fs.existsSync(appDelegatePath)
      ? "AppDelegate caches push token and notification launch target"
      : "AppDelegate not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "plugin-bridge-metadata",
    ok:
      (!fs.existsSync(runtimePluginPath) ||
        fileIncludesAll(runtimePluginPath, [
          "CAPBridgedPlugin",
          "jsName = \"YinjieRuntime\"",
          "CAPPluginMethod(name: \"getConfig\"",
          "CAPPluginMethod(name: \"getLocale\"",
          "CAPPluginMethod(name: \"setLocale\"",
        ])) &&
      (!fs.existsSync(secureStoragePluginPath) ||
        fileIncludesAll(secureStoragePluginPath, [
          "CAPBridgedPlugin",
          "jsName = \"YinjieSecureStorage\"",
          "CAPPluginMethod(name: \"get\"",
          "CAPPluginMethod(name: \"set\"",
          "CAPPluginMethod(name: \"remove\"",
        ])) &&
      (!fs.existsSync(mobileBridgePluginPath) ||
        fileIncludesAll(mobileBridgePluginPath, [
          "CAPBridgedPlugin",
          "jsName = \"YinjieMobileBridge\"",
          "CAPPluginMethod(name: \"openAppSettings\"",
          "CAPPluginMethod(name: \"shareFile\"",
          "CAPPluginMethod(name: \"openFile\"",
          "CAPPluginMethod(name: \"pickFile\"",
          "CAPPluginMethod(name: \"captureImage\"",
          "CAPPluginMethod(name: \"showLocalNotification\"",
        ])),
    detail:
      fs.existsSync(runtimePluginPath) ||
      fs.existsSync(secureStoragePluginPath) ||
      fs.existsSync(mobileBridgePluginPath)
        ? "Swift plugins expose CAPBridgedPlugin metadata for Capacitor 7"
        : "plugin files not found yet; run `pnpm ios:configure` after sync",
  },
  {
    label: "plugin-target-membership",
    ok:
      !fs.existsSync(projectPath) ||
      fileIncludesAll(projectPath, [
        "YinjieRuntimePlugin.swift in Sources */,",
        "YinjieSecureStoragePlugin.swift in Sources */,",
        "YinjieMobileBridgePlugin.swift in Sources */,",
        "path = Plugins;",
      ]),
    detail: fs.existsSync(projectPath)
      ? "App.xcodeproj includes the Yinjie Swift plugins in the App target"
      : "Xcode project not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "localization-target-membership",
    ok:
      !fs.existsSync(projectPath) ||
      fileIncludesAll(projectPath, [
        "InfoPlist.strings in Resources",
        "zh-Hans.lproj/InfoPlist.strings",
        "en.lproj/InfoPlist.strings",
        "ja.lproj/InfoPlist.strings",
        "ko.lproj/InfoPlist.strings",
      ]),
    detail: fs.existsSync(projectPath)
      ? "App.xcodeproj includes localized InfoPlist.strings resources"
      : "Xcode project not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "entitlements-config",
    ok:
      (!fs.existsSync(entitlementsPath) ||
        fileIncludesAll(entitlementsPath, [
          "aps-environment",
          "keychain-access-groups",
        ])) &&
      (!fs.existsSync(projectPath) ||
        fileIncludes(projectPath, "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;")),
    detail:
      fs.existsSync(entitlementsPath) && fs.existsSync(projectPath)
        ? "App.entitlements exists and Xcode build settings point CODE_SIGN_ENTITLEMENTS to it"
        : "App.entitlements not seeded yet; run `pnpm ios:configure` to prepare Push/Keychain defaults",
  },
  {
    // applinks:app.example.yinjie.app 是 xcode-template 里的占位符。Round 9
    // 顺手修了「不要 append」，但没把占位本身清掉；configure 只在显式给了
    // YINJIE_IOS_ASSOCIATED_DOMAIN 时才替换。一旦没配，占位直接跟着 release
    // 包上 App Store / TestFlight，iOS 装机每次都会去拉 https://app.example.
    // yinjie.app/.well-known/apple-app-site-association，必失败，console 全
    // 是 swcd 报错。Round 22 让 configure 在无 domain 时清掉占位 entitlement，
    // doctor 同步盯，防止下一次又有人把占位塞回来。
    label: "entitlements-no-example-applink",
    ok:
      !fs.existsSync(entitlementsPath) ||
      !fileIncludes(entitlementsPath, "applinks:app.example.yinjie.app"),
    detail: fs.existsSync(entitlementsPath)
      ? "App.entitlements does not ship the applinks:app.example.yinjie.app placeholder"
      : "App.entitlements not found yet; run `pnpm ios:configure` first",
  },
  {
    label: "privacy-manifest",
    ok:
      (!fs.existsSync(privacyManifestPath) ||
        fileIncludesAll(privacyManifestPath, [
          "NSPrivacyTracking",
          "NSPrivacyCollectedDataTypes",
          "NSPrivacyAccessedAPICategoryUserDefaults",
          "CA92.1",
        ])) &&
      (!fs.existsSync(projectPath) ||
        fileIncludesAll(projectPath, [
          "PrivacyInfo.xcprivacy in Resources",
          "path = PrivacyInfo.xcprivacy;",
        ])),
    detail:
      fs.existsSync(privacyManifestPath) && fs.existsSync(projectPath)
        ? "PrivacyInfo.xcprivacy exists and is added to app resources"
        : "PrivacyInfo.xcprivacy not seeded yet; run `pnpm ios:configure` to prepare App Store privacy defaults",
  },
  {
    // YinjieSecureStoragePlugin 之前直接拿 OSStatus 当 Result.Failure，也直接
    // 塞给 call.reject(_:_:_:Error?)。OSStatus 是 Int32 的 typealias，Swift
    // 标准库不 conform Error，Result.Failure 必须 : Error —— 这条会让整个 iOS
    // 壳过不了 swiftc。必须包一层 KeychainError 走 Error 通道。
    label: "secure-storage-error-bridge",
    ok:
      !fs.existsSync(secureStoragePluginPath) ||
      (fileMatches(
        secureStoragePluginPath,
        /Result<[^>]+,\s*KeychainError>/,
      ) &&
        fileIncludes(secureStoragePluginPath, "struct KeychainError")),
    detail: fs.existsSync(secureStoragePluginPath)
      ? "YinjieSecureStoragePlugin wraps OSStatus in KeychainError (Result.Failure must conform to Error)"
      : "secure storage plugin not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "runtime-plugin-sync",
    ok:
      !fs.existsSync(runtimePluginPath) ||
      (fileIncludes(runtimePluginPath, "bundledConfig[\"apiBaseUrl\"]") &&
        fileIncludes(runtimePluginPath, "bundledConfig[\"cloudApiBaseUrl\"]") &&
        fileIncludes(runtimePluginPath, "worldAccessMode") &&
        fileIncludes(runtimePluginPath, "configStatus") &&
        fileIncludes(runtimePluginPath, "object(forInfoDictionaryKey: \"YinjiePublicAppName\")") &&
        fileIncludes(runtimePluginPath, "preferredLocales") &&
        fileIncludes(runtimePluginPath, "Locale.preferredLanguages")),
    detail: fs.existsSync(runtimePluginPath)
      ? "YinjieRuntime prefers bundled runtime-config.json (includes cloudApiBaseUrl), exposes sync status, and reads localized app metadata plus preferred locale fields"
      : "runtime plugin not found yet; run `pnpm ios:sync` first",
  },
  (() => {
    const resolved = resolveConfiguredApiBaseUrl();
    return {
      label: "core-api-base-url",
      ok: Boolean(resolved.value),
      detail: resolved.value
        ? `apiBaseUrl=${resolved.value} (source: ${resolved.source})`
        : "apiBaseUrl not set anywhere — set runtime.apiBaseUrl in ios-shell.config.json (or ios-shell.config.local.json) or export YINJIE_IOS_CORE_API_BASE_URL; otherwise `pnpm ios:sync` will fail",
    };
  })(),
  (() => {
    // 不接 template fallback：runtime-config.example.json 写了示例域名
    // "https://cloud.example.yinjie.app"，不配置就会被静默注入打包产物，
    // 真机起来后 cloud-api 全 DNS-fail，日志里看不出原因（看着配置成功）。
    // inject-runtime-config.mjs 已经把这条 fallback 拆了，doctor 同步盯。
    const resolved = resolveConfiguredCloudApiBaseUrl();
    return {
      label: "cloud-api-base-url",
      ok: Boolean(resolved.value),
      detail: resolved.value
        ? `cloudApiBaseUrl=${resolved.value} (source: ${resolved.source})`
        : "cloudApiBaseUrl not set anywhere — set runtime.cloudApiBaseUrl in ios-shell.config.json (or ios-shell.config.local.json) or export YINJIE_IOS_CLOUD_API_BASE_URL; capacitor:// origin can't fall back to window.location",
    };
  })(),
  {
    label: "capacitor-config",
    ok:
      fs.existsSync(capacitorConfigPath) &&
      !fileIncludes(capacitorConfigPath, "bundledWebRuntime") &&
      fileIncludesAll(capacitorConfigPath, [
        "SplashScreen",
        "launchShowDuration",
        "StatusBar",
        "Keyboard",
      ]),
    detail: fs.existsSync(capacitorConfigPath)
      ? fileIncludes(capacitorConfigPath, "bundledWebRuntime")
        ? "capacitor.config.ts still defines `bundledWebRuntime` (deprecated since Capacitor 5)"
        : "capacitor.config.ts declares SplashScreen/StatusBar/Keyboard plugin options"
      : "capacitor.config.ts not found",
  },
  {
    label: "capacitor-config-ios-scheme",
    ok:
      !fs.existsSync(capacitorConfigPath) ||
      (!fileMatches(
        capacitorConfigPath,
        /server\s*:\s*\{[\s\S]*?androidScheme/m,
      ) &&
        !fileMatches(
          capacitorConfigPath,
          /server\s*:\s*\{[\s\S]*?hostname/m,
        ) &&
        fileMatches(
          capacitorConfigPath,
          /ios\s*:\s*\{[\s\S]*?scheme\s*:/m,
        )),
    detail: fs.existsSync(capacitorConfigPath)
      ? "capacitor.config.ts declares ios.scheme and does not override server.androidScheme/hostname"
      : "capacitor.config.ts not found",
  },
  {
    label: "info-plist-arm64",
    ok:
      !fs.existsSync(infoPlistPath) ||
      (fileIncludes(infoPlistPath, "<string>arm64</string>") &&
        !fileIncludes(infoPlistPath, "<string>armv7</string>")),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist UIRequiredDeviceCapabilities targets arm64 (no armv7)"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-app-transport-security",
    ok:
      !fs.existsSync(infoPlistPath) ||
      fileIncludes(infoPlistPath, "<key>NSAppTransportSecurity</key>"),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist declares NSAppTransportSecurity (HTTPS-only baseline)"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-empty-display-name",
    ok:
      !fs.existsSync(infoPlistPath) ||
      (plistKeyHasEmptyString(infoPlistPath, "CFBundleDisplayName") &&
        plistKeyHasEmptyString(infoPlistPath, "YinjiePublicAppName")),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist CFBundleDisplayName/YinjiePublicAppName are empty (driven by InfoPlist.strings)"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-export-compliance",
    ok:
      !fs.existsSync(infoPlistPath) ||
      fileMatches(
        infoPlistPath,
        /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/m,
      ),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist declares ITSAppUsesNonExemptEncryption=false (skips App Store export compliance prompt)"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-declared-localizations",
    ok:
      !fs.existsSync(infoPlistPath) ||
      fileIncludesAll(infoPlistPath, [
        "<key>CFBundleLocalizations</key>",
        "<string>zh-Hans</string>",
        "<string>en</string>",
        "<string>ja</string>",
        "<string>ko</string>",
        "<key>CFBundleAllowMixedLocalizations</key>",
      ]),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist declares CFBundleLocalizations for zh-Hans/en/ja/ko and CFBundleAllowMixedLocalizations"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-queries-schemes",
    ok:
      !fs.existsSync(infoPlistPath) ||
      fileIncludesAll(infoPlistPath, [
        "<key>LSApplicationQueriesSchemes</key>",
        "<string>mailto</string>",
        "<string>tel</string>",
        "<string>sms</string>",
        "<string>itms-apps</string>",
      ]),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist declares LSApplicationQueriesSchemes (mailto/tel/sms/itms-apps)"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    // Round 14 让 LaunchScreen.storyboard 走 #070c14 深蓝；Round 27 把
    // WKWebView 自身的 background 也对齐。少了这条，splash 隐藏到 React
    // 首屏渲染之间会闪一帧白底。
    label: "capacitor-config-ios-background",
    ok:
      !fs.existsSync(capacitorConfigPath) ||
      fileMatches(
        capacitorConfigPath,
        /ios\s*:\s*\{[\s\S]*?backgroundColor\s*:\s*["']#070c14["']/m,
      ),
    detail: fs.existsSync(capacitorConfigPath)
      ? "capacitor.config.ts sets ios.backgroundColor=#070c14 (aligns WKWebView底色 with LaunchScreen + splash)"
      : "capacitor.config.ts not found",
  },
  {
    label: "capacitor-config-ipad-mobile",
    ok:
      !fs.existsSync(capacitorConfigPath) ||
      fileMatches(
        capacitorConfigPath,
        /preferredContentMode\s*:\s*["']mobile["']/m,
      ),
    detail: fs.existsSync(capacitorConfigPath)
      ? "capacitor.config.ts forces preferredContentMode=mobile (phone layout on iPad)"
      : "capacitor.config.ts not found",
  },
  {
    label: "asset-app-icon",
    ok:
      !fs.existsSync(iosAppRoot) ||
      fs.existsSync(
        path.join(
          iosAppRoot,
          "Assets.xcassets",
          "AppIcon.appiconset",
          "Contents.json",
        ),
      ),
    detail: fs.existsSync(iosAppRoot)
      ? "Assets.xcassets/AppIcon.appiconset is present"
      : "ios/App/App not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "asset-splash-imageset",
    ok:
      !fs.existsSync(iosAppRoot) ||
      fs.existsSync(
        path.join(
          iosAppRoot,
          "Assets.xcassets",
          "Splash.imageset",
          "Contents.json",
        ),
      ),
    detail: fs.existsSync(iosAppRoot)
      ? "Assets.xcassets/Splash.imageset is present"
      : "ios/App/App not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "launch-storyboard",
    ok:
      !fs.existsSync(iosAppRoot) ||
      fs.existsSync(path.join(iosAppRoot, "Base.lproj", "LaunchScreen.storyboard")),
    detail: fs.existsSync(iosAppRoot)
      ? "Base.lproj/LaunchScreen.storyboard is present"
      : "ios/App/App not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "info-plist-empty-permission-strings",
    ok:
      !fs.existsSync(infoPlistPath) ||
      [
        "NSCameraUsageDescription",
        "NSPhotoLibraryUsageDescription",
        "NSPhotoLibraryAddUsageDescription",
        "NSMicrophoneUsageDescription",
      ].every((key) => plistKeyHasEmptyString(infoPlistPath, key)),
    detail: fs.existsSync(infoPlistPath)
      ? "Info.plist permission usage descriptions are empty (localized via InfoPlist.strings)"
      : "Info.plist not found yet; run `pnpm ios:sync` first",
  },
  {
    label: "web-dist-relative-base",
    ok: (() => {
      if (!fs.existsSync(webDistIndexPath)) {
        // 构建产物缺失只是提示，不算失败 —— 用户可能尚未跑 pnpm ios:sync
        return true;
      }
      const html = fs.readFileSync(webDistIndexPath, "utf8");
      // 在 WKWebView 下加载 file:// 时，资源引用必须是相对路径（./assets/...），不能是绝对路径（/assets/...）
      const hasAbsoluteAsset =
        / src=\"\/(?!\/)/.test(html) || / href=\"\/(?!\/)/.test(html);
      return !hasAbsoluteAsset;
    })(),
    detail: fs.existsSync(webDistIndexPath)
      ? "apps/app/dist-mobile/index.html uses relative asset paths (WKWebView file:// safe)"
      : "apps/app/dist-mobile not built yet; run `pnpm --filter @yinjie/ios-shell prepare:web`",
  },
];

const passed = checks.filter((item) => item.ok).length;

console.log(`iOS doctor: ${passed}/${checks.length} checks passed`);
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "WARN"}  ${item.label}: ${item.detail}`);
}

console.log("");
console.log("Next steps:");
console.log("1. Run this command on macOS.");
console.log("2. Confirm runtime.apiBaseUrl is set in ios-shell.config.json (or override via local.json / env) before `pnpm ios:sync`.");
console.log("3. After sync, run `pnpm ios:configure` to copy Xcode templates, seed any missing plugin files, and patch target membership.");
console.log(`4. Hostname: ${os.hostname()}`);
