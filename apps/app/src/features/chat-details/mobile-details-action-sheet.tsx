import { useEffect, useId, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { registerAndroidBackInterceptor } from "../../runtime/android-back-button";

type MobileDetailsActionSheetAction = {
  key: string;
  label: ReactNode;
  description?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type MobileDetailsActionSheetProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  actions: MobileDetailsActionSheetAction[];
  cancelLabel?: ReactNode;
  onClose: () => void;
};

export function MobileDetailsActionSheet({
  open,
  title,
  description,
  actions,
  cancelLabel,
  onClose,
}: MobileDetailsActionSheetProps) {
  const t = translateRuntimeMessage;
  const titleId = useId();
  const descriptionId = useId();

  // 原生壳硬件 Back 键：sheet 打开时先关 sheet，不让 BACK 同时 history.back
  // 把用户从 chat-details / group-chat-details / group-member-picker 带回上
  // 一级。和 mobile-message-action-sheet.tsx 对齐。
  useEffect(() => {
    if (!open) {
      return;
    }
    const unregister = registerAndroidBackInterceptor((event) => {
      event.preventDefault();
      onClose();
      return true;
    });
    return unregister;
  }, [open, onClose]);

  // 走查 Round 1：sheet 打开时按 Esc 没反应——桌面 web / 模拟器 / 自动化都拍不
  // 掉。这里加一个 keydown 监听，open 才挂，避免每次渲染都注册。
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.14)]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t(msg`关闭操作菜单`)}
        onClick={onClose}
      />
      {/* 走查 R(re)1：sheet 没有 role="dialog" / aria-modal / aria-labelledby，
          屏幕阅读器（iOS VoiceOver / Android TalkBack）不会把它当 modal 念，
          盲人用户从 character-detail 进来后听不到「音视频通话/加入黑名单/删除联系人」
          这些 sheet 标题，只听到"按钮 取消"。和 desktop-chat-history-dialog 对齐补全。 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[18px] border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-1.5 shadow-[0_-14px_28px_rgba(15,23,42,0.10)]"
      >
        <div className="flex justify-center pb-1">
          <div className="h-1 w-9 rounded-full bg-[rgba(148,163,184,0.45)]" />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-[color:var(--border-subtle)] bg-white">
          <div className="border-b border-[color:var(--border-subtle)] px-5 py-2.5 text-center">
            <div
              id={titleId}
              className="text-[14px] font-medium text-[#111827]"
            >
              {title}
            </div>
            {description ? (
              <div
                id={descriptionId}
                className="mt-0.5 text-[11px] leading-[18px] text-[#8c8c8c]"
              >
                {description}
              </div>
            ) : null}
          </div>

          {actions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`flex min-h-[48px] w-full flex-col items-center justify-center px-5 py-2 text-center transition active:bg-[color:var(--surface-card-hover)] ${
                index > 0 ? "border-t border-[color:var(--border-subtle)]" : ""
              } ${action.danger ? "text-[#d74b45]" : "text-[#111827]"} ${
                action.disabled ? "opacity-45" : ""
              }`}
            >
              <span className="text-[15px] leading-6">{action.label}</span>
              {action.description ? (
                <span
                  className={`mt-0.5 text-[11px] leading-[18px] ${
                    action.danger ? "text-[#e28a84]" : "text-[#8c8c8c]"
                  }`}
                >
                  {action.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-10 w-full items-center justify-center rounded-[14px] border border-[color:var(--border-subtle)] bg-white text-[15px] font-medium text-[#111827] transition active:bg-[color:var(--surface-card-hover)]"
        >
          {cancelLabel ?? t(msg`取消`)}
        </button>
      </div>
    </div>
  );
}
