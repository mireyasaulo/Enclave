import { useMemo, useState } from "react";
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
import { TelemetryTopWorldsTable } from "../components/telemetry/top-worlds-table";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

type TabKey = "overview" | "events" | "funnel" | "api" | "errors";

export function TelemetryPage() {
  const t = useCloudConsoleText();
  const [tab, setTab] = useState<TabKey>("overview");
  const [range, setRange] = useState<TelemetryRange>("7d");
  const [appId, setAppId] = useState<TelemetryAppId | undefined>(undefined);
  const [worldId, setWorldId] = useState<string | undefined>(undefined);
  const [funnelSteps, setFunnelSteps] = useState(
    "page_view,login_success,pay_checkout_success",
  );

  // 拉一份当前 range 内有事件的世界列表，给 range-picker 的下拉填选项；
  // overview tab 顶部的 Top 世界排行也复用同一份数据来源（但走 top-worlds 接口）。
  const worldsForFilter = useQuery({
    queryKey: ["telemetry", "worlds-filter", range],
    queryFn: () => cloudAdminApi.listTelemetryWorlds(range),
  });

  const tabs = useMemo<Array<{ key: TabKey; label: string }>>(
    () => [
      { key: "overview", label: t("Overview") },
      { key: "events", label: t("Events") },
      { key: "funnel", label: t("Funnel") },
      { key: "api", label: t("API health") },
      { key: "errors", label: t("Errors") },
    ],
    [t],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">{t("Telemetry")}</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {t("Client telemetry, PV/UV, API health and frontend errors.")}
          </p>
        </div>
        <TelemetryRangePicker
          range={range}
          appId={appId}
          worldId={worldId}
          onRangeChange={setRange}
          onAppIdChange={setAppId}
          onWorldIdChange={setWorldId}
          worldOptions={worldsForFilter.data ?? []}
        />
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-(--border-faint)">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? "border-b-2 border-(--brand-primary) px-3 py-2 text-sm font-semibold text-(--brand-primary)"
                : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-(--text-secondary) hover:text-(--text-primary)"
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewTab range={range} appId={appId} worldId={worldId} />
      )}
      {tab === "events" && (
        <EventsTab range={range} appId={appId} worldId={worldId} />
      )}
      {tab === "funnel" && (
        <FunnelTab
          range={range}
          appId={appId}
          worldId={worldId}
          steps={funnelSteps}
          onStepsChange={setFunnelSteps}
        />
      )}
      {tab === "api" && (
        <ApiHealthTab range={range} appId={appId} worldId={worldId} />
      )}
      {tab === "errors" && (
        <ErrorsTab range={range} appId={appId} worldId={worldId} />
      )}
    </div>
  );
}

function OverviewTab({
  range,
  appId,
  worldId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  worldId: string | undefined;
}) {
  const t = useCloudConsoleText();
  const overview = useQuery({
    queryKey: ["telemetry", "overview", range, appId ?? "all", worldId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryOverview(range, appId, worldId),
  });
  const pvSeries = useQuery({
    queryKey: [
      "telemetry",
      "timeseries",
      "page_view",
      range,
      appId ?? "all",
      worldId ?? "all",
    ],
    queryFn: () =>
      cloudAdminApi.getTelemetryTimeseries({
        eventName: "page_view",
        range,
        groupBy: "appId",
        appId,
        worldId,
      }),
  });
  // Top 世界排行在 worldId 未选时才显示——选了具体世界就只剩它一行没意义。
  const topWorlds = useQuery({
    queryKey: ["telemetry", "top-worlds", range],
    queryFn: () => cloudAdminApi.getTelemetryTopWorlds(range),
    enabled: !worldId,
  });

  return (
    <div className="space-y-4">
      {overview.isLoading ? (
        <LoadingBlock />
      ) : overview.error ? (
        <ErrorBlock title={t("Failed to load overview")} message={String(overview.error)} />
      ) : overview.data ? (
        <TelemetryOverviewCards data={overview.data} />
      ) : null}
      {!worldId ? (
        topWorlds.isLoading ? (
          <LoadingBlock />
        ) : topWorlds.error ? (
          <ErrorBlock
            title={t("Failed to load world ranking")}
            message={String(topWorlds.error)}
          />
        ) : topWorlds.data ? (
          <TelemetryTopWorldsTable data={topWorlds.data} />
        ) : null
      ) : null}
      {pvSeries.isLoading ? (
        <LoadingBlock />
      ) : pvSeries.error ? (
        <ErrorBlock title={t("Failed to load line chart")} message={String(pvSeries.error)} />
      ) : pvSeries.data ? (
        <TelemetryLineChart
          title={t("Page views (by app)")}
          points={pvSeries.data.points}
        />
      ) : null}
    </div>
  );
}

function EventsTab({
  range,
  appId,
  worldId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  worldId: string | undefined;
}) {
  const t = useCloudConsoleText();
  const top = useQuery({
    queryKey: ["telemetry", "top-events", range, appId ?? "all", worldId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryTopEvents(range, appId, worldId),
  });
  if (top.isLoading) return <LoadingBlock />;
  if (top.error)
    return <ErrorBlock title={t("Failed to load events")} message={String(top.error)} />;
  if (!top.data) return null;
  return <TelemetryTopEventsTable data={top.data} />;
}

function FunnelTab({
  range,
  appId,
  worldId,
  steps,
  onStepsChange,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  worldId: string | undefined;
  steps: string;
  onStepsChange: (s: string) => void;
}) {
  const t = useCloudConsoleText();
  const funnel = useQuery({
    queryKey: ["telemetry", "funnel", steps, range, appId ?? "all", worldId ?? "all"],
    queryFn: () =>
      cloudAdminApi.getTelemetryFunnel({ steps, range, appId, worldId }),
    enabled: steps.trim().length > 0,
  });
  return (
    <div className="space-y-4">
      <TelemetryFunnelEditor initialSteps={steps} onApply={onStepsChange} />
      {funnel.isLoading ? (
        <LoadingBlock />
      ) : funnel.error ? (
        <ErrorBlock title={t("Failed to load funnel")} message={String(funnel.error)} />
      ) : funnel.data ? (
        <TelemetryFunnelChart data={funnel.data} />
      ) : null}
    </div>
  );
}

function ApiHealthTab({
  range,
  appId,
  worldId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  worldId: string | undefined;
}) {
  const t = useCloudConsoleText();
  const apiHealth = useQuery({
    queryKey: ["telemetry", "api-health", range, appId ?? "all", worldId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryApiHealth(range, appId, worldId),
  });
  if (apiHealth.isLoading) return <LoadingBlock />;
  if (apiHealth.error)
    return <ErrorBlock title={t("Failed to load API health")} message={String(apiHealth.error)} />;
  if (!apiHealth.data) return null;
  return <TelemetryApiHealthTable data={apiHealth.data} />;
}

function ErrorsTab({
  range,
  appId,
  worldId,
}: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  worldId: string | undefined;
}) {
  const t = useCloudConsoleText();
  const errors = useQuery({
    queryKey: ["telemetry", "errors", range, appId ?? "all", worldId ?? "all"],
    queryFn: () => cloudAdminApi.getTelemetryErrors(range, appId, worldId),
  });
  if (errors.isLoading) return <LoadingBlock />;
  if (errors.error)
    return <ErrorBlock title={t("Failed to load error list")} message={String(errors.error)} />;
  if (!errors.data) return null;
  return <TelemetryErrorsList data={errors.data} />;
}
