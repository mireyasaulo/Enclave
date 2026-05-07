import { useState } from "react";
import type { TelemetryErrorsResponse } from "@yinjie/contracts";

export function TelemetryErrorsList({ data }: { data: TelemetryErrorsResponse }) {
  if (data.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-8 text-center text-sm text-(--text-muted)">
        当前范围内无错误事件。
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {data.rows.map((row) => (
        <ErrorRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

function ErrorRow({ row }: { row: TelemetryErrorsResponse["rows"][number] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
            {row.eventName}
          </span>
          <span className="text-xs text-(--text-muted)">{row.appId}</span>
          {row.pagePath && (
            <span className="font-mono text-xs text-(--text-secondary)">{row.pagePath}</span>
          )}
        </div>
        <span className="text-xs text-(--text-muted)">{formatTime(row.occurredAt)}</span>
      </div>
      {row.message && (
        <div className="mt-2 text-sm text-(--text-primary)">{row.message}</div>
      )}
      {row.stack && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-semibold text-(--brand-primary) hover:underline"
        >
          {expanded ? "收起堆栈" : "展开堆栈"}
        </button>
      )}
      {expanded && row.stack && (
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-(--surface-soft) p-3 text-[11px] leading-relaxed text-(--text-secondary)">
          {row.stack}
        </pre>
      )}
      {row.userAgent && (
        <div className="mt-1 truncate text-[11px] text-(--text-muted)">UA: {row.userAgent}</div>
      )}
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
