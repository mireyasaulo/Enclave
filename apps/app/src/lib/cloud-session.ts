import { getAppRuntimeConfig, setAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useCloudSessionStore } from "../store/cloud-session-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

export function clearCloudRuntimeSession() {
  const runtimeConfig = getAppRuntimeConfig();

  useCloudSessionStore.getState().clearSession();
  useWorldOwnerStore.getState().clearOwner();

  setAppRuntimeConfig({
    apiBaseUrl: undefined,
    socketBaseUrl: undefined,
    cloudApiBaseUrl: runtimeConfig.cloudApiBaseUrl,
    worldAccessMode: undefined,
    cloudPhone: undefined,
    cloudWorldId: undefined,
    bootstrapSource: "user",
    configStatus: "unconfigured",
  });
}
