import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { updateWorldOwner } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, TextField, cn } from "@yinjie/ui";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { navigateBackOrFallback } from "../lib/history-back";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const NAME_MAX_LENGTH = 20;
const NAME_MIN_LENGTH = 2;

export function ProfileInfoNamePage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const queryClient = useQueryClient();

  const username = useWorldOwnerStore((state) => state.username);
  const hydrateOwner = useWorldOwnerStore((state) => state.hydrateOwner);

  const [draft, setDraft] = useState(username ?? "");
  // 用户进页面时 store 可能还没 hydrate（cold start / 重置 cloud session），
  // username 之后才被异步灌进来。这时候想让 draft 同步成"刚 hydrate 出来的
  // username"。但如果用户已经在输入框里改过字了，再被外部 store 更新覆盖回
  // 去就是吞输入。用 ref 记一下用户有没有动过输入框，动过就不再 auto-sync。
  const userTouchedRef = useRef(false);

  useEffect(() => {
    if (!userTouchedRef.current) {
      setDraft(username ?? "");
    }
  }, [username]);

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/desktop/settings", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  const goBack = () =>
    navigateBackOrFallback(
      () => navigate({ to: "/profile/info", replace: true }),
      "/profile/info",
    );

  const trimmed = draft.trim();
  const dirty = trimmed !== (username ?? "").trim();
  const canSave = trimmed.length >= NAME_MIN_LENGTH && dirty;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const owner = await updateWorldOwner({ username: trimmed }, baseUrl);
      queryClient.setQueryData(["world-owner", baseUrl], owner);
      hydrateOwner(owner);
    },
    onSuccess: () => {
      goBack();
    },
  });

  if (isDesktopLayout) {
    return null;
  }

  const errorMessage =
    saveMutation.isError && saveMutation.error instanceof Error
      ? saveMutation.error.message
      : null;

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`名字`)}
        titleAlign="center"
        leftActions={
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-primary)] transition-colors active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </button>
        }
        rightActions={
          <button
            type="button"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
              !canSave || saveMutation.isPending
                ? "text-[color:var(--text-dim)]"
                : "text-[#07c160] active:bg-black/[0.05]",
            )}
          >
            {saveMutation.isPending ? t(msg`保存中`) : t(msg`完成`)}
          </button>
        }
      />

      <div className="mt-1 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-3">
        <TextField
          autoFocus
          value={draft}
          onChange={(event) => {
            userTouchedRef.current = true;
            setDraft(event.target.value);
          }}
          maxLength={NAME_MAX_LENGTH}
          placeholder={t(msg`输入名字`)}
          // text-[16px]: iOS Safari focus 时 <16px 会强制 viewport zoom-in。
          // 本输入框 autoFocus，进页就 focus，字号偏小会让整页抖一下。
          className="rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 py-2.5 text-[16px] shadow-none focus:translate-y-0"
        />
        <div className="mt-1.5 text-right text-[11px] text-[color:var(--text-dim)]" data-i18n-skip="true">
          {draft.length}/{NAME_MAX_LENGTH}
        </div>
      </div>

      <div className="px-4 pt-2 text-[11px] leading-5 text-[color:var(--text-muted)]">
        {t(
          msg`好名字让朋友更容易找到你，至少 ${NAME_MIN_LENGTH} 个字、最多 ${NAME_MAX_LENGTH} 个字符。`,
        )}
      </div>

      {/* 名字短于下限时（legacy 1 字用户进入页面也是这种情况），把 disabled
          「完成」的原因显式告诉用户；空串不提示，避免一进页面就跳红字。 */}
      {trimmed.length > 0 && trimmed.length < NAME_MIN_LENGTH ? (
        <div className="mx-4 mt-3 rounded-[10px] border border-[rgba(245,158,11,0.20)] bg-[rgba(255,251,235,0.96)] px-3 py-2 text-[12px] leading-5 text-[#92400e]">
          {t(msg`名字太短啦，至少要 ${NAME_MIN_LENGTH} 个字符。`)}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-[10px] border border-[rgba(220,38,38,0.18)] bg-[rgba(254,242,242,0.96)] px-3 py-2 text-[12px] leading-5 text-[color:var(--state-danger-text)]">
          {errorMessage}
        </div>
      ) : null}
    </AppPage>
  );
}
