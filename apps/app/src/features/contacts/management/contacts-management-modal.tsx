import { useEffect, useMemo, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";
import { getFriends, listCharacters } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import { registerAndroidBackInterceptor } from "../../../runtime/android-back-button";
import { useAppRuntimeConfig } from "../../../runtime/runtime-config-store";
import { useDesktopLayout } from "../../shell/use-desktop-layout";
import { useManagementScreenStack } from "./contacts-management-state";
import { ManagementRootScreen } from "./management-root-screen";
import { ManagementBlacklistScreen } from "./management-blacklist-screen";
import { ManagementPermissionsScreen } from "./management-permissions-screen";
import { ManagementPermissionsDetailScreen } from "./management-permissions-detail-screen";

export type ContactsManagementModalProps = {
  open: boolean;
  onClose: () => void;
  onEnterBulkMode: () => void;
  onOpenTags: () => void;
};

export function ContactsManagementModal({
  open,
  onClose,
  onEnterBulkMode,
  onOpenTags,
}: ContactsManagementModalProps) {
  const t = useRuntimeTranslator();
  const isDesktop = useDesktopLayout();
  const { current, canGoBack, push, pop } = useManagementScreenStack(open);

  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  // 仅在打开 permissions-detail 时才查（弹窗未打开时 useQuery 不订阅）。
  const detailCharacterId =
    current.type === "permissions-detail" ? current.characterId : null;
  const friendsQuery = useQuery({
    queryKey: ["app-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
    enabled: Boolean(open && detailCharacterId),
  });
  const charactersQuery = useQuery({
    queryKey: ["app-characters", baseUrl],
    queryFn: () => listCharacters(baseUrl),
    enabled: Boolean(open && detailCharacterId),
  });
  const detailFriendName = useMemo(() => {
    if (!detailCharacterId) return null;
    const friend = (friendsQuery.data ?? []).find(
      (f) => f.character.id === detailCharacterId,
    );
    const remark = friend?.friendship?.remarkName?.trim();
    if (remark) return remark;
    if (friend?.character?.name) return friend.character.name;
    const char = (charactersQuery.data ?? []).find(
      (c) => c.id === detailCharacterId,
    );
    return char?.name ?? null;
  }, [detailCharacterId, friendsQuery.data, charactersQuery.data]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (canGoBack) {
          pop();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, canGoBack, pop, onClose]);

  // 原生壳硬件 Back：modal 打开时先消费 Back —— 能 pop 内屏就 pop，到根屏再
  // 把 Back 当成关 modal，避免被默认的 history.back 直接弹出 /tabs/contacts。
  useEffect(() => {
    if (!open) {
      return;
    }
    const unregister = registerAndroidBackInterceptor((event) => {
      event.preventDefault();
      if (canGoBack) {
        pop();
      } else {
        onClose();
      }
      return true;
    });
    return unregister;
  }, [open, canGoBack, pop, onClose]);

  if (!open) return null;

  const titleText = (() => {
    switch (current.type) {
      case "blacklist":
        return t(msg`黑名单`);
      case "permissions":
        return t(msg`朋友权限`);
      case "permissions-detail":
        // 列表与详情都叫 “朋友权限” 时用户来回切看不出在改谁；详情页头部回退到好友显示名。
        return detailFriendName ?? t(msg`朋友权限`);
      case "root":
      default:
        return t(msg`通讯录管理`);
    }
  })();

  const body = (() => {
    switch (current.type) {
      case "blacklist":
        return <ManagementBlacklistScreen />;
      case "permissions":
        return (
          <ManagementPermissionsScreen
            onPickFriend={(characterId) =>
              push({ type: "permissions-detail", characterId })
            }
          />
        );
      case "permissions-detail":
        return (
          <ManagementPermissionsDetailScreen characterId={current.characterId} />
        );
      case "root":
      default:
        return (
          <ManagementRootScreen
            onOpenBlacklist={() => push({ type: "blacklist" })}
            onOpenPermissions={() => push({ type: "permissions" })}
            onOpenTags={onOpenTags}
            onEnterBulkMode={onEnterBulkMode}
          />
        );
    }
  })();

  const header = (
    <ModalHeader
      title={titleText}
      canGoBack={canGoBack}
      onBack={pop}
      onClose={onClose}
      backLabel={t(msg`返回`)}
      closeLabel={t(msg`关闭`)}
    />
  );

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(17,24,39,0.32)] p-6 backdrop-blur-[3px]">
        <button
          type="button"
          aria-label={t(msg`关闭`)}
          onClick={onClose}
          className="absolute inset-0"
        />
        <div className="relative flex max-h-[80vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[16px] border border-[color:var(--border-faint)] bg-white shadow-[var(--shadow-overlay)]">
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7]">
            {body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30">
      <button
        type="button"
        aria-label={t(msg`关闭`)}
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[18px] bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-12px_28px_rgba(15,23,42,0.18)]">
        <div className="flex justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-black/10" />
        </div>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7]">
          {body}
        </div>
      </div>
    </div>
  );
}

function ModalHeader({
  title,
  canGoBack,
  onBack,
  onClose,
  backLabel,
  closeLabel,
}: {
  title: ReactNode;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  backLabel: string;
  closeLabel: string;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[color:var(--border-faint)] bg-white px-3">
      <div className="flex w-9 justify-start">
        {canGoBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)]",
              "hover:bg-black/4 active:bg-black/8",
            )}
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}
      </div>
      <div className="text-[15px] font-medium text-[color:var(--text-primary)]">
        {title}
      </div>
      <div className="flex w-9 justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)] hover:bg-black/4 active:bg-black/8"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
