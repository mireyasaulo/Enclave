import { init as initAnalytics, isInitialized } from "@yinjie/analytics";
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
  });
}
