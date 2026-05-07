import type { TelemetryOverviewResponse } from "@yinjie/contracts";

export function TelemetryOverviewCards({ data }: { data: TelemetryOverviewResponse }) {
  const cards = [
    { label: "页面浏览 PV", value: data.pvCount },
    { label: "独立访客 UV", value: data.uvCount },
    { label: "会话数", value: data.sessionCount },
    { label: "前端错误", value: data.errorCount, tone: "error" as const },
    {
      label: "平均会话时长",
      value: formatDuration(data.avgSessionDurationMs),
    },
  ];

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <li
          key={c.label}
          className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) px-4 py-4 shadow-sm"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-(--text-muted)">
            {c.label}
          </div>
          <div
            className={
              "tone" in c && c.tone === "error"
                ? "mt-1.5 text-2xl font-bold text-rose-600"
                : "mt-1.5 text-2xl font-bold text-(--text-primary)"
            }
          >
            {c.value}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return `${minutes}m${rem ? ` ${rem}s` : ""}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
