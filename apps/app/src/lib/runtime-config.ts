import {
  DEFAULT_CLOUD_API_BASE_URL,
  resolveCloudApiBaseUrl,
  resolveCoreApiBaseUrl,
  setApiRequestErrorHandler,
  setCloudApiBaseUrlProvider,
  setCloudWorldApiTokenProvider,
  setCoreApiBaseUrlProvider,
} from "@yinjie/contracts";
import { handleApiSubscriptionExpiredError } from "./subscription-expired";
import { resolveAppRuntimeContext } from "../runtime/platform";
import { getAppRuntimeConfig } from "../runtime/runtime-config-store";
import { isCloudSessionExpired, useCloudSessionStore } from "../store/cloud-session-store";

function fallbackBrowserBaseUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin;
  }

  return null;
}

export function resolveAppCoreApiBaseUrl() {
  const runtimeConfig = getAppRuntimeConfig();
  if (runtimeConfig.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }

  const browserBaseUrl = fallbackBrowserBaseUrl();
  if (browserBaseUrl) {
    return browserBaseUrl;
  }

  throw new Error("Remote Core API base URL is not configured for this runtime."); // i18n-ignore-line
}

export function resolveAppSocketBaseUrl() {
  const runtimeConfig = getAppRuntimeConfig();
  if (runtimeConfig.socketBaseUrl) {
    return runtimeConfig.socketBaseUrl;
  }

  if (runtimeConfig.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }

  return resolveAppCoreApiBaseUrl();
}

export function configureContractsRuntime() {
  setCoreApiBaseUrlProvider(() => resolveAppCoreApiBaseUrl());
  setCloudApiBaseUrlProvider(() => {
    const runtimeConfig = getAppRuntimeConfig();
    if (runtimeConfig.cloudApiBaseUrl) {
      return runtimeConfig.cloudApiBaseUrl;
    }
    // 浏览器同源回落：用户从 vicp.fun 等远程域名访问时，localhost:3001 会打到用户设备本机；
    // 此时 vite dev / 反代会把 /cloud/* 转发到真实的 cloud-api。
    const browserBaseUrl = fallbackBrowserBaseUrl();
    if (browserBaseUrl) {
      return browserBaseUrl;
    }
    return DEFAULT_CLOUD_API_BASE_URL;
  });
  // 多租户公网部署：world API 的 base URL 走 cloud-api 的反代入口
  // (路径 /cloud/world-api)。客户端必须把当前 cloud access token 透给反代层，
  // 反代层凭 token 里的 phone 字段把请求路由到该账号自己的 child process。
  // 本地直连（localhost / 私网 IP / 桌面壳）不走反代，不附 token，行为不变。
  setCloudWorldApiTokenProvider((baseUrl) => {
    if (!baseUrl || !baseUrl.includes("/cloud/world-api")) {
      return null;
    }
    const session = useCloudSessionStore.getState();
    if (!session.accessToken || isCloudSessionExpired(session.expiresAt)) {
      return null;
    }
    return session.accessToken;
  });
  setApiRequestErrorHandler((error) => {
    handleApiSubscriptionExpiredError(error);
  });
}

export function resolveConfiguredCoreApiBaseUrl() {
  return resolveCoreApiBaseUrl(undefined, { allowDefault: false });
}

export function hasRemoteServiceConfiguration() {
  const runtimeConfig = getAppRuntimeConfig();
  return Boolean(runtimeConfig.apiBaseUrl || fallbackBrowserBaseUrl());
}

export function resolveAppCloudApiBaseUrl() {
  const runtimeConfig = getAppRuntimeConfig();
  if (runtimeConfig.cloudApiBaseUrl) {
    return runtimeConfig.cloudApiBaseUrl;
  }

  return resolveCloudApiBaseUrl();
}

export function requiresRemoteServiceConfiguration() {
  const runtimeConfig = getAppRuntimeConfig();
  const runtimeContext = resolveAppRuntimeContext(runtimeConfig.appPlatform);
  return (
    runtimeContext.deploymentMode === "remote-connected" &&
    (!runtimeConfig.worldAccessMode || !hasRemoteServiceConfiguration())
  );
}
