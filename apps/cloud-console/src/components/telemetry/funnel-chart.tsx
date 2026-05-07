import { useState } from "react";
import type { TelemetryFunnelResponse } from "@yinjie/contracts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#f97316", "#fb923c", "#fbbf24", "#34d399", "#10b981", "#0ea5e9", "#6366f1", "#a855f7"];

export function TelemetryFunnelEditor(props: {
  initialSteps?: string;
  onApply: (steps: string) => void;
}) {
  const [draft, setDraft] = useState(
    props.initialSteps ?? "page_view,login_success,pay_checkout_success",
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="逗号分隔的事件名（按顺序）"
        className="min-w-72 flex-1 rounded-lg border border-(--border-subtle) bg-(--surface-card) px-3 py-1.5 text-xs text-(--text-primary)"
      />
      <button
        type="button"
        onClick={() => props.onApply(draft)}
        className="rounded-lg bg-(--brand-primary) px-3 py-1.5 text-xs font-semibold text-white hover:bg-(--brand-secondary)"
      >
        应用漏斗
      </button>
    </div>
  );
}

export function TelemetryFunnelChart({ data }: { data: TelemetryFunnelResponse }) {
  if (data.steps.length === 0) {
    return (
      <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-8 text-center text-sm text-(--text-muted)">
        漏斗为空。请先输入步骤。
      </div>
    );
  }
  const chartData = data.steps.map((step, i) => ({
    name: step.eventName,
    count: step.count,
    conversionFromPrev: step.conversionFromPrev,
    conversionFromStart: step.conversionFromStart,
    color: PALETTE[i % PALETTE.length],
  }));
  return (
    <div className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-4 shadow-sm">
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={140} />
            <Tooltip
              formatter={(value: number, key) => {
                if (key === "count") return [value.toLocaleString(), "Count"];
                return [value, key];
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-(--text-secondary)">
        {data.steps.map((step, i) => (
          <li key={`${step.eventName}-${i}`} className="flex items-center justify-between">
            <span>
              <span className="font-medium text-(--text-primary)">{step.eventName}</span>{" "}
              · {step.count.toLocaleString()}
            </span>
            <span>
              {i > 0 ? `从上一步 ${(step.conversionFromPrev * 100).toFixed(1)}%` : "起点"}
              {" · "}
              整体 {(step.conversionFromStart * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
