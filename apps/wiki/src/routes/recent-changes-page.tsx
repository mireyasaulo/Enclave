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
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiRevisionSummary } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function RecentChangesPage() {
  const { user } = useAuth();
  const isPatroller = hasRole(user, "patroller");
  const [onlyUnpatrolled, setOnlyUnpatrolled] = useState(false);
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["wiki", "recent-changes", onlyUnpatrolled],
    queryFn: () => wikiApi.recentChanges({ onlyUnpatrolled }),
  });

  const patrolMut = useMutation({
    mutationFn: (revisionId: string) => wikiApi.patrol(revisionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wiki", "recent-changes"] });
    },
  });

  return (
    <PageShell
      eyebrow="动态"
      title="最近修改"
      description="所有词条的提交、生命周期变更与审核流转。巡查员可以勾选“仅看待巡查”筛掉已巡查项。"
      actions={
        isPatroller ? (
          <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]">
            <input
              type="checkbox"
              checked={onlyUnpatrolled}
              onChange={(e) => setOnlyUnpatrolled(e.target.checked)}
            />
            仅看待巡查
          </label>
        ) : null
      }
    >
      {listQ.isLoading && <LoadingBlock />}
      {listQ.isError && (
        <ErrorBlock message={(listQ.error as Error).message} />
      )}
      {listQ.data && listQ.data.length === 0 && (
        <PanelEmpty message="暂无变更。" />
      )}
      {listQ.data && listQ.data.length > 0 && (
        <ul className="space-y-2">
          {listQ.data.map((rev) => (
            <ChangeRow
              key={rev.id}
              rev={rev}
              isPatroller={isPatroller}
              onPatrol={() => patrolMut.mutate(rev.id)}
              patrolling={patrolMut.isPending}
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function ChangeRow({
  rev,
  isPatroller,
  onPatrol,
  patrolling,
}: {
  rev: WikiRevisionSummary;
  isPatroller: boolean;
  onPatrol: () => void;
  patrolling: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[color:var(--surface-card-hover)]">
      <div className="w-12 shrink-0 pt-0.5 font-mono text-xs text-[color:var(--text-muted)]">
        v{rev.version}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/character/$characterId"
            params={{ characterId: rev.characterId }}
            className="truncate font-medium text-[color:var(--text-primary)] hover:underline"
          >
            {rev.characterId}
          </Link>
          <StatusPill>{rev.status}</StatusPill>
          <StatusPill>{rev.operation}</StatusPill>
          {rev.revisionKind !== "content" && (
            <StatusPill>{rev.revisionKind}</StatusPill>
          )}
          {rev.riskLevel === "high" && <StatusPill>高风险</StatusPill>}
          {rev.changeSource !== "edit" && (
            <StatusPill>{rev.changeSource}</StatusPill>
          )}
          {!rev.isPatrolled && rev.status === "approved" && (
            <span className="rounded-full bg-[color:var(--state-warning-bg)] px-2 py-0.5 text-xs text-[color:var(--state-warning-text)]">
              待巡查
            </span>
          )}
          {rev.isMinor && (
            <span className="text-xs text-[color:var(--text-muted)]">
              小修改
            </span>
          )}
        </div>
        <div className="text-xs text-[color:var(--text-muted)]">
          {rev.editorUserId}（{rev.editorRoleAtTime}） ·{" "}
          {new Date(rev.createdAt).toLocaleString()}
        </div>
        {rev.editSummary && (
          <div className="text-sm leading-6">{rev.editSummary}</div>
        )}
        {rev.diffFromParent?.changed && (
          <div className="text-xs text-[color:var(--text-muted)]">
            字段：{rev.diffFromParent.changed.join(", ")}
          </div>
        )}
      </div>
      {isPatroller && !rev.isPatrolled && rev.status === "approved" && (
        <Button
          size="sm"
          variant="primary"
          disabled={patrolling}
          onClick={onPatrol}
        >
          标记已巡查
        </Button>
      )}
    </li>
  );
}
