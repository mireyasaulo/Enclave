import { useState } from "react";
import { msg } from "@lingui/macro";
import {
  CheckCheck,
  Star,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import { useBulkFriendshipMutation } from "./use-bulk-friendship-mutation";

type Props = {
  selectedIds: string[];
  totalIds: string[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDone: () => void;
  setNotice?: (message: string | null) => void;
  desktop?: boolean;
};

export function ContactsBulkActionBar({
  selectedIds,
  totalIds,
  onSelectAll,
  onClearSelection,
  onDone,
  setNotice,
  desktop = false,
}: Props) {
  const t = useRuntimeTranslator();
  const [tagDraft, setTagDraft] = useState("");
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const allSelected = totalIds.length > 0 && selectedIds.length === totalIds.length;
  const hasSelection = selectedIds.length > 0;

  const bulk = useBulkFriendshipMutation();

  const flushNotice = (success: boolean, action: string) => {
    if (!setNotice) return;
    setNotice(success ? `${action}${t(msg`：操作成功`)}` : t(msg`部分操作失败`));
  };

  const runStar = (starred: boolean) => {
    if (!hasSelection) return;
    bulk.mutate(
      {
        characterIds: selectedIds,
        action: starred ? "star" : "unstar",
      },
      {
        onSuccess: (res) => {
          flushNotice(res.failed.length === 0, starred ? t(msg`设星标`) : t(msg`取消星标`));
          onDone();
        },
      },
    );
  };

  const runTag = () => {
    const tag = tagDraft.trim();
    if (!tag || !hasSelection) {
      setShowTagDialog(false);
      return;
    }
    bulk.mutate(
      {
        characterIds: selectedIds,
        action: "add-tag",
        tag,
      },
      {
        onSuccess: (res) => {
          flushNotice(res.failed.length === 0, t(msg`打标签`));
          setShowTagDialog(false);
          setTagDraft("");
          onDone();
        },
      },
    );
  };

  const runDelete = () => {
    if (!hasSelection) return;
    bulk.mutate(
      {
        characterIds: selectedIds,
        action: "delete",
      },
      {
        onSuccess: (res) => {
          flushNotice(res.failed.length === 0, t(msg`删除`));
          setShowDeleteDialog(false);
          onDone();
        },
      },
    );
  };

  const buttons = [
    {
      key: "tag",
      label: t(msg`打标签`),
      icon: TagIcon,
      onClick: () => setShowTagDialog(true),
    },
    {
      key: "star",
      label: t(msg`设星标`),
      icon: Star,
      onClick: () => runStar(true),
    },
    {
      key: "delete",
      label: t(msg`删除`),
      icon: Trash2,
      onClick: () => setShowDeleteDialog(true),
      danger: true,
    },
  ];

  return (
    <>
      <div
        className={cn(
          "z-40 border-t border-[color:var(--border-faint)] bg-white/96 backdrop-blur-md",
          desktop ? "" : "fixed inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom,0px)]",
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={!totalIds.length}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] bg-white px-3 text-[12px] text-[color:var(--text-secondary)] disabled:opacity-50"
          >
            <CheckCheck size={13} />
            {allSelected ? t(msg`取消全选`) : t(msg`全选`)}
          </button>
          <div className="ml-auto flex items-center gap-2">
            {buttons.map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={btn.onClick}
                  disabled={!hasSelection || bulk.isPending}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium",
                    btn.danger
                      ? "bg-[#fef2f2] text-[#d74b45] disabled:opacity-50"
                      : "bg-[#07c160] text-white disabled:opacity-50",
                  )}
                >
                  <Icon size={13} />
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showTagDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(17,24,39,0.32)] p-6 backdrop-blur-[3px]">
          <button
            type="button"
            aria-label={t(msg`关闭`)}
            onClick={() => setShowTagDialog(false)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-[420px] overflow-hidden rounded-[16px] bg-white shadow-[var(--shadow-overlay)]">
            <div className="border-b border-[color:var(--border-faint)] px-5 py-3 text-[15px] font-medium text-[color:var(--text-primary)]">
              {t(msg`打标签`)}
            </div>
            <div className="px-5 py-4">
              <input
                type="text"
                autoFocus
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder={t(msg`标签名称`)}
                className="h-10 w-full rounded-[10px] border border-[color:var(--border-faint)] bg-white px-3 text-[14px] text-[color:var(--text-primary)] outline-none focus:border-[#07c160]"
              />
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                {t(msg`已选 ${selectedIds.length} 项`)}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTagDialog(false)}
                  className="h-9 rounded-full border border-[color:var(--border-faint)] bg-white px-4 text-[13px] text-[color:var(--text-secondary)]"
                >
                  {t(msg`取消`)}
                </button>
                <button
                  type="button"
                  onClick={runTag}
                  disabled={!tagDraft.trim() || bulk.isPending}
                  className="h-9 rounded-full bg-[#07c160] px-4 text-[13px] font-medium text-white disabled:opacity-50"
                >
                  {t(msg`确定`)}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteDialog ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(17,24,39,0.32)] p-6 backdrop-blur-[3px]">
          <button
            type="button"
            aria-label={t(msg`关闭`)}
            onClick={() => setShowDeleteDialog(false)}
            className="absolute inset-0"
          />
          <div className="relative w-full max-w-[380px] overflow-hidden rounded-[16px] bg-white shadow-[var(--shadow-overlay)]">
            <div className="px-5 py-5 text-center">
              <div className="text-[15px] font-medium text-[color:var(--text-primary)]">
                {t(msg`确定删除选中的 ${selectedIds.length} 个朋友吗?`)}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-[color:var(--text-muted)]">
                {t(msg`删除后将不会通知对方，可重新添加。`)}
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-[color:var(--border-faint)]">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="h-11 text-[14px] text-[color:var(--text-secondary)]"
              >
                {t(msg`取消`)}
              </button>
              <button
                type="button"
                onClick={runDelete}
                disabled={bulk.isPending}
                className="h-11 border-l border-[color:var(--border-faint)] text-[14px] font-medium text-[#d74b45] disabled:opacity-50"
              >
                {t(msg`删除`)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
