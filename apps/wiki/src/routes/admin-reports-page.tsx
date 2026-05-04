import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  ErrorBlock,
  LoadingBlock,
  StatusPill,
} from "@yinjie/ui";
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type ModerationReport } from "../lib/wiki-api";

export function AdminReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const reportsQ = useQuery({
    queryKey: ["wiki", "reports", status],
    queryFn: () => wikiApi.listReports(status),
    enabled: hasRole(user, "admin"),
  });
  const setStatusMut = useMutation({
    mutationFn: (input: { id: string; status: "resolved" | "dismissed" }) =>
      wikiApi.updateReportStatus(input.id, input.status),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["wiki", "reports"] }),
  });

  if (!hasRole(user, "admin")) {
    return (
      <Card className="p-6">
        <p>仅管理员可访问。</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">举报队列</h1>
        <div className="ml-auto flex gap-2 text-sm">
          {(["open", "resolved", "dismissed"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded border ${
                status === s
                  ? "border-[var(--brand-primary)] bg-[rgba(220,252,231,0.5)]"
                  : "border-[var(--border-subtle)]"
              }`}
            >
              {s === "open" ? "未处理" : s === "resolved" ? "已处理" : "已驳回"}
            </button>
          ))}
        </div>
      </div>
      {reportsQ.isLoading && <LoadingBlock />}
      {reportsQ.isError && (
        <ErrorBlock message={(reportsQ.error as Error).message} />
      )}
      {reportsQ.data?.length === 0 && (
        <Card className="p-4 text-sm text-[var(--text-muted)]">
          当前分类下无举报。
        </Card>
      )}
      <ul className="space-y-2">
        {reportsQ.data?.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            onDecide={(s) => setStatusMut.mutate({ id: r.id, status: s })}
            disabled={setStatusMut.isPending}
          />
        ))}
      </ul>
    </div>
  );
}

function ReportCard({
  report,
  onDecide,
  disabled,
}: {
  report: ModerationReport;
  onDecide: (s: "resolved" | "dismissed") => void;
  disabled: boolean;
}) {
  return (
    <Card className="p-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill>{report.targetType}</StatusPill>
        <code className="text-xs">{report.targetId.slice(0, 12)}…</code>
        <StatusPill>{report.status}</StatusPill>
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          举报人 {report.ownerId.slice(0, 8)} ·{" "}
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="mt-1">{report.reason}</div>
      {report.details && (
        <div className="text-xs text-[var(--text-muted)] mt-1">
          {report.details}
        </div>
      )}
      {report.targetType === "wiki_page" && (
        <Link
          to="/character/$characterId"
          params={{ characterId: report.targetId }}
          className="text-xs underline mt-1 inline-block"
        >
          打开词条
        </Link>
      )}
      {report.status === "open" && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="primary"
            disabled={disabled}
            onClick={() => onDecide("resolved")}
          >
            标记已处理
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onDecide("dismissed")}
          >
            驳回
          </Button>
        </div>
      )}
    </Card>
  );
}
