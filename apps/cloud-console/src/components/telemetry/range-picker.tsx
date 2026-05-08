import type { TelemetryAppId, TelemetryRange } from "@yinjie/contracts";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";

export interface TelemetryWorldOption {
  worldId: string;
  worldName: string | null;
}

export function TelemetryRangePicker(props: {
  range: TelemetryRange;
  appId: TelemetryAppId | undefined;
  worldId?: string | undefined;
  onRangeChange: (range: TelemetryRange) => void;
  onAppIdChange: (appId: TelemetryAppId | undefined) => void;
  onWorldIdChange?: (worldId: string | undefined) => void;
  worldOptions?: TelemetryWorldOption[];
}) {
  const t = useCloudConsoleText();
  const ranges: Array<{ value: TelemetryRange; label: string }> = [
    { value: "24h", label: t("24 hours") },
    { value: "7d", label: t("7 days") },
    { value: "30d", label: t("30 days") },
  ];
  const appIds: Array<{ value: TelemetryAppId | ""; label: string }> = [
    { value: "", label: t("All apps") },
    { value: "app", label: t("App") },
    { value: "site", label: t("Site") },
    { value: "wiki", label: t("Wiki") },
  ];
  const showWorldSelect = Boolean(props.onWorldIdChange);
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
      {showWorldSelect ? (
        <select
          value={props.worldId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            props.onWorldIdChange?.(v === "" ? undefined : v);
          }}
          className="rounded-lg border border-(--border-subtle) bg-(--surface-card) px-3 py-1.5 text-xs text-(--text-primary)"
        >
          <option value="">{t("All worlds")}</option>
          {(props.worldOptions ?? []).map((opt) => (
            <option key={opt.worldId} value={opt.worldId}>
              {opt.worldName ?? opt.worldId.slice(0, 8)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
