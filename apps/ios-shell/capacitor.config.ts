import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ShellConfig = {
  appId: string;
  appName: string;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const shellConfig = JSON.parse(
  readFileSync(path.join(here, "ios-shell.config.json"), "utf8"),
) as ShellConfig;

const config: CapacitorConfig = {
  appId: shellConfig.appId,
  appName: shellConfig.appName,
  webDir: "../app/dist-mobile",
  ios: {
    scheme: "capacitor",
    contentInset: "always",
    preferredContentMode: "mobile",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1000,
      backgroundColor: "#070c14",
      splashFullScreen: true,
      splashImmersive: true,
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#070c14",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
