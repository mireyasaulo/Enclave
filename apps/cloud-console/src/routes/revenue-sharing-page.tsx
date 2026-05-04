import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RevenuePayeeExternalRefType,
  RevenuePayeeStatus,
  RevenueSharingPolicyConfig,
  UpdateRevenueSharingPolicyRequest,
  UpsertRevenuePayeeRequest,
} from "@yinjie/contracts";
import {
  CloudAdminErrorBlock,
  showCloudAdminErrorNotice,
} from "../components/cloud-admin-error-block";
import { useConsoleNotice } from "../components/console-notice";
import { cloudAdminApi } from "../lib/cloud-admin-api";

const SECTION =
  "rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]";
const FIELD =
  "w-full rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]";
const TEXTAREA =
  "min-h-[128px] w-full rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2 font-mono text-xs leading-5 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]";
const BUTTON =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--brand-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--brand-primary)] transition hover:border-[color:var(--border-strong)]";
const SECONDARY_BUTTON =
  "rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-primary)] px-4 py-2 text-sm font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]";

const PAYEE_REF_TYPES: RevenuePayeeExternalRefType[] = [
  "world_owner",
  "wiki_user",
  "character",
  "system",
  "provider",
  "runtime_operator",
];
const PAYEE_STATUSES: RevenuePayeeStatus[] = [
  "pending",
  "active",
  "paused",
  "archived",
];

