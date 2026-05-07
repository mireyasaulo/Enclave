import { init as initAnalytics, isInitialized } from "@yinjie/analytics";
import { useCloudSessionStore } from "../store/cloud-session-store";
import { resolveAppCloudApiBaseUrl } from "./runtime-config";

export function bootstrapAnalytics(): void {
  if (isInitialized()) return;
  let endpoint: string;
  try {
    const baseRaw = resolveAppCloudApiBaseUrl();
    if (!baseRaw) return;
    endpoint = `${baseRaw.replace(/\/+$/, "")}/telemetry/events/batch`;
  } catch {
    return;
  }

  initAnalytics({
    appId: "app",
    endpoint,
    userIdProvider: () =>
      useCloudSessionStore.getState().profile?.id ?? null,
  });
}
