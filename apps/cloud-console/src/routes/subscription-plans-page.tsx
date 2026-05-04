import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ErrorBlock, InlineNotice, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../lib/cloud-admin-api";

export function SubscriptionPlansPage() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({
    queryKey: ["cloud-console", "subscription-plans"],
    queryFn: () => cloudAdminApi.listSubscriptionPlans(),
  });
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draft, setDraft] = useState({
    id: "",
    code: "",
    name: "",
    durationDays: "30",
    priceCents: "4990",
    currency: "cny",
    isActive: true,
    isTrial: false,
    isPubliclyPurchasable: true,
    sortOrder: "0",
    description: "",
  });

  useEffect(() => {
    if (!plansQuery.data?.length) {
      return;
    }
    const activePlan =
      plansQuery.data.find((plan) => plan.id === selectedPlanId) ??
      plansQuery.data[0];
    setSelectedPlanId(activePlan.id);
    setDraft({
      id: activePlan.id,
      code: activePlan.code,
      name: activePlan.name,
      durationDays: String(activePlan.durationDays),
      priceCents: String(activePlan.priceCents),
      currency: activePlan.currency,
      isActive: activePlan.isActive,
      isTrial: activePlan.isTrial,
      isPubliclyPurchasable: activePlan.isPubliclyPurchasable,
      sortOrder: String(activePlan.sortOrder),
      description: activePlan.description || "",
    });
  }, [plansQuery.data, selectedPlanId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      cloudAdminApi.upsertSubscriptionPlan({
        id: draft.id || undefined,
        code: draft.code,
        name: draft.name,
        durationDays: Number(draft.durationDays),
        priceCents: Number(draft.priceCents),
        currency: draft.currency,
        isActive: draft.isActive,
        isTrial: draft.isTrial,
        isPubliclyPurchasable: draft.isPubliclyPurchasable,
        sortOrder: Number(draft.sortOrder),
        description: draft.description || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "subscription-plans"],
      });
    },
  });

  if (plansQuery.isLoading) {
    return <LoadingBlock label="Loading subscription plans..." />;
  }

  if (plansQuery.isError) {
    return (
      <ErrorBlock
        message={
          plansQuery.error instanceof Error
            ? plansQuery.error.message
            : "Failed to load subscription plans."
        }
      />
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
        <div className="text-sm font-semibold text-[color:var(--text-primary)]">
          Plans
        </div>
        <div className="mt-3 space-y-3">
          {plansQuery.data?.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={`w-full rounded-[20px] border px-4 py-3 text-left ${
                selectedPlanId === plan.id
                  ? "border-[color:var(--border-brand)] bg-[color:var(--brand-soft)]"
                  : "border-[color:var(--border-faint)] bg-[#fafafa]"
              }`}
            >
              <div className="font-medium text-[color:var(--text-primary)]">
                {plan.name}
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                {plan.code} | {plan.durationDays} days | {plan.priceCents}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={draft.code}
            onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
            placeholder="code"
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
          />
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="name"
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
          />
          <input
            value={draft.durationDays}
            onChange={(event) => setDraft((current) => ({ ...current, durationDays: event.target.value }))}
            placeholder="durationDays"
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
          />
          <input
            value={draft.priceCents}
            onChange={(event) => setDraft((current) => ({ ...current, priceCents: event.target.value }))}
            placeholder="priceCents"
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
          />
          <input
            value={draft.currency}
            onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}
            placeholder="currency"
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
          />
          <input
            value={draft.sortOrder}
            onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))}
            placeholder="sortOrder"
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder="description"
          className="mt-3 min-h-28 w-full rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
            />
            active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isTrial}
              onChange={(event) => setDraft((current) => ({ ...current, isTrial: event.target.checked }))}
            />
            trial
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isPubliclyPurchasable}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isPubliclyPurchasable: event.target.checked,
                }))
              }
            />
            purchasable
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <Button
            variant="primary"
            className="rounded-2xl bg-[color:var(--brand-primary)] text-white"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save plan
          </Button>
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() =>
              setDraft({
                id: "",
                code: "",
                name: "",
                durationDays: "30",
                priceCents: "0",
                currency: "cny",
                isActive: true,
                isTrial: false,
                isPubliclyPurchasable: true,
                sortOrder: "0",
                description: "",
              })
            }
          >
            New plan
          </Button>
        </div>
        {saveMutation.isSuccess ? (
          <InlineNotice className="mt-4" tone="success">
            Subscription plan saved.
          </InlineNotice>
        ) : null}
      </div>
    </section>
  );
}
