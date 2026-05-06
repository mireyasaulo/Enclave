import { useQuery } from "@tanstack/react-query";
import { Card, ErrorBlock, LoadingBlock } from "@yinjie/ui";
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";

export function AdminStatsPage() {
  const { user } = useAuth();
  const dailyQ = useQuery({
    queryKey: ["wiki", "stats", "daily"],
    queryFn: () => wikiApi.wikiStatsDaily(),
    enabled: hasRole(user, "admin"),
  });
  const topQ = useQuery({
    queryKey: ["wiki", "stats", "top-reverted"],
    queryFn: () => wikiApi.wikiStatsTopReverted(20),
    enabled: hasRole(user, "admin"),
  });
  const filterQ = useQuery({
    queryKey: ["wiki", "stats", "filters"],
    queryFn: () => wikiApi.wikiStatsAbuseFilters(),
    enabled: hasRole(user, "admin"),
  });

  if (!hasRole(user, "admin")) {
    return (
      <Card className="p-6">
        <p>仅管理员可访问 wiki 统计仪表盘。</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Wiki 治理仪表盘</h1>
      {dailyQ.isLoading && <LoadingBlock />}
      {dailyQ.isError && (
        <ErrorBlock message={(dailyQ.error as Error).message} />
      )}
      {dailyQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="今日新建词条" value={dailyQ.data.todayCreates} />
          <StatCard label="近 7 天新建词条" value={dailyQ.data.weekCreates} />
          <StatCard label="待审队列长度" value={dailyQ.data.pendingQueueLength} />
          <StatCard label="今日通过审核" value={dailyQ.data.todayApproved} />
          <StatCard label="今日驳回" value={dailyQ.data.todayRejected} />
          <StatCard label="今日反破坏命中" value={dailyQ.data.abuseHitsToday} />
          <StatCard
            label="本周新晋自动确认"
            value={dailyQ.data.autoconfirmedThisWeek}
          />
        </div>
      )}

      <h2 className="text-lg font-semibold">被回滚最多的用户（top 20）</h2>
      {topQ.isLoading && <LoadingBlock />}
      {topQ.data?.length === 0 && (
        <Card className="p-3 text-sm text-[var(--text-muted)]">无记录</Card>
      )}
      <ul className="space-y-1 text-sm">
        {topQ.data?.map((u) => (
          <li
            key={u.userId}
            className="border border-[var(--border-subtle)] rounded p-2 flex items-center gap-3"
          >
            <span className="font-mono text-xs">{u.userId}</span>
            <span className="text-[var(--text-muted)] text-xs">
              edits {u.editCount} · approved {u.approvedEditCount}
            </span>
            <span
              className={
                u.revertedCount > 0
                  ? "ml-auto text-red-700 font-medium"
                  : "ml-auto text-[var(--text-muted)]"
              }
            >
              reverted {u.revertedCount}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold">过滤器命中（近 7 天）</h2>
      {filterQ.isLoading && <LoadingBlock />}
      <ul className="space-y-1 text-sm">
        {filterQ.data?.map(({ filter, recentHits }) => (
          <li
            key={filter.id}
            className="border border-[var(--border-subtle)] rounded p-2 flex items-center gap-3"
          >
            <span className="font-medium">{filter.name}</span>
            <span className="text-xs text-[var(--text-muted)]">
              action: {filter.action}
            </span>
            <span className="ml-auto">近 7 天 {recentHits} 命中</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}
