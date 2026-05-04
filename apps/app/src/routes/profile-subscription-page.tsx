import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  createCheckout,
  getMyCloudInviteSummary,
  getMyCloudProfile,
  getMyCloudSubscription,
} from "@yinjie/contracts";
import {
  AppPage,
  AppSection,
  Button,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
} from "@yinjie/ui";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { clearCloudRuntimeSession } from "../lib/cloud-session";
import { describeRequestError } from "../lib/request-error";
import { useCloudSessionStore } from "../store/cloud-session-store";

function formatPrice(priceCents: number, currency: string) {
  const amount = (priceCents / 100).toFixed(1);
  return `${currency.toUpperCase()} ${amount}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

export function ProfileSubscriptionPage() {
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const accessToken = useCloudSessionStore((state) => state.accessToken);
  const phone = useCloudSessionStore((state) => state.phone);
  const setProfile = useCloudSessionStore((state) => state.setProfile);
  const [checkoutNotice, setCheckoutNotice] = useState("");

  useEffect(() => {
    if (accessToken) {
      return;
    }

    clearCloudRuntimeSession();
    void navigate({ to: "/welcome", replace: true });
  }, [accessToken, navigate]);

  const profileQuery = useQuery({
    queryKey: ["cloud-profile", accessToken],
    queryFn: () => getMyCloudProfile(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const subscriptionQuery = useQuery({
    queryKey: ["cloud-subscription", accessToken],
    queryFn: () => getMyCloudSubscription(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const inviteQuery = useQuery({
    queryKey: ["cloud-invite-summary", accessToken],
    queryFn: () => getMyCloudInviteSummary(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setProfile(profileQuery.data);
    }
  }, [profileQuery.data, setProfile]);

  const checkoutMutation = useMutation({
    mutationFn: (planCode: string) => createCheckout({ planCode }, accessToken ?? ""),
    onSuccess: (result) => {
      setCheckoutNotice(
        [result.hint, result.contact].filter(Boolean).join(" "),
      );
    },
  });

  const purchasePlans = useMemo(
    () =>
      (subscriptionQuery.data?.plans ?? []).filter(
        (plan) => plan.isPubliclyPurchasable && plan.isActive,
      ),
    [subscriptionQuery.data?.plans],
  );

  const loading =
    profileQuery.isLoading ||
    subscriptionQuery.isLoading ||
    inviteQuery.isLoading;
  const error =
    profileQuery.error ?? subscriptionQuery.error ?? inviteQuery.error ?? null;

  if (!accessToken) {
    return null;
  }

  if (loading) {
    return (
      <AppPage className="px-4 py-6">
        <AppSection className="mx-auto max-w-3xl">
          <LoadingBlock label="Loading membership information..." />
        </AppSection>
      </AppPage>
    );
  }

  if (error) {
    return (
      <AppPage className="px-4 py-6">
        <AppSection className="mx-auto max-w-3xl">
          <ErrorBlock message={describeRequestError(error)} />
        </AppSection>
      </AppPage>
    );
  }

  const profile = profileQuery.data;
  const subscription = subscriptionQuery.data;
  const invite = inviteQuery.data;

  if (!profile || !subscription || !invite) {
    return null;
  }

  return (
    <AppPage className="bg-[color:var(--bg-canvas)] px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <AppSection className="overflow-hidden rounded-[28px] border-black/5 bg-[linear-gradient(135deg,#f7fff8,#ffffff)] px-6 py-6 shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                Subscription
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-[color:var(--text-primary)]">
                Membership Center
              </h1>
              <p className="mt-2 text-sm leading-7 text-[color:var(--text-secondary)]">
                Phone: {profile.phone || phone || "-"}
                <br />
                Status: {subscription.status}
                <br />
                Current plan: {subscription.currentPlanName || "None"}
                <br />
                Expires at: {formatDateTime(subscription.expiresAt)}
              </p>
            </div>
            <Button
              variant="secondary"
              className="rounded-2xl border-[color:var(--border-faint)] bg-white shadow-none"
              onClick={() =>
                void navigate({
                  to: isDesktopLayout ? "/desktop/settings" : "/profile/settings",
                })
              }
            >
              Back
            </Button>
          </div>
          {subscription.copy.welcomePromoBanner ? (
            <InlineNotice className="mt-4" tone="success">
              {subscription.copy.welcomePromoBanner}
            </InlineNotice>
          ) : null}
          {checkoutNotice ? (
            <InlineNotice className="mt-4" tone="info">
              {checkoutNotice}
            </InlineNotice>
          ) : null}
        </AppSection>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <AppSection className="rounded-[28px] border-black/5 bg-white px-6 py-6 shadow-none">
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              Purchase plans
            </div>
            <div className="mt-4 space-y-3">
              {purchasePlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-[22px] border border-black/5 bg-[#fafafa] px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-base font-semibold text-[color:var(--text-primary)]">
                        {plan.name}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                        {plan.description || `${plan.durationDays} days`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-[color:var(--text-primary)]">
                        {formatPrice(plan.priceCents, plan.currency)}
                      </div>
                      <Button
                        variant="primary"
                        className="mt-3 rounded-2xl bg-[#07c160] text-white shadow-none hover:bg-[#06ad56]"
                        disabled={checkoutMutation.isPending}
                        onClick={() => checkoutMutation.mutate(plan.code)}
                      >
                        {checkoutMutation.isPending ? "Submitting..." : "Contact to activate"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {!purchasePlans.length ? (
                <InlineNotice tone="muted">
                  No public plans are enabled in cloud admin right now.
                </InlineNotice>
              ) : null}
            </div>
          </AppSection>

          <div className="space-y-4">
            <AppSection className="rounded-[28px] border-black/5 bg-white px-6 py-6 shadow-none">
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                Invite rewards
              </div>
              <div className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                Invite code: {invite.code || "Not available"}
                <br />
                Reward days per successful invite: {invite.rewardDays}
                <br />
                Successful invites: {invite.redeemCount}
                <br />
                Reward days granted: {invite.rewardDaysGranted}
              </div>
              {invite.shareUrl ? (
                <div className="mt-4 rounded-[18px] bg-[#f7f7f7] px-4 py-3 text-xs leading-6 text-[color:var(--text-secondary)]">
                  {invite.shareUrl}
                </div>
              ) : null}
            </AppSection>

            <AppSection className="rounded-[28px] border-black/5 bg-white px-6 py-6 shadow-none">
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                Recent invite history
              </div>
              <div className="mt-4 space-y-3">
                {invite.recentRedemptions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[18px] border border-black/5 bg-[#fafafa] px-4 py-3 text-sm text-[color:var(--text-secondary)]"
                  >
                    <div className="font-medium text-[color:var(--text-primary)]">
                      {item.inviteePhoneMasked}
                    </div>
                    <div className="mt-1">Status: {item.status}</div>
                    <div>Created at: {formatDateTime(item.createdAt)}</div>
                    {item.rejectReason ? <div>Reason: {item.rejectReason}</div> : null}
                  </div>
                ))}
                {!invite.recentRedemptions.length ? (
                  <InlineNotice tone="muted">
                    No invite rewards have been recorded yet.
                  </InlineNotice>
                ) : null}
              </div>
            </AppSection>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
