import { type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  BellRing,
  CheckSquare,
  Copy,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileText,
  Forward,
  RotateCcw,
  Smile,
  Star,
  Trash2,
  UserRound,
  Volume2,
} from "lucide-react";

const t = translateRuntimeMessage;

type GroupMessageContextMenuProps = {
  x: number;
  y: number;
  onClose: () => void;
  onReply?: () => void;
  onQuoteSelection?: () => void;
  quoteSelectionLabel?: string;
  onForward?: () => void;
  onMultiSelect?: () => void;
  onSetReminder?: () => void;
  reminderLabel?: string;
  onCopyText: () => void;
  onCopySender?: () => void;
  onSpeakAloud?: () => void;
  speakAloudLabel?: string;
  onToggleFavorite?: () => void;
  favoriteLabel?: string;
  onAddToStickers?: () => void;
  addToStickersLabel?: string;
  onOpenAttachment?: () => void;
  openAttachmentLabel?: string;
  onSaveAttachment?: () => void;
  saveAttachmentLabel?: string;
  onRecall?: () => void;
  recallLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
};

const MENU_WIDTH = 196;
const VIEWPORT_PADDING = 12;

export function GroupMessageContextMenu({
  x,
  y,
  onClose,
  onReply,
  onQuoteSelection,
  quoteSelectionLabel = t(msg`部分引用`),
  onForward,
  onMultiSelect,
  onSetReminder,
  reminderLabel = t(msg`提醒`),
  onCopyText,
  onCopySender,
  onSpeakAloud,
  speakAloudLabel = t(msg`朗读`),
  onToggleFavorite,
  favoriteLabel = t(msg`收藏`),
  onAddToStickers,
  addToStickersLabel = t(msg`添加到表情`),
  onOpenAttachment,
  openAttachmentLabel = t(msg`打开附件`),
  onSaveAttachment,
  saveAttachmentLabel = t(msg`另存为`),
  onRecall,
  recallLabel = t(msg`撤回`),
  onDelete,
  deleteLabel = t(msg`删除`),
}: GroupMessageContextMenuProps) {
  const normalizedReminderLabel =
    reminderLabel === t(msg`提醒`) ? t(msg`设为提醒`) : reminderLabel;
  const normalizedFavoriteLabel =
    favoriteLabel === t(msg`收藏消息`) ? t(msg`收藏`) : favoriteLabel;
  const actionCount =
    1 +
    Number(Boolean(onReply)) +
    Number(Boolean(onQuoteSelection)) +
    Number(Boolean(onForward)) +
    Number(Boolean(onMultiSelect)) +
    Number(Boolean(onSetReminder)) +
    Number(Boolean(onCopySender)) +
    Number(Boolean(onSpeakAloud)) +
    Number(Boolean(onToggleFavorite)) +
    Number(Boolean(onAddToStickers)) +
    Number(Boolean(onOpenAttachment)) +
    Number(Boolean(onSaveAttachment)) +
    Number(Boolean(onRecall)) +
    Number(Boolean(onDelete));
  const menuHeight = actionCount * 42 + 16;
  const viewportWidth =
    typeof window === "undefined" ? MENU_WIDTH : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? menuHeight : window.innerHeight;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, x),
    Math.max(VIEWPORT_PADDING, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING),
  );
  const top = Math.min(
    Math.max(VIEWPORT_PADDING, y),
    Math.max(VIEWPORT_PADDING, viewportHeight - menuHeight - VIEWPORT_PADDING),
  );

  return (
    <div
      className="fixed inset-0 z-50"
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t(msg`关闭消息菜单`)}
        className="absolute inset-0 cursor-default bg-transparent"
      />

      <div
        style={{ left, top }}
        className="absolute w-[196px] overflow-hidden rounded-[14px] border border-[color:var(--border-faint)] bg-white py-1.5 shadow-[var(--shadow-overlay)]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {onReply ? (
          <ContextMenuButton
            label={t(msg`回复`)}
            icon={<CornerUpLeft size={15} />}
            onClick={onReply}
          />
        ) : null}
        {onQuoteSelection ? (
          <ContextMenuButton
            label={quoteSelectionLabel}
            icon={<FileText size={15} />}
            onClick={onQuoteSelection}
          />
        ) : null}
        {onForward ? (
          <ContextMenuButton
            label={t(msg`转发`)}
            icon={<Forward size={15} />}
            onClick={onForward}
          />
        ) : null}
        {onMultiSelect ? (
          <ContextMenuButton
            label={t(msg`多选`)}
            icon={<CheckSquare size={15} />}
            onClick={onMultiSelect}
          />
        ) : null}
        <ContextMenuButton
          label={t(msg`复制`)}
          icon={<Copy size={15} />}
          onClick={onCopyText}
        />
        {onCopySender ? (
          <ContextMenuButton
            label={t(msg`复制发送者`)}
            icon={<UserRound size={15} />}
            onClick={onCopySender}
          />
        ) : null}
        {onSpeakAloud ? (
          <ContextMenuButton
            label={speakAloudLabel}
            icon={<Volume2 size={15} />}
            onClick={onSpeakAloud}
          />
        ) : null}
        {onReply || onQuoteSelection || onForward || onMultiSelect ? (
          <MenuDivider />
        ) : null}
        {onSetReminder ? (
          <ContextMenuButton
            label={normalizedReminderLabel}
            icon={<BellRing size={15} />}
            onClick={onSetReminder}
          />
        ) : null}
        {onToggleFavorite ? (
          <ContextMenuButton
            label={normalizedFavoriteLabel}
            icon={<Star size={15} />}
            onClick={onToggleFavorite}
          />
        ) : null}
        {onAddToStickers ? (
          <ContextMenuButton
            label={addToStickersLabel}
            icon={<Smile size={15} />}
            onClick={onAddToStickers}
          />
        ) : null}
        {onOpenAttachment ? (
          <ContextMenuButton
            label={openAttachmentLabel}
            icon={<ExternalLink size={15} />}
            onClick={onOpenAttachment}
          />
        ) : null}
        {onSaveAttachment ? (
          <ContextMenuButton
            label={saveAttachmentLabel}
            icon={<Download size={15} />}
            onClick={onSaveAttachment}
          />
        ) : null}
        {onSetReminder ||
        onToggleFavorite ||
        onAddToStickers ||
        onOpenAttachment ||
        onSaveAttachment ? (
          <MenuDivider />
        ) : null}
        {onRecall ? (
          <ContextMenuButton
            danger
            label={recallLabel}
            icon={<RotateCcw size={15} />}
            onClick={onRecall}
          />
        ) : null}
        {onDelete ? (
          <ContextMenuButton
            danger
            label={deleteLabel}
            icon={<Trash2 size={15} />}
            onClick={onDelete}
          />
        ) : null}
      </div>
    </div>
  );
}

function ContextMenuButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-[color:var(--surface-console)] ${
        danger
          ? "text-[color:var(--state-danger-text)]"
          : "text-[color:var(--text-primary)]"
      }`}
    >
      <span
        className={
          danger
            ? "text-[color:var(--state-danger-text)]"
            : "text-[color:var(--text-secondary)]"
        }
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="mx-3 my-1 border-t border-[color:var(--border-faint)]" />;
}
