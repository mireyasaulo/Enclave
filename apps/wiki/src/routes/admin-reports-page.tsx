import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ErrorBlock,
  LoadingBlock,
  PanelEmpty,
  StatusPill,
} from "@yinjie/ui";
import { wikiApi, type ModerationReport } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function AdminReportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">(
    "open",
  );
  const reportsQ = useQuery({
    queryKey: ["wiki", "reports", status],
    queryFn: () => wikiApi.listReports(status),
  });
  const setStatusMut = useMutation({
    mutationFn: (input: { id: string; status: "resolved" | "dismissed" }) =>
      wikiApi.updateReportStatus(input.id, input.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki", "reports"] }),
  });

  const tabs: [typeof status, string][] = [
    ["open", "未处理"],
    ["resolved", "已处理"],
    ["dismissed", "已驳回"],
  ];

  return (
    <PageShell
      eyebrow="管理"
      title="举报队列"
      description="社区举报的内容会先进入“未处理”状态。逐条审核后选择已处理或驳回。"
      actions={
        <div className="inline-flex rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-1 shadow-[var(--shadow-soft)]">
          {tabs.map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-current={status === s ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                status === s
                  ? "bg-[image:var(--brand-gradient)] text-[color:var(--text-on-brand)] shadow-[var(--shadow-soft)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card-hover)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {reportsQ.isLoading && <LoadingBlock />}
      {reportsQ.isError && (
        <ErrorBlock message={(reportsQ.error as Error).message} />
      )}
      {reportsQ.data?.length === 0 && (
        <PanelEmpty message="当前分类下暂无举报。" />
      )}
      <ul className="space-y-2">
        {reportsQ.data?.map((r) => (
          <li key={r.id}>
            <ReportCard
              report={r}
              onDecide={(s) => setStatusMut.mutate({ id: r.id, status: s })}
              disabled={setStatusMut.isPending}
            />
          </li>
        ))}
      </ul>
    </PageShell>
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
    <div className="space-y-2 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[color:var(--surface-card-hover)]">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill>{report.targetType}</StatusPill>
        <code className="text-xs">{report.targetId.slice(0, 12)}…</code>
        <StatusPill>{report.status}</StatusPill>
        <span className="ml-auto text-xs text-[color:var(--text-muted)]">
          举报人 {report.ownerId.slice(0, 8)} ·{" "}
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>
      <div>{report.reason}</div>
      {report.details && (
        <div className="text-xs text-[color:var(--text-muted)]">
          {report.details}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {report.targetType === "wiki_page" && (
          <Link
            to="/character/$characterId"
            params={{ characterId: report.targetId }}
            className="text-xs underline"
          >
            打开词条
          </Link>
        )}
        {report.status === "open" && (
          <div className="ml-auto flex gap-2">
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
      </div>
    </div>
  );
}
