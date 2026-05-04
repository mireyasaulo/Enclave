import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, ErrorBlock, TextField } from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";

export function ReportButton({
  targetType,
  targetId,
  className,
}: {
  targetType: "wiki_revision" | "wiki_talk_post" | "wiki_page";
  targetId: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const reportMut = useMutation({
    mutationFn: () =>
      wikiApi.reportTarget({
        targetType,
        targetId,
        reason: reason.trim(),
        details: details.trim() || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setReason("");
      setDetails("");
    },
  });

  if (!user) return null;
  if (!open) {
    return (
      <button
        type="button"
        className={`underline text-xs hover:text-[var(--state-danger-text)] ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        举报
      </button>
    );
  }
  return (
    <div className="mt-2 p-2 border border-[var(--border-subtle)] rounded space-y-2 text-xs bg-white">
      <TextField
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="原因（必填，例：辱骂 / 虚假信息）"
        maxLength={200}
      />
      <TextField
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="补充说明（可选）"
        maxLength={500}
      />
      {reportMut.isError && (
        <ErrorBlock message={(reportMut.error as Error).message} />
      )}
      {reportMut.isSuccess && (
        <div className="text-[var(--state-success-text,#0a7d4f)]">
          已提交，管理员将处理。
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={!reason.trim() || reportMut.isPending}
          onClick={() => reportMut.mutate()}
        >
          {reportMut.isPending ? "提交中..." : "提交举报"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          取消
        </Button>
      </div>
    </div>
  );
}
