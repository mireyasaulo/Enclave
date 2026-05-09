import { init as initAnalytics, isInitialized } from "@yinjie/analytics";
import { getAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useCloudSessionStore } from "../store/cloud-session-store";
import { resolveAppCloudApiBaseUrl } from "./runtime-config";

export function bootstrapAnalytics(): void {
  if (isInitialized()) return;

  initAnalytics({
    appId: "app",
    // Resolved on every flush so that telemetry follows the cloud-api base URL
    // even after the user enters a different world (or the runtime config is
    // populated later by Capacitor / Tauri bootstrap).
    endpointProvider: () => {
      try {
        const baseRaw = resolveAppCloudApiBaseUrl();
        if (!baseRaw) return null;
        return `${baseRaw.replace(/\/+$/, "")}/telemetry/events/batch`;
      } catch {
        return null;
      }
    },
    userIdProvider: () =>
      useCloudSessionStore.getState().profile?.id ?? null,
    // 用户进入云世界后 runtime-config 会被 setAppRuntimeConfig 写入 cloudWorldId，
    // 此后每条事件都带上 worldId，cloud-console 就能按世界切片看埋点。
    worldIdProvider: () => {
      try {
        return getAppRuntimeConfig().cloudWorldId ?? null;
      } catch {
        return null;
      }
    },
  });
}
