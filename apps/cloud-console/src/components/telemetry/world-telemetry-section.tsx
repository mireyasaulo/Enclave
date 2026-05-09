import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TelemetryRange } from "@yinjie/contracts";
import { ErrorBlock, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../../lib/cloud-admin-api";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";
import { TelemetryOverviewCards } from "./overview-cards";
import { TelemetryLineChart } from "./pv-uv-chart";
import { TelemetryTopEventsTable } from "./top-events-table";

/**
 * 世界详情页内嵌的"该世界活动"section。
 *
 * 复用全局 telemetry 页的三个组件——OverviewCards / TopEventsTable / LineChart——
 * 但所有查询都固定在 worldId 上，给运营一个"这个世界今天活不活跃"的快速答案。
 * 第一版有意不放 funnel / api-health / errors 三个 tab，避免详情页堆得太满。
 */
export function WorldTelemetrySection({ worldId }: { worldId: string }) {
  const t = useCloudConsoleText();
  const [range, setRange] = useState<TelemetryRange>("7d");

  const overview = useQuery({
    queryKey: ["world-telemetry", "overview", worldId, range],
    queryFn: () =>
      cloudAdminApi.getTelemetryOverview(range, undefined, worldId),
  });
  const topEvents = useQuery({
    queryKey: ["world-telemetry", "top-events", worldId, range],
    queryFn: () =>
      cloudAdminApi.getTelemetryTopEvents(range, undefined, worldId),
  });
  const pvSeries = useQuery({
    queryKey: ["world-telemetry", "timeseries", "page_view", worldId, range],
    queryFn: () =>
      cloudAdminApi.getTelemetryTimeseries({
        eventName: "page_view",
        range,
        groupBy: "none",
        worldId,
      }),
  });

  const ranges: Array<{ value: TelemetryRange; label: string }> = [
    { value: "24h", label: t("24 hours") },
    { value: "7d", label: t("7 days") },
    { value: "30d", label: t("30 days") },
  ];

  return (
    <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t("Recent activity")}
          </div>
          <div className="mt-1 text-xs leading-6 text-[color:var(--text-muted)]">
            {t(
              "Page views, active users and top operations captured for this world by client telemetry.",
            )}
          </div>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-(--border-subtle) bg-(--surface-card)">
          {ranges.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={
                range === opt.value
                  ? "bg-(--brand-primary) px-3 py-1.5 text-xs font-semibold text-white"
                  : "px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:bg-(--surface-soft)"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {overview.isLoading ? (
          <LoadingBlock />
        ) : overview.error ? (
          <ErrorBlock
            title={t("Failed to load overview")}
            message={String(overview.error)}
          />
        ) : overview.data ? (
          <TelemetryOverviewCards data={overview.data} />
        ) : null}

        {pvSeries.isLoading ? (
          <LoadingBlock />
        ) : pvSeries.error ? (
          <ErrorBlock
            title={t("Failed to load line chart")}
            message={String(pvSeries.error)}
          />
        ) : pvSeries.data ? (
          <TelemetryLineChart
            title={t("Page views (this world)")}
            points={pvSeries.data.points}
          />
        ) : null}

        {topEvents.isLoading ? (
          <LoadingBlock />
        ) : topEvents.error ? (
          <ErrorBlock
            title={t("Failed to load events")}
            message={String(topEvents.error)}
          />
        ) : topEvents.data ? (
          <TelemetryTopEventsTable data={topEvents.data} />
        ) : null}
      </div>
    </div>
  );
}
