import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ErrorBlock,
  LoadingBlock,
  PanelEmpty,
  StatusPill,
} from "@yinjie/ui";
import {
  wikiApi,
  type AbuseFilter,
  type AbuseFilterAction,
} from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function AdminAbuseFiltersPage() {
  const qc = useQueryClient();
  const filtersQ = useQuery({
    queryKey: ["wiki", "abuse-filters"],
    queryFn: () => wikiApi.listAbuseFilters(),
  });
  const hitsQ = useQuery({
    queryKey: ["wiki", "abuse-filter-hits"],
    queryFn: () => wikiApi.listAbuseFilterHits({ limit: 50 }),
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

  return (
    <PageShell
      eyebrow="管理"
      title="反破坏过滤器"
      description="每次 wiki 写入都会按规则匹配；命中后可触发记录、警告、强制人工审核或直接拦截。"
    >
      {filtersQ.isLoading && <LoadingBlock />}
      {filtersQ.isError && (
        <ErrorBlock message={(filtersQ.error as Error).message} />
      )}
      <ul className="space-y-2">
        {filtersQ.data?.map((f) => (
          <li key={f.id}>
            <FilterCard
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
          </li>
        ))}
        {filtersQ.data?.length === 0 && (
          <PanelEmpty message="暂无过滤规则。模块启动会自动种入预置规则；如全部被删，可重启 API 重置。" />
        )}
      </ul>

      <section className="space-y-3 pt-4">
        <h2 className="text-base font-semibold">最近命中（50 条）</h2>
        {hitsQ.isLoading && <LoadingBlock />}
        {hitsQ.data?.length === 0 && (
          <PanelEmpty message="尚无命中记录。" />
        )}
        <ul className="space-y-1.5">
          {hitsQ.data?.map((h) => (
            <li
              key={h.id}
              className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <ActionPill action={h.actionTaken} />
                <span className="font-mono text-xs">{h.userId}</span>
                <span className="text-xs text-[color:var(--text-muted)]">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
                {h.characterId && (
                  <span className="text-xs">
                    on <span className="font-mono">{h.characterId}</span>
                  </span>
                )}
                <span className="ml-auto text-xs text-[color:var(--text-muted)]">
                  {h.operation}
                </span>
              </div>
              <div className="mt-1 break-all text-xs text-[color:var(--text-muted)]">
                {h.matchedText}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
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
    <div
      className={`space-y-2 rounded-2xl border bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] ${
        filter.enabled
          ? "border-[color:var(--border-faint)]"
          : "border-[color:var(--border-faint)] opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[color:var(--text-primary)]">
          {filter.name}
        </span>
        <ActionPill action={filter.action} />
        <SeverityPill severity={filter.severity} />
        <span className="text-xs text-[color:var(--text-muted)]">
          scope: {filter.scope}
        </span>
        {!filter.enabled && <StatusPill>已停用</StatusPill>}
        <span className="ml-auto text-xs text-[color:var(--text-muted)]">
          命中 {filter.hitCount} 次
          {filter.lastHitAt
            ? ` · 最近 ${new Date(filter.lastHitAt).toLocaleString()}`
            : ""}
        </span>
      </div>
      {filter.description && (
        <p className="text-[color:var(--text-secondary)]">
          {filter.description}
        </p>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-[color:var(--text-muted)]">
          DSL pattern
        </summary>
        <pre className="mt-1 overflow-x-auto rounded bg-[rgba(0,0,0,0.04)] p-2">
          {JSON.stringify(filter.pattern, null, 2)}
        </pre>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter.enabled ? "secondary" : "primary"}
          onClick={() => onToggle(!filter.enabled)}
        >
          {filter.enabled ? "停用" : "启用"}
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          删除
        </Button>
      </div>
    </div>
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
      ? "bg-[color:var(--state-danger-bg)] text-[color:var(--state-danger-text)]"
      : action === "tag_high_risk"
        ? "bg-[color:var(--state-warning-bg)] text-[color:var(--state-warning-text)]"
        : action === "warn"
          ? "bg-[color:var(--state-info-bg)] text-[color:var(--state-info-text)]"
          : "bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function SeverityPill({
  severity,
}: {
  severity: "low" | "medium" | "high";
}) {
  const tone =
    severity === "high"
      ? "bg-[color:var(--state-danger-bg)] text-[color:var(--state-danger-text)]"
      : severity === "medium"
        ? "bg-[color:var(--state-warning-bg)] text-[color:var(--state-warning-text)]"
        : "bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {severity}
    </span>
  );
}