function formatMoney(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonField<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} JSON is invalid.`);
  }
}

type PolicyDraft = {
  enabled: boolean;
  currency: string;
  eventPricesJson: string;
  fixedSharesJson: string;
  contributionPoolBasisPoints: number;
  contributionWeightsJson: string;
  contributionWindowDays: number;
  minimumSettlementCents: number;
};

function buildPolicyDraft(config: RevenueSharingPolicyConfig): PolicyDraft {
  return {
    enabled: config.enabled,
    currency: config.currency,
    eventPricesJson: stringifyJson(config.eventPrices),
    fixedSharesJson: stringifyJson(config.fixedShares),
    contributionPoolBasisPoints: config.contributionPoolBasisPoints,
    contributionWeightsJson: stringifyJson(config.contributionWeights),
    contributionWindowDays: config.contributionWindowDays,
    minimumSettlementCents: config.minimumSettlementCents,
  };
}

function buildPolicyPayload(draft: PolicyDraft): UpdateRevenueSharingPolicyRequest {
  return {
    enabled: draft.enabled,
    currency: draft.currency,
    eventPrices: parseJsonField(
      draft.eventPricesJson,
      "Event prices",
    ) as UpdateRevenueSharingPolicyRequest["eventPrices"],
    fixedShares: parseJsonField(
      draft.fixedSharesJson,
      "Fixed shares",
    ) as UpdateRevenueSharingPolicyRequest["fixedShares"],
    contributionPoolBasisPoints: draft.contributionPoolBasisPoints,
    contributionWeights: parseJsonField(
      draft.contributionWeightsJson,
      "Contribution weights",
    ) as UpdateRevenueSharingPolicyRequest["contributionWeights"],
    contributionWindowDays: draft.contributionWindowDays,
    minimumSettlementCents: draft.minimumSettlementCents,
  };
}

export function RevenueSharingPage() {
  const queryClient = useQueryClient();
  const { showNotice } = useConsoleNotice();
  const policyQuery = useQuery({
    queryKey: ["cloud-console", "revenue-sharing", "policy"],
    queryFn: () => cloudAdminApi.getRevenueSharingPolicy(),
  });
  const payeesQuery = useQuery({
    queryKey: ["cloud-console", "revenue-sharing", "payees"],
    queryFn: () => cloudAdminApi.listRevenuePayees(),
  });
  const eventsQuery = useQuery({
    queryKey: ["cloud-console", "revenue-sharing", "events"],
    queryFn: () => cloudAdminApi.listRevenueEvents(),
    refetchInterval: 20_000,
  });
  const ledgerQuery = useQuery({
    queryKey: ["cloud-console", "revenue-sharing", "ledger"],
    queryFn: () => cloudAdminApi.listRevenueLedger({ pageSize: 20 }),
    refetchInterval: 20_000,
  });
  const settlementPreviewQuery = useQuery({
    queryKey: ["cloud-console", "revenue-sharing", "settlement-preview"],
    queryFn: () => cloudAdminApi.previewRevenueSettlement(),
    enabled: Boolean(policyQuery.data),
  });
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft | null>(null);
  const [payeeDraft, setPayeeDraft] = useState<UpsertRevenuePayeeRequest>({
    displayName: "",
    status: "active",
    externalRefType: "wiki_user",
    externalRefId: "",
    contact: "",
    payoutNote: "",
  });

  useEffect(() => {
    if (policyQuery.data) {
      setPolicyDraft(buildPolicyDraft(policyQuery.data.config));
    }
  }, [policyQuery.data]);

  const updatePolicyMutation = useMutation({
    mutationFn: () => {
      if (!policyDraft) throw new Error("Policy is not loaded.");
      return cloudAdminApi.updateRevenueSharingPolicy(buildPolicyPayload(policyDraft));
    },
    onSuccess: () => {
      showNotice("Revenue policy saved.", "success");
      void queryClient.invalidateQueries({
        queryKey: ["cloud-console", "revenue-sharing"],
      });
    },
    onError: (error) => showCloudAdminErrorNotice(showNotice, error),
  });

  const upsertPayeeMutation = useMutation({
    mutationFn: () => cloudAdminApi.upsertRevenuePayee(payeeDraft),
    onSuccess: () => {
      showNotice("Payee saved.", "success");
      setPayeeDraft({
        displayName: "",
        status: "active",
        externalRefType: "wiki_user",
        externalRefId: "",
        contact: "",
        payoutNote: "",
      });
      void queryClient.invalidateQueries({
        queryKey: ["cloud-console", "revenue-sharing", "payees"],
      });
    },
    onError: (error) => showCloudAdminErrorNotice(showNotice, error),
  });

  const generateSettlementMutation = useMutation({
    mutationFn: () => cloudAdminApi.generateRevenueSettlement(),
    onSuccess: (batch) => {
      showNotice(
        `Settlement ${batch.id} generated for ${formatMoney(batch.totalAmountCents, batch.currency)}.`,
        "success",
      );
      void queryClient.invalidateQueries({
        queryKey: ["cloud-console", "revenue-sharing"],
      });
    },
    onError: (error) => showCloudAdminErrorNotice(showNotice, error),
  });

  const policyCards = useMemo(() => {
    const policy = policyQuery.data;
    const ledger = ledgerQuery.data;
    return [
      {
        label: "Policy",
        value: policy?.status === "active" ? "Active" : "Inactive",
      },
      {
        label: "Version",
        value: policy ? `v${policy.version}` : "Not loaded",
      },
      {
        label: "Payable",
        value: ledger
          ? formatMoney(
              ledger.summary.totalPayableCents,
              ledger.summary.currency,
            )
          : "Not loaded",
      },
      {
        label: "Held",
        value: ledger
          ? formatMoney(ledger.summary.totalHeldCents, ledger.summary.currency)
          : "Not loaded",
      },
    ];
  }, [ledgerQuery.data, policyQuery.data]);

  const pageError =
    policyQuery.error ??
    payeesQuery.error ??
    eventsQuery.error ??
    ledgerQuery.error ??
    settlementPreviewQuery.error;

  return (
    <div className="space-y-6">
      {pageError ? <CloudAdminErrorBlock error={pageError} /> : null}

      <section className={SECTION}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {policyCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-primary)] p-4"
            >
              <div className="text-xs text-[color:var(--text-muted)]">
                {card.label}
              </div>
              <div className="mt-2 break-words text-xl font-semibold text-[color:var(--text-primary)]">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
              Revenue policy
            </h2>
            <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
              Active version {policyQuery.data?.version ?? 0}
            </div>
          </div>
          <button
            type="button"
            className={BUTTON}
            disabled={!policyDraft || updatePolicyMutation.isPending}
            onClick={() => updatePolicyMutation.mutate()}
          >
            Save policy
          </button>
        </div>

        {policyDraft ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Enabled
              </span>
              <select
                className={FIELD}
                value={policyDraft.enabled ? "true" : "false"}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    enabled: event.target.value === "true",
                  })
                }
              >
                <option value="false">Inactive</option>
                <option value="true">Active</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Currency
              </span>
              <input
                className={FIELD}
                value={policyDraft.currency}
                onChange={(event) =>
                  setPolicyDraft({ ...policyDraft, currency: event.target.value })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Contribution pool bps
              </span>
              <input
                type="number"
                min={0}
                max={10000}
                className={FIELD}
                value={policyDraft.contributionPoolBasisPoints}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    contributionPoolBasisPoints: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Contribution window days
              </span>
              <input
                type="number"
                min={1}
                className={FIELD}
                value={policyDraft.contributionWindowDays}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    contributionWindowDays: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Minimum settlement cents
              </span>
              <input
                type="number"
                min={0}
                className={FIELD}
                value={policyDraft.minimumSettlementCents}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    minimumSettlementCents: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="space-y-2 xl:col-span-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Event prices
              </span>
              <textarea
                className={TEXTAREA}
                value={policyDraft.eventPricesJson}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    eventPricesJson: event.target.value,
                  })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Fixed shares
              </span>
              <textarea
                className={TEXTAREA}
                value={policyDraft.fixedSharesJson}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    fixedSharesJson: event.target.value,
                  })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">
                Contribution weights
              </span>
              <textarea
                className={TEXTAREA}
                value={policyDraft.contributionWeightsJson}
                onChange={(event) =>
                  setPolicyDraft({
                    ...policyDraft,
                    contributionWeightsJson: event.target.value,
                  })
                }
              />
            </label>
          </div>
        ) : (
          <div className="mt-5 text-sm text-[color:var(--text-secondary)]">
            Loading policy.
          </div>
        )}
      </section>

      <section className={SECTION}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
              Payees
            </h2>
            <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
              {payeesQuery.data?.length ?? 0} payee profiles
            </div>
          </div>
          <button
            type="button"
            className={BUTTON}
            disabled={upsertPayeeMutation.isPending}
            onClick={() => upsertPayeeMutation.mutate()}
          >
            Save payee
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="space-y-3 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-primary)] p-4">
            <input
              className={FIELD}
              placeholder="Display name"
              value={payeeDraft.displayName}
              onChange={(event) =>
                setPayeeDraft({ ...payeeDraft, displayName: event.target.value })
              }
            />
            <select
              className={FIELD}
              value={payeeDraft.status}
              onChange={(event) =>
                setPayeeDraft({
                  ...payeeDraft,
                  status: event.target.value as RevenuePayeeStatus,
                })
              }
            >
              {PAYEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className={FIELD}
              value={payeeDraft.externalRefType}
              onChange={(event) =>
                setPayeeDraft({
                  ...payeeDraft,
                  externalRefType: event.target
                    .value as RevenuePayeeExternalRefType,
                })
              }
            >
              {PAYEE_REF_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              className={FIELD}
              placeholder="External ref id"
              value={payeeDraft.externalRefId}
              onChange={(event) =>
                setPayeeDraft({
                  ...payeeDraft,
                  externalRefId: event.target.value,
                })
              }
            />
            <input
              className={FIELD}
              placeholder="Contact"
              value={payeeDraft.contact ?? ""}
              onChange={(event) =>
                setPayeeDraft({ ...payeeDraft, contact: event.target.value })
              }
            />
            <textarea
              className={TEXTAREA}
              placeholder="Payout note"
              value={payeeDraft.payoutNote ?? ""}
              onChange={(event) =>
                setPayeeDraft({ ...payeeDraft, payoutNote: event.target.value })
              }
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-faint)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--surface-soft)] text-xs uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">External ref</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-faint)]">
                {(payeesQuery.data ?? []).map((payee) => (
                  <tr key={payee.id}>
                    <td className="px-4 py-3 font-medium">{payee.displayName}</td>
                    <td className="px-4 py-3">{payee.status}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {payee.externalRefType}:{payee.externalRefId}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(payee.updatedAt)}</td>
                  </tr>
                ))}
                {payeesQuery.data?.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[color:var(--text-muted)]" colSpan={4}>
                      No payees.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
              Ledger
            </h2>
            <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
              {ledgerQuery.data?.total ?? 0} allocations
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() =>
                void settlementPreviewQuery.refetch().then(() =>
                  showNotice("Settlement preview refreshed.", "info"),
                )
              }
            >
              Preview
            </button>
            <button
              type="button"
              className={BUTTON}
              disabled={generateSettlementMutation.isPending}
              onClick={() => generateSettlementMutation.mutate()}
            >
              Generate settlement
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-primary)] p-4">
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              Settlement preview
            </div>
            <div className="mt-3 text-2xl font-semibold">
              {settlementPreviewQuery.data
                ? formatMoney(
                    settlementPreviewQuery.data.totalAmountCents,
                    settlementPreviewQuery.data.currency,
                  )
                : "Not loaded"}
            </div>
            <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {settlementPreviewQuery.data?.allocationCount ?? 0} allocations
            </div>
            <div className="mt-4 space-y-2">
              {(settlementPreviewQuery.data?.payees ?? []).slice(0, 6).map((payee) => (
                <div
                  key={payee.payeeId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--surface-soft)] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{payee.payeeDisplayName}</span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(
                      payee.amountCents,
                      settlementPreviewQuery.data?.currency ?? "CNY",
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-faint)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--surface-soft)] text-xs uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Payee</th>
                  <th className="px-4 py-3 font-medium">Participant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-faint)]">
                {(ledgerQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      {item.payeeDisplayName ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">{item.participantType}</td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatMoney(item.amountCents, item.currency)}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
                {ledgerQuery.data?.items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[color:var(--text-muted)]" colSpan={5}>
                      No allocations.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          Events
        </h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-faint)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--surface-soft)] text-xs uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Usage type</th>
                  <th className="px-4 py-3 font-medium">Character</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Occurred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-faint)]">
                {(eventsQuery.data?.usageEvents ?? []).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">{event.eventType}</td>
                    <td className="px-4 py-3">{event.characterName ?? event.characterId}</td>
                    <td className="px-4 py-3">
                      {formatMoney(event.grossAmountCents, event.currency)}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(event.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-faint)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[color:var(--surface-soft)] text-xs uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Contribution type</th>
                  <th className="px-4 py-3 font-medium">Contributor</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Occurred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-faint)]">
                {(eventsQuery.data?.contributionEvents ?? []).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">{event.eventType}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {event.contributorExternalRefType}:{event.contributorExternalRefId}
                    </td>
                    <td className="px-4 py-3">
                      {event.reversedAt ? "reversed" : "active"}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(event.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
