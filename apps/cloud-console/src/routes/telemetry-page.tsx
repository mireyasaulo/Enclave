import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TelemetryAppId, TelemetryRange } from "@yinjie/contracts";
import { ErrorBlock, LoadingBlock } from "@yinjie/ui";
import { TelemetryApiHealthTable } from "../components/telemetry/api-health-table";
import { TelemetryErrorsList } from "../components/telemetry/errors-list";
import {
  TelemetryFunnelChart,
  TelemetryFunnelEditor,
} from "../components/telemetry/funnel-chart";
import { TelemetryOverviewCards } from "../components/telemetry/overview-cards";
import { TelemetryLineChart } from "../components/telemetry/pv-uv-chart";
import { TelemetryRangePicker } from "../components/telemetry/range-picker";
import { TelemetryTopEventsTable } from "../components/telemetry/top-events-table";
import { cloudAdminApi } from "../lib/cloud-admin-api";

type TabKey = "overview" | "events" | "funnel" | "api" | "errors";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "概览" },
  { key: "events", label: "事件" },
  { key: "funnel", label: "漏斗" },
  { key: "api", label: "API 健康度" },
  { key: "errors", label: "错误" },
];

export function TelemetryPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [range, setRange] = useState<TelemetryRange>("7d");
  const [appId, setAppId] = useState<TelemetryAppId | undefined>(undefined);
  const [funnelSteps, setFunnelSteps] = useState(
    "page_view,login_success,pay_checkout_success",
  );

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

      <nav className="flex flex-wrap gap-1 border-b border-(--border-faint)">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "border-b-2 border-(--brand-primary) px-3 py-2 text-sm font-semibold text-(--brand-primary)"
                : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)"
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab range={range} appId={appId} />}
      {tab === "events" && <EventsTab range={range} appId={appId} />}
      {tab === "funnel" && (
        <FunnelTab
          range={range}
          appId={appId}
          steps={funnelSteps}
          onStepsChange={setFunnelSteps}
        />
      )}
      {tab === "api" && <ApiHealthTab range={range} appId={appId} />}
      {tab === "errors" && <ErrorsTab range={range} appId={appId} />}
    </div>
  );
}

function OverviewTab({
  range,
  appId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
}) {
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
    <div className="space-y-4">
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

function EventsTab({
  range,
  appId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
}) {
  const top = useQuery({
    queryKey: ["telemetry", "top-events", range, appId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryTopEvents(range, appId),
  });
  if (top.isLoading) return <LoadingBlock />;
  if (top.error)
    return <ErrorBlock title="加载事件失败" message={String(top.error)} />;
  if (!top.data) return null;
  return <TelemetryTopEventsTable data={top.data} />;
}

function FunnelTab({
  range,
  appId,
  steps,
  onStepsChange,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  steps: string;
  onStepsChange: (s: string) => void;
}) {
  const funnel = useQuery({
    queryKey: ["telemetry", "funnel", steps, range, appId ?? "all"],
    queryFn: () =>
      cloudAdminApi.getTelemetryFunnel({ steps, range, appId }),
    enabled: steps.trim().length > 0,
  });
  return (
    <div className="space-y-4">
      <TelemetryFunnelEditor initialSteps={steps} onApply={onStepsChange} />
      {funnel.isLoading ? (
        <LoadingBlock />
      ) : funnel.error ? (
        <ErrorBlock title="加载漏斗失败" message={String(funnel.error)} />
      ) : funnel.data ? (
        <TelemetryFunnelChart data={funnel.data} />
      ) : null}
    </div>
  );
}

function ApiHealthTab({
  range,
  appId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
}) {
  const apiHealth = useQuery({
    queryKey: ["telemetry", "api-health", range, appId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryApiHealth(range, appId),
  });
  if (apiHealth.isLoading) return <LoadingBlock />;
  if (apiHealth.error)
    return <ErrorBlock title="加载 API 健康度失败" message={String(apiHealth.error)} />;
  if (!apiHealth.data) return null;
  return <TelemetryApiHealthTable data={apiHealth.data} />;
}

function ErrorsTab({
  range,
  appId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
}) {
  const errors = useQuery({
    queryKey: ["telemetry", "errors", range, appId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryErrors(range, appId),
  });
  if (errors.isLoading) return <LoadingBlock />;
  if (errors.error)
    return <ErrorBlock title="加载错误列表失败" message={String(errors.error)} />;
  if (!errors.data) return null;
  return <TelemetryErrorsList data={errors.data} />;
}
