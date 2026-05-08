import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type {
  TokenUsageBreakdownItem,
  TokenUsageBreakdownResponse,
} from "@yinjie/contracts";
import { CloudAdminErrorBlock } from "../components/cloud-admin-error-block";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

const SECTION =
  "rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]";
const BUTTON =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--brand-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--brand-primary)] transition hover:border-[color:var(--border-strong)]";
const SECONDARY_BUTTON =
  "rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-primary)] px-4 py-2 text-sm font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]";

type RangePreset = "7d" | "30d" | "90d";
type DimensionKey =
  | "byCharacter"
  | "byModel"
  | "byScene"
  | "byConversation"
  | "byBillingSource";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToRange(preset: RangePreset): { from: string; to: string } {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const today = new Date();
  const from = new Date(today.getTime() - (days - 1) * 86_400_000);
  return { from: isoDate(from), to: isoDate(today) };
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatCost(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

export function TokenUsageWorldDetailPage() {
  const t = useCloudConsoleText();
  const { worldId } = useParams({ from: "/token-usage/$worldId" });
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [dimension, setDimension] = useState<DimensionKey>("byCharacter");
  const range = useMemo(() => presetToRange(preset), [preset]);

  const breakdownQuery = useQuery({
    queryKey: [
      "token-usage",
      "world-breakdown",
      worldId,
      range.from,
      range.to,
    ],
    queryFn: () =>
      cloudAdminApi.getCloudTokenUsageWorldBreakdown(worldId, range),
  });

  const dailyQuery = useQuery({
    queryKey: ["token-usage", "world-daily", worldId, range.from, range.to],
    queryFn: () => cloudAdminApi.getCloudTokenUsageWorldDaily(worldId, range),
  });

  if (breakdownQuery.error) {
    return <CloudAdminErrorBlock error={breakdownQuery.error} />;
  }

  const breakdown = breakdownQuery.data;
  const items = breakdown
    ? pickDimension(breakdown, dimension)
    : [];

  const dailyTotals = (dailyQuery.data ?? []).reduce(
    (acc, row) => ({
      tokens: acc.tokens + row.totalTokens,
      cost: acc.cost + row.estimatedCost,
      requests: acc.requests + row.requestCount,
    }),
    { tokens: 0, cost: 0, requests: 0 },
  );
  const currency = breakdown?.currency ?? "CNY";

  return (
    <div className="space-y-6">
      <section className={SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/token-usage"
              className="text-xs text-[color:var(--text-muted)] hover:underline"
            >
              ← {t("Back to token usage")}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">
              {worldId}
            </h1>
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
              {t(
                "Drill into one world's LLM token consumption by character, model, scene, and conversation.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["7d", "30d", "90d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={preset === option ? BUTTON : SECONDARY_BUTTON}
                onClick={() => setPreset(option)}
              >
                {option === "7d"
                  ? t("Last 7 days")
                  : option === "30d"
                    ? t("Last 30 days")
                    : t("Last 90 days")}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={SECTION}>
        <div className="grid gap-3 sm:grid-cols-3">
          <SmallStat
            label={t("Total tokens")}
            value={formatNumber(dailyTotals.tokens)}
          />
          <SmallStat
            label={t("Estimated cost")}
            value={formatCost(dailyTotals.cost, currency)}
          />
          <SmallStat
            label={t("Request count")}
            value={formatNumber(dailyTotals.requests)}
          />
        </div>
      </section>

      <section className={SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t("Breakdown")}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "byCharacter", label: t("By character") },
                { key: "byModel", label: t("By model") },
                { key: "byScene", label: t("By scene") },
                { key: "byConversation", label: t("By conversation") },
                { key: "byBillingSource", label: t("By billing source") },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                className={
                  dimension === option.key ? BUTTON : SECONDARY_BUTTON
                }
                onClick={() => setDimension(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <BreakdownTable
          items={items}
          currency={currency}
          isLoading={breakdownQuery.isLoading}
        />
      </section>
    </div>
  );
}

function pickDimension(
  breakdown: TokenUsageBreakdownResponse,
  key: DimensionKey,
): TokenUsageBreakdownItem[] {
  switch (key) {
    case "byCharacter":
      return breakdown.byCharacter;
    case "byModel":
      return breakdown.byModel;
    case "byScene":
      return breakdown.byScene;
    case "byConversation":
      return breakdown.byConversation;
    case "byBillingSource":
      return breakdown.byBillingSource;
    default:
      return [];
  }
}

function BreakdownTable({
  items,
  currency,
  isLoading,
}: {
  items: TokenUsageBreakdownItem[];
  currency: string;
  isLoading: boolean;
}) {
  const t = useCloudConsoleText();
  const total = items.reduce((sum, item) => sum + item.totalTokens, 0);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--border-subtle)]">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--surface-input)] text-left text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
          <tr>
            <th className="px-4 py-2">{t("Label")}</th>
            <th className="px-4 py-2 text-right">{t("Total tokens")}</th>
            <th className="px-4 py-2 text-right">{t("Estimated cost")}</th>
            <th className="px-4 py-2 text-right">{t("Request count")}</th>
            <th className="px-4 py-2">{t("Share")}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                className="px-4 py-6 text-center text-[color:var(--text-muted)]"
                colSpan={5}
              >
                {t("Loading…")}
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td
                className="px-4 py-6 text-center text-[color:var(--text-muted)]"
                colSpan={5}
              >
                {t("No data for the selected range yet.")}
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const ratio = total > 0 ? item.totalTokens / total : 0;
              return (
                <tr
                  key={item.key}
                  className="border-t border-[color:var(--border-subtle)]"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-[color:var(--text-primary)]">
                      {item.label}
                    </div>
                    <div className="font-mono text-xs text-[color:var(--text-muted)]">
                      {item.key}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(item.totalTokens)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCost(item.estimatedCost, currency)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(item.requestCount)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="h-2 w-full rounded-full bg-[color:var(--surface-input)]">
                      <div
                        className="h-2 rounded-full bg-[color:var(--brand-primary)]"
                        style={{ width: `${(ratio * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {(ratio * 100).toFixed(1)}%
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-3">
      <div className="text-xs text-[color:var(--text-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
