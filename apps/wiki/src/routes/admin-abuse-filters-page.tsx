import { useState } from "react";
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
import {
  wikiApi,
  type AbuseFilter,
  type AbuseFilterAction,
} from "../lib/wiki-api";

export function AdminAbuseFiltersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const filtersQ = useQuery({
    queryKey: ["wiki", "abuse-filters"],
    queryFn: () => wikiApi.listAbuseFilters(),
    enabled: hasRole(user, "admin"),
  });
  const hitsQ = useQuery({
    queryKey: ["wiki", "abuse-filter-hits"],
    queryFn: () => wikiApi.listAbuseFilterHits({ limit: 50 }),
    enabled: hasRole(user, "admin"),
  });
  const toggleMut = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      wikiApi.updateAbuseFilter(input.id, { enabled: input.enabled }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["wiki", "abuse-filters"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => wikiApi.deleteAbuseFilter(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["wiki", "abuse-filters"] }),
  });

  if (!hasRole(user, "admin")) {
    return (
      <Card className="p-6">
        <p>仅管理员可访问 wiki 反破坏过滤器配置。</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">反破坏过滤器</h1>
        <p className="text-sm text-[var(--text-muted)]">
          每次 wiki 写入会按规则匹配；命中可触发记录、警告、强制人工审核或直接拦截。
        </p>
      </div>
      {filtersQ.isLoading && <LoadingBlock />}
      {filtersQ.isError && (
        <ErrorBlock message={(filtersQ.error as Error).message} />
      )}
      <ul className="space-y-2">
        {filtersQ.data?.map((f) => (
          <FilterCard
            key={f.id}
            filter={f}
            onToggle={(enabled) =>
              toggleMut.mutate({ id: f.id, enabled })
            }
            onDelete={() => {
              if (window.confirm(`删除规则 ${f.name}？`)) {
                deleteMut.mutate(f.id);
              }
            }}
          />
        ))}
        {filtersQ.data?.length === 0 && (
          <Card className="p-4 text-sm text-[var(--text-muted)]">
            暂无过滤规则。模块启动会自动种入预置规则；如全部被删，可重启 API 重置。
          </Card>
        )}
      </ul>

      <div className="pt-3">
        <h2 className="text-base font-semibold mb-2">最近命中（50 条）</h2>
        {hitsQ.isLoading && <LoadingBlock />}
        {hitsQ.data?.length === 0 && (
          <Card className="p-4 text-sm text-[var(--text-muted)]">
            尚无命中记录。
          </Card>
        )}
        <ul className="space-y-1 text-sm">
          {hitsQ.data?.map((h) => (
            <li
              key={h.id}
              className="border border-[var(--border-subtle)] rounded p-2"
            >
              <div className="flex items-center gap-2">
                <ActionPill action={h.actionTaken} />
                <span className="font-mono text-xs">{h.userId}</span>
                <span className="text-[var(--text-muted)] text-xs">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
                {h.characterId && (
                  <span className="text-xs">
                    on{" "}
                    <span className="font-mono">{h.characterId}</span>
                  </span>
                )}
                <span className="ml-auto text-xs text-[var(--text-muted)]">
                  {h.operation}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)] break-all">
                {h.matchedText}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilterCard({
  filter,
  onToggle,
  onDelete,
}: {
  filter: AbuseFilter;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{filter.name}</span>
        <ActionPill action={filter.action} />
        <SeverityPill severity={filter.severity} />
        <span className="text-xs text-[var(--text-muted)]">
          scope: {filter.scope}
        </span>
        <span className="ml-auto text-xs">
          命中 {filter.hitCount} 次
          {filter.lastHitAt
            ? ` · 最近 ${new Date(filter.lastHitAt).toLocaleString()}`
            : ""}
        </span>
      </div>
      {filter.description && (
        <p className="text-sm text-[var(--text-muted)]">{filter.description}</p>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--text-muted)]">
          DSL pattern
        </summary>
        <pre className="bg-[rgba(0,0,0,0.04)] p-2 rounded mt-1 overflow-x-auto">
          {JSON.stringify(filter.pattern, null, 2)}
        </pre>
      </details>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={filter.enabled ? "danger" : "primary"}
          onClick={() => onToggle(!filter.enabled)}
        >
          {filter.enabled ? "禁用" : "启用"}
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          删除
        </Button>
        {!filter.enabled && <StatusPill>已停用</StatusPill>}
      </div>
    </Card>
  );
}

function ActionPill({ action }: { action: AbuseFilterAction }) {
  const label =
    action === "block"
      ? "拦截"
      : action === "tag_high_risk"
        ? "标高风险"
        : action === "warn"
          ? "警告"
          : "记录";
  const tone =
    action === "block"
      ? "bg-red-100 text-red-800"
      : action === "tag_high_risk"
        ? "bg-orange-100 text-orange-800"
        : action === "warn"
          ? "bg-yellow-100 text-yellow-800"
          : "bg-gray-100 text-gray-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${tone}`}>{label}</span>
  );
}

function SeverityPill({
  severity,
}: {
  severity: "low" | "medium" | "high";
}) {
  const tone =
    severity === "high"
      ? "bg-red-50 text-red-700"
      : severity === "medium"
        ? "bg-yellow-50 text-yellow-700"
        : "bg-gray-50 text-gray-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${tone}`}>{severity}</span>
  );
}
