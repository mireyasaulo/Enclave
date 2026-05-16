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
    // 关掉 WKWebView 默认的 Peek-and-Pop 链接预览。聊天消息 / 朋友圈正文里
    // 经常带 URL，长按打开我们自己的上下文菜单（转发 / 复制 / 删除）；如果
    // 留着 allowsLinkPreview=true（Capacitor 默认值），长按链接本身会被
    // iOS 抢去弹一个 mini-Safari 预览，把我们的菜单直接挡住，用户也会
    // 困惑「这是从哪儿冒出来的浏览器」。
    allowsLinkPreview: false,
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
