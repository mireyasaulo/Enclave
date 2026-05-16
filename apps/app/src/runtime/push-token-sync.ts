import { resolveAppCoreApiBaseUrl } from "../lib/runtime-config";
import { useWorldOwnerStore } from "../store/world-owner-store";
import {
  getNativeNotificationPermissionState,
  isNativeMobileBridgeAvailable,
  onNativePushTokenChanged,
  readNativePushToken,
} from "./mobile-bridge";
import { isIosPlatform } from "./adapters/ios";
import { getAppRuntimeConfig } from "./runtime-config-store";

const SYNC_CACHE_KEY = "yinjie-push-token-sync-cache.v1";

type CachedSyncRecord = {
  ownerId: string;
  tokenHash: string;
  syncedAt: string;
};

function readCache(): CachedSyncRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SYNC_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedSyncRecord) : null;
  } catch {
    return null;
  }
}

function writeCache(record: CachedSyncRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify(record));
  } catch {
    // 静默：localStorage 配额满或 Safari private mode
  }
}

function clearCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SYNC_CACHE_KEY);
  } catch {
    // 同上
  }
}

function hashToken(token: string) {
  let h = 0;
  for (let i = 0; i < token.length; i += 1) {
    h = (h * 31 + token.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export type SyncIosPushTokenResult =
  | { ok: true; updated: boolean; reason?: never }
  | {
      ok: false;
      reason:
        | "not-ios"
        | "no-permission"
        | "no-token"
        | "no-owner"
        | "skipped-cache"
        | "request-failed"
        | "network-error";
    };

/**
 * 把 iOS 设备的 APNs device token 上报给后端 (POST /api/push/tokens)。
 * 调用时机：
 *   - bootstrapIos 兜底跑一次（只有用户已授权时才会真正上报）
 *   - 用户授权通知后立刻调一次（chat-details-page 等）
 *   - 登录成功后调一次（让换号也能立刻 attach）
 *   - APNs 重发新 token 时（onNativePushTokenChanged 监听后 force=true 重报）
 *
 * 缓存机制：localStorage 记 (ownerId + tokenHash)；相同则跳过避免每次启动都打接口。
 */
export async function syncIosPushToken(options?: {
  force?: boolean;
}): Promise<SyncIosPushTokenResult> {
  if (!isIosPlatform() || !isNativeMobileBridgeAvailable()) {
    return { ok: false, reason: "not-ios" };
  }

  const permission = await getNativeNotificationPermissionState();
  if (permission !== "granted") {
    return { ok: false, reason: "no-permission" };
  }

  const token = await readNativePushToken();
  if (!token) {
    return { ok: false, reason: "no-token" };
  }

  const ownerId = useWorldOwnerStore.getState().id;
  if (!ownerId) {
    return { ok: false, reason: "no-owner" };
  }

  const tokenHash = hashToken(token);
  const cache = readCache();
  if (
    !options?.force &&
    cache &&
    cache.ownerId === ownerId &&
    cache.tokenHash === tokenHash
  ) {
    return { ok: false, reason: "skipped-cache" };
  }

  const runtimeConfig = getAppRuntimeConfig();
  const bundleId =
    runtimeConfig.applicationId?.trim() || "com.yinjie.ios";
  const appVersion = runtimeConfig.appVersionName?.trim() || null;
  const environment =
    runtimeConfig.environment === "development" ? "development" : "production";
  const locale =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language
      : null;

  let baseUrl: string;
  try {
    baseUrl = resolveAppCoreApiBaseUrl();
  } catch {
    return { ok: false, reason: "network-error" };
  }

  try {
    const response = await fetch(`${baseUrl}/api/push/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "ios",
        token,
        bundleId,
        environment,
        appVersion,
        locale,
      }),
    });
    if (!response.ok) {
      console.warn(
        "[push-token-sync] register failed",
        response.status,
        await response.text().catch(() => ""),
      );
      return { ok: false, reason: "request-failed" };
    }
    let updated = false;
    try {
      const data = (await response.json()) as { updated?: boolean };
      updated = Boolean(data.updated);
    } catch {
      // 静默：忽略 body 解析失败
    }
    writeCache({
      ownerId,
      tokenHash,
      syncedAt: new Date().toISOString(),
    });
    return { ok: true, updated };
  } catch (error) {
    console.warn("[push-token-sync] network error", error);
    return { ok: false, reason: "network-error" };
  }
}

let listenerHandlePromise: Promise<unknown> | null = null;
let ownerSubscriptionStarted = false;

/**
 * 注册 native 端 pushTokenChanged 事件监听 —— 当 APNs 重发新 device token
 * 时（比如 reinstall、iOS 大版本升级），自动 force-resync 到后端。
 */
export function startIosPushTokenSyncListener() {
  if (!isIosPlatform() || !isNativeMobileBridgeAvailable()) {
    return;
  }
  if (listenerHandlePromise) {
    return;
  }

  listenerHandlePromise = onNativePushTokenChanged((event) => {
    if (event.error) {
      console.warn("[push-token-sync] APNs registration error:", event.error);
      return;
    }
    if (event.token) {
      void syncIosPushToken({ force: true });
    }
  });
}

/**
 * 监听 owner 状态变化：从 null 变成有值（登录）或换号时触发 sync。
 * 登出时清缓存。
 */
export function startIosOwnerChangeListener() {
  if (!isIosPlatform() || !isNativeMobileBridgeAvailable()) {
    return;
  }
  if (ownerSubscriptionStarted) {
    return;
  }
  ownerSubscriptionStarted = true;

  let lastOwnerId = useWorldOwnerStore.getState().id;
  useWorldOwnerStore.subscribe((state) => {
    const next = state.id;
    if (next === lastOwnerId) {
      return;
    }
    if (!next) {
      // 登出：清缓存，让下次登录立刻重报
      clearCache();
    } else {
      // 换号或首次登录：force resync
      void syncIosPushToken({ force: true });
    }
    lastOwnerId = next;
  });
}

/**
 * 用户登出 / 切号时清缓存，下次 sync 必然会重报。
 */
export function clearIosPushTokenSyncCache() {
  clearCache();
}
