import type { AppRuntimeConfig } from "../runtime/runtime-config";
import { queryClient } from "./query-client";
import { clearUserScopedClientState } from "./user-scoped-state";

export function shouldShowCloudAccountControls(input: {
  worldAccessMode?: AppRuntimeConfig["worldAccessMode"];
  runtimeApiBaseUrl?: string | null;
  runtimeCloudPhone?: string | null;
  accessToken?: string | null;
  sessionPhone?: string | null;
  worldOwnerId?: string | null;
}) {
  return (
    input.worldAccessMode === "cloud" ||
    Boolean(
      input.accessToken?.trim() ||
      input.worldOwnerId?.trim() ||
      input.runtimeApiBaseUrl?.trim() ||
      input.sessionPhone?.trim() ||
      input.runtimeCloudPhone?.trim(),
    )
  );
}

// 退出当前云身份 / 切号前调一次。把所有跟登录人绑定的客户端状态彻底清掉：
// 见 clearUserScopedClientState 的注释。同步签名是为了兼容旧调用点（splash
// 在 fail 分支里直接调用后立刻 navigate），native secure storage 的 remove
// 是 fire-and-forget——清不干净的下次 bootstrap 仍会被身份哨兵纠正。
export function clearCloudRuntimeSession() {
  void clearUserScopedClientState({ queryClient });
}
