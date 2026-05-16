import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { updateWorldOwner } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, TextField, cn } from "@yinjie/ui";
import defaultOwnerAvatar from "../assets/default-owner-avatar.svg";
import { AvatarChip } from "../components/avatar-chip";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { navigateBackOrFallback } from "../lib/history-back";
import { pickImageFiles } from "../runtime/native-image-picker";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const MAX_AVATAR_BYTES = 1024 * 1024;

export function ProfileInfoAvatarPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const queryClient = useQueryClient();

  const username = useWorldOwnerStore((state) => state.username);
  const avatar = useWorldOwnerStore((state) => state.avatar);
  const hydrateOwner = useWorldOwnerStore((state) => state.hydrateOwner);
  const updateOwnerStore = useWorldOwnerStore((state) => state.updateOwner);

  // 用户没自定义过头像时 store.avatar 是打包出来的 default-owner-avatar.svg
  // 资源路径（类似 /assets/default-owner-avatar-xxx.svg）。直接当成"当前 URL"
  // 灌进输入框，用户会看到一串完全无意义的本地资源路径，所以把"等于默认"等
  // 同没设置。
  const hasCustomAvatar = useMemo(
    () => Boolean(avatar) && avatar !== defaultOwnerAvatar,
    [avatar],
  );
  const initialDraft = hasCustomAvatar ? avatar : "";
  const [draft, setDraft] = useState(initialDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

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
  const dirty = trimmed !== (hasCustomAvatar ? avatar.trim() : "");
  const canSave = trimmed.length > 0 && dirty;
  const previewSrc = trimmed || (hasCustomAvatar ? avatar : defaultOwnerAvatar);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const owner = await updateWorldOwner({ avatar: trimmed }, baseUrl);
      queryClient.setQueryData(["world-owner", baseUrl], owner);
      hydrateOwner(owner);
      updateOwnerStore({ avatar: owner.avatar });
    },
    onSuccess: () => {
      goBack();
    },
  });

  async function handlePickAvatar() {
    const files = await pickImageFiles({ multiple: false });
    const file = files[0];
    if (!file) {
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError(t(msg`图片过大，请压缩到 1MB 以内再试。`));
      return;
    }
    setLocalError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      setLocalError(t(msg`读取图片失败，请换一张试试。`));
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setDraft(result);
      }
    };
    reader.readAsDataURL(file);
  }

  if (isDesktopLayout) {
    return null;
  }

  const errorMessage =
    localError ??
    (saveMutation.isError && saveMutation.error instanceof Error
      ? saveMutation.error.message
      : null);

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`更换头像`)}
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

      <div className="mt-1 flex flex-col items-center gap-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-6">
        <AvatarChip name={username ?? "avatar"} src={previewSrc} size="xl" />
        <div className="text-[11px] text-[color:var(--text-muted)]">
          {t(msg`点击下方更换`)}
        </div>
      </div>

      <div className="mt-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-3">
        <div className="mb-1.5 text-[11px] font-medium text-[color:var(--text-secondary)]">
          {t(msg`图片地址`)}
        </div>
        <TextField
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setLocalError(null);
          }}
          placeholder={t(msg`粘贴图片 URL 或留空`)}
          className="rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 py-2.5 text-[13px] shadow-none focus:translate-y-0"
        />
      </div>

      <div className="mt-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
        <button
          type="button"
          onClick={() => {
            void handlePickAvatar();
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[color:var(--surface-card-hover)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(7,193,96,0.10)] text-[#15803d]">
            <ImagePlus size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-[color:var(--text-primary)]">
              {t(msg`从相册选择`)}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
              {t(msg`图片大小不超过 1MB`)}
            </div>
          </div>
        </button>
      </div>

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-[10px] border border-[rgba(220,38,38,0.18)] bg-[rgba(254,242,242,0.96)] px-3 py-2 text-[12px] leading-5 text-[color:var(--state-danger-text)]">
          {errorMessage}
        </div>
      ) : null}
    </AppPage>
  );
}
