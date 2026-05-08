import { msg } from "@lingui/macro";
import { useRuntimeTranslator } from "@yinjie/i18n";

type MobileMessageActionSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  preview?: {
    senderName?: string;
    text: string;
    own?: boolean;
  };
  onReply?: () => void;
  onQuoteSelection?: () => void;
  quoteSelectionLabel?: string;
  onForward?: () => void;
  onMultiSelect?: () => void;
  onSelectToHere?: () => void;
  selectToHereLabel?: string;
  onSetReminder?: () => void;
  reminderLabel?: string;
  onToggleFavorite?: () => void;
  favoriteLabel?: string;
  onCopy: () => void;
  onCopySender?: () => void;
  onOpenAttachment?: () => void;
  openAttachmentLabel?: string;
  onSaveAttachment?: () => void;
  saveAttachmentLabel?: string;
  onRecall?: () => void;
  recallLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
};

export function MobileMessageActionSheet({
  open,
  onClose,
  title,
  preview,
  onReply,
  onQuoteSelection,
  quoteSelectionLabel,
  onForward,
  onMultiSelect,
  onSelectToHere,
  selectToHereLabel,
  onSetReminder,
  reminderLabel,
  onToggleFavorite,
  favoriteLabel,
  onCopy,
  onCopySender,
  onOpenAttachment,
  openAttachmentLabel,
  onSaveAttachment,
  saveAttachmentLabel,
  onRecall,
  recallLabel,
  onDelete,
  deleteLabel,
}: MobileMessageActionSheetProps) {
  const t = useRuntimeTranslator();
  if (!open) {
    return null;
  }

  const resolvedTitle = title ?? t(msg`消息操作`);
  const resolvedQuoteSelectionLabel = quoteSelectionLabel ?? t(msg`部分引用`);
  const resolvedSelectToHereLabel = selectToHereLabel ?? t(msg`选择到这里`);
  const resolvedReminderLabel = reminderLabel ?? t(msg`提醒`);
  const resolvedFavoriteLabel = favoriteLabel ?? t(msg`收藏`);
  const resolvedOpenAttachmentLabel = openAttachmentLabel ?? t(msg`打开附件`);
  const resolvedSaveAttachmentLabel = saveAttachmentLabel ?? t(msg`保存附件`);
  const resolvedRecallLabel = recallLabel ?? t(msg`撤回`);
  const resolvedDeleteLabel = deleteLabel ?? t(msg`删除`);

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.14)]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t(msg`关闭消息操作菜单`)}
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[20px] border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 shadow-[0_-14px_28px_rgba(15,23,42,0.10)]">
        <div className="flex justify-center pb-1.5">
          <div className="h-1 w-10 rounded-full bg-[rgba(148,163,184,0.45)]" />
        </div>
        <div className="pb-2.5 text-center text-[12px] text-[#8c8c8c]">{resolvedTitle}</div>
        {preview ? (
          <div className="mb-2.5 overflow-hidden rounded-[14px] border border-[color:var(--border-subtle)] bg-white px-3 py-2.5">
            {preview.senderName ? (
              <div className="pb-1 text-[10px] text-[#8c8c8c]">
                {preview.senderName}
              </div>
            ) : null}
            <div
              className={`flex ${preview.own ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-[15px] px-3 py-2 text-[13px] leading-5 ${
                  preview.own
                    ? "bg-[rgba(7,193,96,0.16)] text-[#111827]"
                    : "border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] text-[#111827]"
                }`}
              >
                <div className="line-clamp-3 whitespace-pre-wrap break-words">
                  {preview.text}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[14px] border border-[color:var(--border-subtle)] bg-white">
          {onReply ? <ActionButton label={t(msg`回复`)} onClick={onReply} /> : null}
          {onQuoteSelection ? (
            <ActionButton
              label={resolvedQuoteSelectionLabel}
              onClick={onQuoteSelection}
            />
          ) : null}
          {onForward ? <ActionButton label={t(msg`转发`)} onClick={onForward} /> : null}
          {onMultiSelect ? (
            <ActionButton label={t(msg`多选`)} onClick={onMultiSelect} />
          ) : null}
          {onSelectToHere ? (
            <ActionButton
              label={resolvedSelectToHereLabel}
              onClick={onSelectToHere}
            />
          ) : null}
          {onSetReminder ? (
            <ActionButton label={resolvedReminderLabel} onClick={onSetReminder} />
          ) : null}
          {onToggleFavorite ? (
            <ActionButton label={resolvedFavoriteLabel} onClick={onToggleFavorite} />
          ) : null}
          <ActionButton label={t(msg`复制`)} onClick={onCopy} />
          {onOpenAttachment ? (
            <ActionButton
              label={resolvedOpenAttachmentLabel}
              onClick={onOpenAttachment}
            />
          ) : null}
          {onSaveAttachment ? (
            <ActionButton
              label={resolvedSaveAttachmentLabel}
              onClick={onSaveAttachment}
            />
          ) : null}
          {onCopySender ? (
            <ActionButton label={t(msg`复制发送者`)} onClick={onCopySender} />
          ) : null}
          {onRecall ? (
            <ActionButton label={resolvedRecallLabel} onClick={onRecall} danger />
          ) : null}
          {onDelete ? (
            <ActionButton label={resolvedDeleteLabel} onClick={onDelete} danger />
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 flex h-11 w-full items-center justify-center rounded-[14px] border border-[color:var(--border-subtle)] bg-white text-[15px] font-medium text-[#111827] transition active:bg-[color:var(--surface-card-hover)]"
        >
          {t(msg`取消`)}
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center justify-center border-b border-[color:var(--border-subtle)] px-4 py-2.5 text-[16px] transition active:bg-[color:var(--surface-card-hover)] last:border-b-0 ${
        danger ? "text-[#d74b45]" : "text-[#111827]"
      }`}
    >
      {label}
    </button>
  );
}
