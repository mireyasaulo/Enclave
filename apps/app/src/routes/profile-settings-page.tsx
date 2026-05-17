import { Suspense, lazy } from "react";
import { msg } from "@lingui/macro";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Languages, ShieldCheck } from "lucide-react";
import {
  SUPPORTED_LOCALE_LABELS,
  useAppLocale,
  useRuntimeTranslator,
} from "@yinjie/i18n";
import { AppPage, Button } from "@yinjie/ui";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { shouldShowCloudAccountControls } from "../lib/cloud-session";
import { navigateBackOrFallback } from "../lib/history-back";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useCloudSessionStore } from "../store/cloud-session-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

// 桌面 tabs（个人资料 / AI 设置 / 快捷键 / 语言 / 协议 / 会员中心 / 账号安全）
// 走查 R1（2026-05-17 新一轮）：原本 ProfileSettingsPage 把桌面所有 tab 内容
// 都静态 import 进来（DesktopUtilityShell / DesktopChatConfirmDialog /
// LanguageSwitcher / SubscriptionPanel / AccountSecurityPanel /
// CheckoutContactDialog + workspace-contracts 的 cloud-subscription / invite /
// world-owner mutation 一堆），构出 27KB 主 chunk + 4 个 ~13KB 桌面专属辅助
// chunk。移动端只用 entry list（多语言 + 账号安全 2 个按钮）却为这 12KB+
// 桌面代码付了下载 + parse + 内存。
// 拆出 ProfileSettingsDesktop 走 React.lazy：桌面用户多花一次 chunk request，
// 移动端 /profile/settings 只装载本文件。
const ProfileSettingsDesktop = lazy(() =>
  import("./profile-settings-desktop").then((mod) => ({
    default: mod.ProfileSettingsDesktop,
  })),
);

export function ProfileSettingsPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const ownerId = useWorldOwnerStore((state) => state.id);
  const cloudAccessToken = useCloudSessionStore((state) => state.accessToken);
  const cloudPhone = useCloudSessionStore((state) => state.phone);
  const { requestedLocale } = useAppLocale();

  if (isDesktopLayout) {
    // Suspense fallback 给空——桌面 utility shell 切到 settings 的瞬间空一两帧
    // 比放骨架屏更接近"已经在 settings 内部"的预期；DesktopUtilityShell
    // 自身有边框 + sidebar 框架（lazy chunk 还在下载时已经看不到 fallback）。
    return (
      <Suspense fallback={null}>
        <ProfileSettingsDesktop />
      </Suspense>
    );
  }

  const showCloudAccountEntries = shouldShowCloudAccountControls({
    worldAccessMode: runtimeConfig.worldAccessMode,
    runtimeApiBaseUrl: runtimeConfig.apiBaseUrl,
    runtimeCloudPhone: runtimeConfig.cloudPhone,
    accessToken: cloudAccessToken,
    sessionPhone: cloudPhone,
    worldOwnerId: ownerId,
  });

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`设置`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            onClick={() =>
              // 与其他 /profile/* 子页保持同款返回逻辑（navigateBackOrFallback）：
              // history.back() 优先以保留 /tabs/profile 滚动位置；否则降级到 navigate。
              // 之前直接 navigate({to:"/tabs/profile"}) 会向 history 推一格，从 settings
              // 退回 profile 后再按浏览器/Android Back 又会回到 settings。
              navigateBackOrFallback(
                () => void navigate({ to: "/tabs/profile", replace: true }),
                "/tabs/profile",
              )
            }
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-primary)] shadow-none active:bg-black/[0.05]"
            aria-label={t(msg`返回资料页`)}
          >
            <ArrowLeft size={17} />
          </Button>
        }
      />
      <div className="mt-1 overflow-hidden border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
        <button
          type="button"
          onClick={() => void navigate({ to: "/profile/settings/language" })}
          className="flex w-full items-center gap-2.5 px-4 py-2.75 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] active:bg-black/[0.04]"
        >
          <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[9px] bg-[rgba(56,189,248,0.12)] text-[#0891b2]">
            <Languages size={15} />
          </div>
          <div className="min-w-0 flex-1 text-[14px] text-[color:var(--text-primary)]">
            {t(msg`多语言`)}
          </div>
          <div
            data-i18n-skip="true"
            className="text-[12px] text-[color:var(--text-muted)]"
          >
            {SUPPORTED_LOCALE_LABELS[requestedLocale]}
          </div>
          <ChevronRight
            size={13}
            className="shrink-0 text-[color:var(--text-dim)]"
          />
        </button>
        {showCloudAccountEntries ? (
          <button
            type="button"
            onClick={() =>
              void navigate({ to: "/profile/settings/account-security" })
            }
            className="flex w-full items-center gap-2.5 border-t border-[color:var(--border-faint)] px-4 py-2.75 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] active:bg-black/[0.04]"
          >
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[9px] bg-[rgba(64,169,255,0.12)] text-[#1677ff]">
              <ShieldCheck size={15} />
            </div>
            <div className="min-w-0 flex-1 text-[14px] text-[color:var(--text-primary)]">
              {t(msg`账号安全`)}
            </div>
            <ChevronRight
              size={13}
              className="shrink-0 text-[color:var(--text-dim)]"
            />
          </button>
        ) : null}
      </div>
    </AppPage>
  );
}
