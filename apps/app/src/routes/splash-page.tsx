import { useEffect } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { useNavigate } from "@tanstack/react-router";
import { getMyCloudProfile, getWorldOwner } from "@yinjie/contracts";
import { AppPage, AppSection, InlineNotice } from "@yinjie/ui";

const t = translateRuntimeMessage;
import { readPersistedMobileWebRoute } from "../features/shell/mobile-web-route-persistence";
import { clearCloudRuntimeSession } from "../lib/cloud-session";
import { persistInviteCode } from "../lib/invite-code-storage";
import {
  isRemoteWebDeployment,
  requiresRemoteServiceConfiguration,
} from "../lib/runtime-config";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { isMobileWebRuntime, resolveAppRuntimeContext } from "../runtime/platform";
import {
  isCloudSessionExpired,
  useCloudSessionStore,
} from "../store/cloud-session-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

export function SplashPage() {
  const navigate = useNavigate();
  const runtimeConfig = useAppRuntimeConfig();
  const hydrateOwner = useWorldOwnerStore((state) => state.hydrateOwner);
  const setCloudProfile = useCloudSessionStore((state) => state.setProfile);

  useEffect(() => {
    // 通过 https://app/?invite=XXX 进来时，splash 立即 navigate 到 /welcome
    // 会丢掉 query string，需要先把邀请码落到 localStorage，让 welcome 页能继续读到。
    if (typeof window !== "undefined") {
      const queryInvite = new URLSearchParams(window.location.search).get(
        "invite",
      );
      if (queryInvite) {
        persistInviteCode(queryInvite);
      }
    }

    let cancelled = false;

    async function continueBoot() {
      const runtimeContext = resolveAppRuntimeContext(
        runtimeConfig.appPlatform,
      );
      if (
        runtimeContext.hostRole === "host" ||
        requiresRemoteServiceConfiguration()
      ) {
        if (!cancelled) {
          void navigate({ to: "/welcome", replace: true });
        }
        return;
      }

      // 校验 cloud session（纯本地，不发 HTTP），无效直接跳。
      // 远程公网部署（vicp.fun / 公网 IP / 隧道）强制走 cloud 模式：
      // 即使 worldAccessMode 还没被持久化设置，也不允许匿名直通本机 owner。
      const isCloudMode =
        runtimeConfig.worldAccessMode === "cloud" || isRemoteWebDeployment();
      const cloudSession = isCloudMode
        ? useCloudSessionStore.getState()
        : null;
      if (
        isCloudMode &&
        (!runtimeConfig.apiBaseUrl ||
          !cloudSession?.accessToken ||
          isCloudSessionExpired(cloudSession.expiresAt))
      ) {
        clearCloudRuntimeSession();
        if (!cancelled) {
          void navigate({ to: "/welcome", replace: true });
        }
        return;
      }

      if (!runtimeConfig.apiBaseUrl) {
        if (!cancelled) {
          void navigate({ to: "/welcome", replace: true });
        }
        return;
      }

      // 公网隧道下两次串行 RTT (~500ms × 2) 是首屏可见浪费的最后一段。
      // getMyCloudProfile 走 /cloud/me/profile（cloud-api 3001），
      // getWorldOwner 走 /api/world/owner（api 3000），完全不同 upstream，
      // 用 allSettled 真并行 + 整体 8s 超时兜底。
      const profilePromise =
        isCloudMode && cloudSession?.accessToken
          ? getMyCloudProfile(
              cloudSession.accessToken,
              runtimeConfig.cloudApiBaseUrl,
            )
          : Promise.resolve(null);
      const ownerPromise = getWorldOwner(runtimeConfig.apiBaseUrl);
      const timeoutPromise = new Promise<never>((_, reject) =>
        window.setTimeout(
          () => reject(new Error("splash-bootstrap-timeout")),
          8000,
        ),
      );

      const [profileResult, ownerResult] = (await Promise.race([
        Promise.allSettled([profilePromise, ownerPromise]),
        timeoutPromise,
      ]).catch(() => null)) ?? [null, null];

      if (cancelled) {
        return;
      }

      // 整体超时（8s 内两个都没回） → 清 cloud + /welcome
      if (!ownerResult) {
        if (isCloudMode) {
          clearCloudRuntimeSession();
        }
        void navigate({ to: "/welcome", replace: true });
        return;
      }

      // cloud profile 失败：cloud 必须有效，否则降级到 /welcome
      if (
        isCloudMode &&
        profileResult &&
        profileResult.status === "rejected"
      ) {
        clearCloudRuntimeSession();
        void navigate({ to: "/welcome", replace: true });
        return;
      }
      if (profileResult && profileResult.status === "fulfilled" && profileResult.value) {
        setCloudProfile(profileResult.value);
      }

      // owner 失败 → 通常是后端没起或网络抖动，回 /welcome
      if (ownerResult.status === "rejected") {
        if (isCloudMode) {
          clearCloudRuntimeSession();
        }
        void navigate({ to: "/welcome", replace: true });
        return;
      }

      const owner = ownerResult.value;
      hydrateOwner(owner);
      const restoredRoute = isMobileWebRuntime(runtimeConfig.appPlatform)
        ? readPersistedMobileWebRoute()
        : null;
      void navigate({
        to: owner.onboardingCompleted
          ? restoredRoute ?? "/tabs/chat"
          : "/welcome",
        replace: true,
      });
    }

    void continueBoot();

    return () => {
      cancelled = true;
    };
  }, [
    hydrateOwner,
    navigate,
    runtimeConfig.apiBaseUrl,
    runtimeConfig.appPlatform,
    runtimeConfig.cloudApiBaseUrl,
    runtimeConfig.worldAccessMode,
    setCloudProfile,
  ]);

  return (
    <AppPage className="flex min-h-full flex-col items-center justify-center bg-[#f5f5f5] px-4 py-10 text-center">
      <AppSection className="w-full max-w-md border-black/5 bg-white px-8 py-10 shadow-none">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(7,193,96,0.16)] bg-[rgba(7,193,96,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-[#15803d]">
          Beyond Reality
        </div>
        <div className="mx-auto mt-6 flex h-20 w-20 animate-pulse items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#07c160,#34c759)] text-2xl font-semibold text-white shadow-none">
          {t(msg`隐界`)}
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-[0.08em] text-[color:var(--text-primary)]">
          {t(msg`欢迎回到你的世界`)}
        </h1>
        <p className="mt-4 text-sm leading-8 text-[color:var(--text-secondary)]">
          {t(msg`这里不是一串账号信息，而是一整片会继续生长、继续回应你的个人世界。`)}
        </p>

        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-[22px] border border-black/5 bg-[#fafafa] px-4 py-3 shadow-none">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Step 1
            </div>
            <div className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">
              {t(msg`确认入口`)}
            </div>
          </div>
          <div className="rounded-[22px] border border-black/5 bg-[#fafafa] px-4 py-3 shadow-none">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Step 2
            </div>
            <div className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">
              {t(msg`同步世界主人`)}
            </div>
          </div>
          <div className="rounded-[22px] border border-black/5 bg-[#fafafa] px-4 py-3 shadow-none">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Step 3
            </div>
            <div className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">
              {t(msg`继续开启对话`)}
            </div>
          </div>
        </div>

        <InlineNotice className="mt-6 text-left" tone="info">
          {t(msg`正在整理这次进入世界的路径，马上带你回到上次停留的地方。`)}
        </InlineNotice>
      </AppSection>
    </AppPage>
  );
}
