import { useQuery } from "@tanstack/react-query";
import {
  ErrorBlock,
  LoadingBlock,
  MetricCard,
  PanelEmpty,
} from "@yinjie/ui";
import { wikiApi } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function AdminStatsPage() {
  const dailyQ = useQuery({
    queryKey: ["wiki", "stats", "daily"],
    queryFn: () => wikiApi.wikiStatsDaily(),
  });
  const topQ = useQuery({
    queryKey: ["wiki", "stats", "top-reverted"],
    queryFn: () => wikiApi.wikiStatsTopReverted(20),
  });
  const filterQ = useQuery({
    queryKey: ["wiki", "stats", "filters"],
    queryFn: () => wikiApi.wikiStatsAbuseFilters(),
  });

  return (
    <PageShell
      eyebrow="管理"
      title="治理仪表盘"
      description="日度新建/审核数据、被回滚最多的用户、过滤器近 7 天命中量。"
    >
      {dailyQ.isLoading && <LoadingBlock />}
      {dailyQ.isError && (
        <ErrorBlock message={(dailyQ.error as Error).message} />
      )}
      {dailyQ.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <MetricCard label="今日新建词条" value={dailyQ.data.todayCreates} />
          <MetricCard
            label="近 7 天新建词条"
            value={dailyQ.data.weekCreates}
          />
          <MetricCard
            label="待审队列长度"
            value={dailyQ.data.pendingQueueLength}
          />
          <MetricCard label="今日通过审核" value={dailyQ.data.todayApproved} />
          <MetricCard label="今日驳回" value={dailyQ.data.todayRejected} />
          <MetricCard
            label="今日反破坏命中"
            value={dailyQ.data.abuseHitsToday}
          />
          <MetricCard
            label="本周新晋自动确认"
            value={dailyQ.data.autoconfirmedThisWeek}
          />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">被回滚最多的用户（top 20）</h2>
        {topQ.isLoading && <LoadingBlock />}
        {topQ.data?.length === 0 && <PanelEmpty message="无记录" />}
        <ul className="space-y-1.5">
          {topQ.data?.map((u) => (
            <li
              key={u.userId}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
            >
              <span className="font-mono text-xs">{u.userId}</span>
              <span className="text-xs text-[color:var(--text-muted)]">
                edits {u.editCount} · approved {u.approvedEditCount}
              </span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                  u.revertedCount > 0
                    ? "bg-[color:var(--state-danger-bg)] text-[color:var(--state-danger-text)]"
                    : "bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]"
                }`}
              >
                reverted {u.revertedCount}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">过滤器命中（近 7 天）</h2>
        {filterQ.isLoading && <LoadingBlock />}
        {filterQ.data?.length === 0 && <PanelEmpty message="无记录" />}
        <ul className="space-y-1.5">
          {filterQ.data?.map(({ filter, recentHits }) => (
            <li
              key={filter.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-2 text-sm shadow-[var(--shadow-soft)]"
            >
              <span className="font-medium">{filter.name}</span>
              <span className="text-xs text-[color:var(--text-muted)]">
                action: {filter.action}
              </span>
              <span className="ml-auto">近 7 天 {recentHits} 命中</span>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
