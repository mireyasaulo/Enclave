import type { TelemetryTopEventsResponse } from "@yinjie/contracts";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";

export function TelemetryTopEventsTable({ data }: { data: TelemetryTopEventsResponse }) {
  const t = useCloudConsoleText();
  if (data.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-8 text-center text-sm text-(--text-muted)">
        {t("No events in the current range.")}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-card)">
      <table className="min-w-full divide-y divide-(--border-faint) text-sm">
        <thead className="bg-(--surface-soft)">
          <tr>
            <Th>App</Th>
            <Th>Event</Th>
            <Th>Type</Th>
            <Th align="right">Count</Th>
            <Th align="right">Unique users</Th>
            <Th align="right">Unique anons</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border-faint)">
          {data.rows.map((row) => (
            <tr key={`${row.appId}:${row.eventName}:${row.eventType}`}>
              <Td><Pill>{row.appId}</Pill></Td>
              <Td className="font-medium text-(--text-primary)">{row.eventName}</Td>
              <Td><span className="text-xs text-(--text-muted)">{row.eventType}</span></Td>
              <Td align="right" className="font-semibold text-(--text-primary)">
                {row.count.toLocaleString()}
              </Td>
              <Td align="right">{row.uniqueUsers.toLocaleString()}</Td>
              <Td align="right">{row.uniqueAnons.toLocaleString()}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-muted) ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-(--border-subtle) bg-(--surface-soft) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
      {children}
    </span>
  );
}
