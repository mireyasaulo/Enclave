import type { TelemetryTimeseriesPoint } from "@yinjie/contracts";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export function TelemetryLineChart(props: {
  title: string;
  points: TelemetryTimeseriesPoint[];
  height?: number;
}) {
  const groups = Array.from(new Set(props.points.map((p) => p.group))).sort();
  const dates = Array.from(new Set(props.points.map((p) => p.date))).sort();

  const data = dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const g of groups) {
      const point = props.points.find((p) => p.date === date && p.group === g);
      row[g] = point?.value ?? 0;
    }
    return row;
  });

  const colors = ["#f97316", "#0ea5e9", "#10b981", "#8b5cf6", "#ef4444"];

  return (
    <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-(--text-primary)">{props.title}</div>
      <div style={{ width: "100%", height: props.height ?? 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
            <Tooltip />
            {groups.length > 1 && <Legend />}
            {groups.map((g, i) => (
              <Line
                key={g}
                type="monotone"
                dataKey={g}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
