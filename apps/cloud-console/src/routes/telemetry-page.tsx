import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TelemetryAppId, TelemetryRange } from "@yinjie/contracts";
import { ErrorBlock, LoadingBlock } from "@yinjie/ui";
import { TelemetryOverviewCards } from "../components/telemetry/overview-cards";
import { TelemetryLineChart } from "../components/telemetry/pv-uv-chart";
import { TelemetryRangePicker } from "../components/telemetry/range-picker";
import { cloudAdminApi } from "../lib/cloud-admin-api";

export function TelemetryPage() {
  const [range, setRange] = useState<TelemetryRange>("7d");
  const [appId, setAppId] = useState<TelemetryAppId | undefined>(undefined);

  const overview = useQuery({
    queryKey: ["telemetry", "overview", range, appId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryOverview(range, appId),
  });

  const pvSeries = useQuery({
    queryKey: ["telemetry", "timeseries", "page_view", range, appId ?? "all"],
    queryFn: () =>
      cloudAdminApi.getTelemetryTimeseries({
        eventName: "page_view",
        range,
        groupBy: "appId",
        appId,
      }),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">Telemetry</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">
            客户端埋点上报、PV/UV、API 健康度与前端错误。
          </p>
        </div>
        <TelemetryRangePicker
          range={range}
          appId={appId}
          onRangeChange={setRange}
          onAppIdChange={setAppId}
        />
      </header>

      {overview.isLoading ? (
        <LoadingBlock />
      ) : overview.error ? (
        <ErrorBlock title="加载概览失败" message={String(overview.error)} />
      ) : overview.data ? (
        <TelemetryOverviewCards data={overview.data} />
      ) : null}

      {pvSeries.isLoading ? (
        <LoadingBlock />
      ) : pvSeries.error ? (
        <ErrorBlock title="加载折线失败" message={String(pvSeries.error)} />
      ) : pvSeries.data ? (
        <TelemetryLineChart
          title="页面浏览（按端分组）"
          points={pvSeries.data.points}
        />
      ) : null}
    </div>
  );
}
