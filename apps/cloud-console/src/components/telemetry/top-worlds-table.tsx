import { Link } from "@tanstack/react-router";
import type { TelemetryTopWorldsResponse } from "@yinjie/contracts";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";

export function TelemetryTopWorldsTable({
  data,
}: {
  data: TelemetryTopWorldsResponse;
}) {
  const t = useCloudConsoleText();
  if (data.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-8 text-center text-sm text-(--text-muted)">
        {t("No world activity in the current range.")}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-card)">
      <div className="border-b border-(--border-faint) px-4 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
        {t("Top worlds by activity")}
      </div>
      <table className="min-w-full divide-y divide-(--border-faint) text-sm">
        <thead className="bg-(--surface-soft)">
          <tr>
            <Th>{t("World")}</Th>
            <Th align="right">{t("Events")}</Th>
            <Th align="right">{t("Active users")}</Th>
            <Th align="right">{t("Errors")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border-faint)">
          {data.rows.map((row) => (
            <tr
              key={row.worldId}
              className="transition hover:bg-(--surface-soft)"
            >
              <Td className="font-medium text-(--text-primary)">
                <Link
                  to="/worlds/$worldId"
                  params={{ worldId: row.worldId }}
                  className="block hover:text-(--brand-primary)"
                >
                  <div>{row.worldName ?? row.worldId.slice(0, 8)}</div>
                  <div className="font-mono text-[11px] text-(--text-muted)">
                    {row.worldId}
                  </div>
                </Link>
              </Td>
              <Td align="right" className="font-semibold text-(--text-primary)">
                {row.eventCount.toLocaleString()}
              </Td>
              <Td align="right">{row.uniqueUsers.toLocaleString()}</Td>
              <Td align="right">
                <span
                  className={
                    row.errorCount > 0
                      ? "font-semibold text-rose-600"
                      : "text-(--text-secondary)"
                  }
                >
                  {row.errorCount.toLocaleString()}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
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
