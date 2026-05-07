import type { TelemetryAppId, TelemetryRange } from "@yinjie/contracts";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";

export function TelemetryRangePicker(props: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  onRangeChange: (range: TelemetryRange) => void;
  onAppIdChange: (appId: TelemetryAppId | undefined) => void;
}) {
  const t = useCloudConsoleText();
  const ranges: Array<{ value: TelemetryRange; label: string }> = [
    { value: "24h", label: t("24 hours") },
    { value: "7d", label: t("7 days") },
    { value: "30d", label: t("30 days") },
  ];
  const appIds: Array<{ value: TelemetryAppId | ""; label: string }> = [
    { value: "", label: t("All apps") },
    { value: "app", label: "App" },
    { value: "site", label: "Site" },
    { value: "wiki", label: "Wiki" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex overflow-hidden rounded-lg border border-(--border-subtle) bg-(--surface-card)">
        {ranges.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => props.onRangeChange(opt.value)}
            className={
              props.range === opt.value
                ? "bg-(--brand-primary) px-3 py-1.5 text-xs font-semibold text-white"
                : "px-3 py-1.5 text-xs font-medium text-(--text-secondary) hover:bg-(--surface-soft)"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      <select
        value={props.appId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          props.onAppIdChange(v === "" ? undefined : (v as TelemetryAppId));
        }}
        className="rounded-lg border border-(--border-subtle) bg-(--surface-card) px-3 py-1.5 text-xs text-(--text-primary)"
      >
        {appIds.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
