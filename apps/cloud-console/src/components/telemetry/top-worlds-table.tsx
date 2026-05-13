import { Link } from "@tanstack/react-router";
import type {
  TelemetryTopWorldsResponse,
  TelemetryTopWorldsSortDir,
  TelemetryTopWorldsSortKey,
} from "@yinjie/contracts";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";
import { Pager } from "../pager";

export interface TopWorldsSortState {
  by: TelemetryTopWorldsSortKey;
  dir: TelemetryTopWorldsSortDir;
}

export function TelemetryTopWorldsTable({
  data,
  onPageChange,
  sort,
  onSortChange,
}: {
  data: TelemetryTopWorldsResponse;
  onPageChange?: (nextPage: number) => void;
  sort: TopWorldsSortState;
  onSortChange: (next: TopWorldsSortState) => void;
}) {
  const t = useCloudConsoleText();
  const { rows, total, page, pageSize } = data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-8 text-center text-sm text-(--text-muted)">
        {t("No world activity in the current range.")}
      </div>
    );
  }

  const handleSort = (key: TelemetryTopWorldsSortKey) => {
    if (sort.by === key) {
      onSortChange({ by: key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ by: key, dir: "desc" });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-card)">
      <table className="min-w-full divide-y divide-(--border-faint) text-sm">
        <thead className="bg-(--surface-soft)">
          <tr>
            <Th>{t("World")}</Th>
            <Th
              align="right"
              sortKey="eventCount"
              activeKey={sort.by}
              activeDir={sort.dir}
              onSort={handleSort}
            >
              {t("Events")}
            </Th>
            <Th
              align="right"
              sortKey="uniqueUsers"
              activeKey={sort.by}
              activeDir={sort.dir}
              onSort={handleSort}
            >
              {t("Active users")}
            </Th>
            <Th
              align="right"
              sortKey="errorCount"
              activeKey={sort.by}
              activeDir={sort.dir}
              onSort={handleSort}
            >
              {t("Errors")}
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border-faint)">
          {rows.map((row) => (
            <tr
              key={row.worldId}
              className="cursor-pointer transition hover:bg-(--surface-soft)"
            >
              <Td className="font-medium text-(--text-primary)">
                <Link
                  to="/worlds/$worldId"
                  params={{ worldId: row.worldId }}
                  className="block hover:text-(--brand-primary)"
                >
                  {row.ownerEmail ??
                    row.ownerPhone ??
                    row.worldName ??
                    row.worldId.slice(0, 8)}
                </Link>
              </Td>
              <Td align="right" className="font-semibold text-(--text-primary)">
                {row.eventCount.toLocaleString()}
              </Td>
              <Td align="right">{row.uniqueUsers.toLocaleString()}</Td>
              <Td
                align="right"
                className={
                  row.errorCount > 0
                    ? "bg-rose-50 font-semibold text-rose-600"
                    : "text-(--text-secondary)"
                }
              >
                {row.errorCount.toLocaleString()}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--border-faint) px-4 py-2 text-xs text-(--text-secondary)">
        <div>
          {t("{start}-{end} of {total}")
            .replace("{start}", String(rangeStart))
            .replace("{end}", String(rangeEnd))
            .replace("{total}", String(total))}
          {totalPages > 1 ? (
            <>
              {" · "}
              {t("Page {current} of {total}")
                .replace("{current}", String(page))
                .replace("{total}", String(totalPages))}
            </>
          ) : null}
        </div>
        {onPageChange ? (
          <Pager
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        ) : null}
      </div>
    </div>
  );
}

function Th({
  children,
  align,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: {
  children: React.ReactNode;
  align?: "right";
  sortKey?: TelemetryTopWorldsSortKey;
  activeKey?: TelemetryTopWorldsSortKey;
  activeDir?: TelemetryTopWorldsSortDir;
  onSort?: (key: TelemetryTopWorldsSortKey) => void;
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";
  if (!sortKey || !onSort) {
    return (
      <th
        scope="col"
        className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-(--text-muted) ${alignClass}`}
      >
        {children}
      </th>
    );
  }
  const isActive = activeKey === sortKey;
  const arrow = isActive ? (activeDir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${alignClass} ${isActive ? "text-(--text-primary)" : "text-(--text-muted)"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"} cursor-pointer rounded px-1 py-0.5 hover:bg-(--surface-card)/60 hover:text-(--text-primary)`}
      >
        <span>{children}</span>
        <span className="w-3 text-right">{arrow}</span>
      </button>
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
