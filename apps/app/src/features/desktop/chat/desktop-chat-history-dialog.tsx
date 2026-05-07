import { useEffect } from "react";
import { msg } from "@lingui/macro";
import { ChevronLeft, X } from "lucide-react";
import { type ConversationListItem } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import { DesktopChatHistoryPanel } from "./desktop-chat-history-panel";

type DesktopChatHistoryDialogProps = {
  open: boolean;
  conversation: ConversationListItem;
  focusRequestKey: number;
  canReturnToDetails: boolean;
  onClose: () => void;
  onBackToDetails?: () => void;
  onOpenMessage: (messageId: string) => void;
  className?: string;
};

export function DesktopChatHistoryDialog({
  open,
  conversation,
  focusRequestKey,
  canReturnToDetails,
  onClose,
  onBackToDetails,
  onOpenMessage,
  className,
}: DesktopChatHistoryDialogProps) {
  const t = translateRuntimeMessage;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.28)] p-4 backdrop-blur-[3px] sm:p-6",
        className,
      )}
    >
      <button
        type="button"
        aria-label={t(msg`关闭查找聊天记录弹层`)}
        onClick={onClose}
        className="absolute inset-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(msg`查找聊天记录`)}
        className="relative flex h-[min(720px,86vh)] w-full max-w-[960px] flex-col overflow-hidden rounded-[20px] border border-[color:var(--border-faint)] bg-white shadow-[var(--shadow-overlay)]"
      >
        <div className="grid grid-cols-[36px,1fr,36px] items-center gap-3 border-b border-[rgba(0,0,0,0.06)] bg-white px-5 py-3">
          {canReturnToDetails && onBackToDetails ? (
            <button
              type="button"
              onClick={onBackToDetails}
              aria-label={t(msg`返回聊天信息`)}
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[color:var(--text-secondary)] transition hover:bg-[rgba(0,0,0,0.045)] hover:text-[color:var(--text-primary)]"
            >
              <ChevronLeft size={16} />
            </button>
          ) : (
            <div aria-hidden="true" className="h-8 w-8" />
          )}

          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="truncate text-[15px] font-medium text-[color:var(--text-primary)]">
              {t(msg`查找聊天记录`)}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-[color:var(--text-muted)]">
              {conversation.title}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t(msg`关闭`)}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[color:var(--text-secondary)] transition hover:bg-[rgba(0,0,0,0.045)] hover:text-[color:var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-[#f7f7f7]">
          <DesktopChatHistoryPanel
            conversation={conversation}
            focusRequestKey={focusRequestKey}
            variant="dialog"
            onClose={onClose}
            onBackToDetails={onBackToDetails}
            onOpenMessage={onOpenMessage}
          />
        </div>
      </div>
    </div>
  );
}
