import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { isApiRequestError, updateWorldOwner } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, TextAreaField, cn } from "@yinjie/ui";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { translateAppErrorCode } from "../lib/error-translate";
import { navigateBackOrFallback } from "../lib/history-back";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const SIGNATURE_MAX_LENGTH = 30;

export function ProfileInfoSignaturePage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const queryClient = useQueryClient();

  const signature = useWorldOwnerStore((state) => state.signature);
  const hydrateOwner = useWorldOwnerStore((state) => state.hydrateOwner);

  const [draft, setDraft] = useState(signature);
  // 见 profile-info-name-page 同名 ref：用户已经动过输入框时，不要被
  // 后台 hydrate 把 draft 覆盖回 store 值。
  const userTouchedRef = useRef(false);
  // 保存中用户手动 ← 退出页面后，几秒后 onSuccess 还会再调 goBack 一次，
  // 多跳一格——见 profile-info-name-page / -avatar-page 同款 ref。
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userTouchedRef.current) {
      setDraft(signature);
    }
  }, [signature]);

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
  const dirty = trimmed !== signature.trim();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const owner = await updateWorldOwner({ signature: trimmed }, baseUrl);
      queryClient.setQueryData(["world-owner", baseUrl], owner);
      hydrateOwner(owner);
    },
    onSuccess: () => {
      if (!isMountedRef.current) return;
      goBack();
    },
  });

  if (isDesktopLayout) {
    return null;
  }

  // 优先 translateAppErrorCode（命中 KnownAppErrorCode 出当前 locale 文案），
  // miss 才退到 raw error.message。详见 profile-info-name-page 同款注释。
  const errorMessage = (() => {
    if (!saveMutation.isError) return null;
    const err = saveMutation.error;
    if (isApiRequestError(err)) {
      return translateAppErrorCode(err) ?? err.message;
    }
    return err instanceof Error ? err.message : null;
  })();

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`个性签名`)}
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
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
              !dirty || saveMutation.isPending
                ? "text-[color:var(--text-dim)]"
                : "text-[#07c160] active:bg-black/[0.05]",
            )}
          >
            {saveMutation.isPending ? t(msg`保存中`) : t(msg`完成`)}
          </button>
        }
      />

      <div className="mt-1 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-3">
        <TextAreaField
          autoFocus
          value={draft}
          disabled={saveMutation.isPending}
          onChange={(event) => {
            userTouchedRef.current = true;
            setDraft(event.target.value);
            // 用户已经动手敲新的签名，意味着上一次保存失败翻篇了，把红字
            // banner 清掉，免得新尝试还挂着旧 attempt 的失败说明。
            saveMutation.reset();
          }}
          maxLength={SIGNATURE_MAX_LENGTH}
          placeholder={t(msg`写一句此刻想说的话`)}
          // text-[16px]: iOS Safari focus 时 <16px 会强制 viewport zoom-in。
          // 本 textarea autoFocus，进页就 focus，字号偏小会让整页抖一下。
          // disabled={isPending}: 上传中继续敲会被 onSuccess→goBack 一起带走，
          //   见 profile-info-avatar-page 同款修法（commit 5fe4e7e3）。
          className="min-h-[5.5rem] resize-none rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 py-2.5 text-[16px] leading-6 shadow-none focus:translate-y-0 disabled:bg-[color:var(--bg-canvas)] disabled:text-[color:var(--text-muted)]"
        />
        <div
          className="mt-1.5 text-right text-[11px] text-[color:var(--text-dim)]"
          data-i18n-skip="true"
        >
          {draft.length}/{SIGNATURE_MAX_LENGTH}
        </div>
      </div>

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-[10px] border border-[rgba(220,38,38,0.18)] bg-[rgba(254,242,242,0.96)] px-3 py-2 text-[12px] leading-5 text-[color:var(--state-danger-text)]">
          {errorMessage}
        </div>
      ) : null}
    </AppPage>
  );
}
