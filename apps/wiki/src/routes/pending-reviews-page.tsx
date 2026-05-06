import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  ErrorBlock,
  LoadingBlock,
  StatusPill,
  TextField,
} from "@yinjie/ui";
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type PendingReviewItem } from "../lib/wiki-api";
import { SnapshotDiff } from "../components/snapshot-diff";

export function PendingReviewsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [operation, setOperation] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [revisionKind, setRevisionKind] = useState("");
  const pendingQ = useQuery({
    queryKey: ["wiki", "pending-reviews", operation, riskLevel, revisionKind],
    queryFn: () =>
      wikiApi.listPending({
        operation: operation || undefined,
        riskLevel: riskLevel || undefined,
        revisionKind: revisionKind || undefined,
      }),
    enabled: hasRole(user, "patroller"),
  });

  const decideMut = useMutation({
    mutationFn: (input: {
      revisionId: string;
      decision: "approve" | "reject" | "request_changes";
      note?: string;
    }) => wikiApi.decide(input.revisionId, input.decision, input.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wiki", "pending-reviews"] });
      void qc.invalidateQueries({ queryKey: ["wiki", "recent-changes"] });
      void qc.invalidateQueries({ queryKey: ["wiki", "characters"] });
    },
  });

  if (!user) {
    return (
      <Card className="p-6">
        <p>请先登录。</p>
      </Card>
    );
  }
  if (!hasRole(user, "patroller")) {
    return (
      <Card className="p-6">
        <p>仅巡查员及以上可访问待审编辑队列。</p>
      </Card>
    );
  }
  if (pendingQ.isLoading) return <LoadingBlock />;
  if (pendingQ.isError)
    return <ErrorBlock message={(pendingQ.error as Error).message} />;
  const items = pendingQ.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">待审编辑（{items.length}）</h1>
        <select
          className="ml-auto border border-[var(--border-subtle)] rounded px-2 py-1 text-sm bg-white"
          value={operation}
          onChange={(event) => setOperation(event.target.value)}
        >
          <option value="">全部操作</option>
          <option value="create">创建</option>
          <option value="edit">编辑</option>
          <option value="soft_delete">删除</option>
          <option value="restore">恢复</option>
        </select>
        <select
          className="border border-[var(--border-subtle)] rounded px-2 py-1 text-sm bg-white"
          value={revisionKind}
          onChange={(event) => setRevisionKind(event.target.value)}
        >
          <option value="">全部类型</option>
          <option value="content">档案</option>
          <option value="recipe">逻辑</option>
          <option value="lifecycle">生命周期</option>
        </select>
        <select
          className="border border-[var(--border-subtle)] rounded px-2 py-1 text-sm bg-white"
          value={riskLevel}
          onChange={(event) => setRiskLevel(event.target.value)}
        >
          <option value="">全部风险</option>
          <option value="low">低风险</option>
          <option value="high">高风险</option>
        </select>
      </div>
      {items.length === 0 && (
        <Card className="p-6">
          <p className="text-sm text-[var(--text-muted)]">待审队列为空。</p>
        </Card>
      )}
      {items.map((item) => (
        <ReviewCard
          key={item.submission.id}
          item={item}
          onDecide={(decision, note) =>
            decideMut.mutate({
              revisionId: item.revision.id,
              decision,
              note,
            })
          }
          loading={decideMut.isPending}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  item,
  onDecide,
  loading,
}: {
  item: PendingReviewItem;
  onDecide: (
    decision: "approve" | "reject" | "request_changes",
    note?: string,
  ) => void;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  const rev = item.revision;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/character/$characterId"
          params={{ characterId: rev.characterId }}
          className="font-medium hover:underline"
        >
          {rev.characterId}
        </Link>
        <StatusPill>v{rev.version}</StatusPill>
        <StatusPill>{rev.operation}</StatusPill>
        <StatusPill>{rev.revisionKind}</StatusPill>
        {rev.riskLevel === "high" && <StatusPill>高风险</StatusPill>}
        <span className="text-[var(--text-muted)]">
          由 {rev.editorUserId}（{rev.editorRoleAtTime}）提交于
          {new Date(rev.createdAt).toLocaleString()}
        </span>
      </div>
      {rev.editSummary && (
        <div className="text-sm">摘要：{rev.editSummary}</div>
      )}
      <div className="text-xs text-[var(--text-muted)]">
        改动字段：{rev.diffFromParent?.changed?.join(", ") ?? "—"}
      </div>
      <div className="rounded border border-[var(--border-subtle)] p-3">
        <SnapshotDiff
          before={null}
          after={rev.contentSnapshot}
          changedFields={rev.diffFromParent?.changed}
        />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--text-muted)]">
          查看完整快照
        </summary>
        <pre className="mt-2 p-3 bg-[var(--bg-canvas)] rounded text-xs overflow-x-auto">
          {JSON.stringify(rev.contentSnapshot, null, 2)}
        </pre>
      </details>
      {rev.recipeSnapshot && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--text-muted)]">
            查看角色逻辑快照
          </summary>
          <pre className="mt-2 p-3 bg-[var(--bg-canvas)] rounded text-xs overflow-x-auto">
            {JSON.stringify(rev.recipeSnapshot, null, 2)}
          </pre>
        </details>
      )}
      <label className="block">
        <span className="text-sm mb-1 block">审核备注（可选）</span>
        <TextField
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="留给提交者的反馈"
        />
      </label>
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={loading}
          onClick={() => onDecide("approve", note || undefined)}
        >
          通过
        </Button>
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => onDecide("request_changes", note || undefined)}
        >
          要求修改
        </Button>
        <Button
          variant="danger"
          disabled={loading}
          onClick={() => onDecide("reject", note || undefined)}
        >
          驳回
        </Button>
      </div>
    </Card>
  );
}
