import type { TelemetryApiHealthResponse } from "@yinjie/contracts";

export function TelemetryApiHealthTable({ data }: { data: TelemetryApiHealthResponse }) {
  if (data.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-8 text-center text-sm text-(--text-muted)">
        当前范围内无 API 调用埋点。
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-card)">
      <table className="min-w-full divide-y divide-(--border-faint) text-sm">
        <thead className="bg-(--surface-soft)">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              Path
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              Calls
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              Success
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              p50
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              p95
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--border-faint)">
          {data.rows.map((row) => {
            const successPct = (row.successRate * 100).toFixed(1);
            const successTone =
              row.successRate >= 0.99
                ? "text-emerald-600"
                : row.successRate >= 0.95
                  ? "text-amber-600"
                  : "text-rose-600";
            return (
              <tr key={row.pagePath}>
                <td className="px-3 py-2 font-mono text-xs text-(--text-primary)">{row.pagePath}</td>
                <td className="px-3 py-2 text-right">{row.totalCalls.toLocaleString()}</td>
                <td className={`px-3 py-2 text-right font-semibold ${successTone}`}>{successPct}%</td>
                <td className="px-3 py-2 text-right">{row.p50Ms} ms</td>
                <td className="px-3 py-2 text-right">{row.p95Ms} ms</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
