import {
  setCloudApiBaseUrlProvider,
  setCoreApiBaseUrlProvider,
} from "@yinjie/contracts";
import { getAdminRuntime } from "../runtime/admin-runtime-store";

const FALLBACK_CLOUD_API_BASE_URL = "http://127.0.0.1:3001";

function trim(value?: string | null) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || undefined;
}

function envCloudApiBaseUrl() {
  return trim(import.meta.env.VITE_CLOUD_API_BASE_URL);
}

function envCoreApiBaseUrl() {
  return trim(import.meta.env.VITE_CORE_API_BASE_URL);
}

export function resolveAdminCoreApiBaseUrl(): string {
  return (
    trim(getAdminRuntime().apiBaseUrl) ??
    envCoreApiBaseUrl() ??
    ""
  );
}

export function resolveAdminCloudApiBaseUrl(): string {
  return (
    trim(getAdminRuntime().cloudApiBaseUrl) ??
    envCloudApiBaseUrl() ??
    FALLBACK_CLOUD_API_BASE_URL
  );
}

export function configureAdminContractsRuntime() {
  setCoreApiBaseUrlProvider(() => resolveAdminCoreApiBaseUrl() || undefined);
  setCloudApiBaseUrlProvider(() => resolveAdminCloudApiBaseUrl() || undefined);
}
