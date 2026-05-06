import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  createCheckout,
  getMyCloudInviteSummary,
  getMyCloudProfile,
  getMyCloudSubscription,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
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
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

export function ProfileSubscriptionPage() {
  const t = useRuntimeTranslator();
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

  const [checkoutError, setCheckoutError] = useState("");
  const checkoutMutation = useMutation({
    mutationFn: (planCode: string) =>
      createCheckout({ planCode }, accessToken ?? ""),
    onSuccess: (result) => {
      setCheckoutError("");
      setCheckoutNotice(
        [result.hint, result.contact].filter(Boolean).join(" ") ||
          t(msg`已提交开通申请，请联系运营完成支付。`),
      );
    },
    onError: (error) => {
      setCheckoutNotice("");
      setCheckoutError(
        describeRequestError(error, t(msg`提交开通申请失败，请稍后重试。`)),
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

  function handleCloudLogout() {
    clearCloudRuntimeSession();
    void navigate({ to: "/welcome", replace: true });
  }

  if (!accessToken) {
    return null;
  }

  if (loading) {
    return (
      <AppPage className="px-4 py-6">
        <AppSection className="mx-auto max-w-3xl">
          <LoadingBlock label={t(msg`正在加载会员信息…`)} />
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

  const subscriptionStatusLabel =
    subscription.status === "active"
      ? t(msg`生效中`)
      : subscription.status === "expired"
        ? t(msg`已过期`)
        : t(msg`未开通`);
  const fallbackNotSet = t(msg`未设置`);
  const expiresLabel = formatDateTime(subscription.expiresAt) ?? fallbackNotSet;

  return (
    <AppPage className="bg-[color:var(--bg-canvas)] px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <AppSection className="overflow-hidden rounded-[28px] border-black/5 bg-[linear-gradient(135deg,#f7fff8,#ffffff)] px-6 py-6 shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                {t(msg`订阅`)}
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-[color:var(--text-primary)]">
                {t(msg`会员中心`)}
              </h1>
              <p className="mt-2 text-sm leading-7 text-[color:var(--text-secondary)]">
                {t(msg`手机号`)}: {profile.phone || phone || "-"}
                <br />
                {t(msg`状态`)}: {subscriptionStatusLabel}
                <br />
                {t(msg`当前套餐`)}:{" "}
                {subscription.currentPlanName || t(msg`无`)}
                <br />
                {t(msg`到期时间`)}: {expiresLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="rounded-2xl border-[color:var(--border-faint)] bg-white shadow-none"
                onClick={() =>
                  void navigate({
                    to: isDesktopLayout
                      ? "/desktop/settings"
                      : "/profile/settings",
                  })
                }
              >
                {t(msg`返回设置`)}
              </Button>
              <Button
                variant="secondary"
                className="rounded-2xl border-[rgba(220,38,38,0.14)] bg-white text-[#b42318] shadow-none hover:bg-[#fff5f5]"
                onClick={handleCloudLogout}
              >
                {t(msg`退出登录`)}
              </Button>
            </div>
          </div>
          {subscription.copy.welcomePromoBanner ? (
            <InlineNotice className="mt-4" tone="success">
              {subscription.copy.welcomePromoBanner}
            </InlineNotice>
          ) : null}
        </AppSection>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
          <AppSection className="rounded-[28px] border-black/5 bg-white px-6 py-6 shadow-none">
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              {t(msg`可购套餐`)}
            </div>
            {checkoutNotice ? (
              <InlineNotice className="mt-4" tone="info">
                {checkoutNotice}
              </InlineNotice>
            ) : null}
            {checkoutError ? (
              <InlineNotice className="mt-4" tone="danger">
                {checkoutError}
              </InlineNotice>
            ) : null}
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
                        {plan.description ||
                          t(msg`时长 ${plan.durationDays} 天`)}
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
                        {checkoutMutation.isPending
                          ? t(msg`提交中…`)
                          : t(msg`联系开通`)}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {!purchasePlans.length ? (
                <InlineNotice tone="muted">
                  {t(msg`云端管理后台暂未开放可购套餐。`)}
                </InlineNotice>
              ) : null}
            </div>
          </AppSection>

          <div className="space-y-4">
            <AppSection className="rounded-[28px] border-black/5 bg-white px-6 py-6 shadow-none">
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                {t(msg`邀请奖励`)}
              </div>
              <div className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                {t(msg`邀请码`)}: {invite.code || t(msg`暂无`)}
                <br />
                {t(msg`单次邀请奖励天数`)}: {invite.rewardDays}
                <br />
                {t(msg`成功邀请数`)}: {invite.redeemCount}
                <br />
                {t(msg`已发放奖励天数`)}: {invite.rewardDaysGranted}
              </div>
              {invite.shareUrl ? (
                <div className="mt-4 rounded-[18px] bg-[#f7f7f7] px-4 py-3 text-xs leading-6 text-[color:var(--text-secondary)]">
                  {invite.shareUrl}
                </div>
              ) : null}
            </AppSection>

            <AppSection className="rounded-[28px] border-black/5 bg-white px-6 py-6 shadow-none">
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                {t(msg`最近邀请记录`)}
              </div>
              <div className="mt-4 space-y-3">
                {invite.recentRedemptions.map((item) => {
                  const statusLabel =
                    item.status === "rewarded"
                      ? t(msg`已发放`)
                      : t(msg`已拒绝`);
                  return (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-black/5 bg-[#fafafa] px-4 py-3 text-sm text-[color:var(--text-secondary)]"
                    >
                      <div className="font-medium text-[color:var(--text-primary)]">
                        {item.inviteePhoneMasked}
                      </div>
                      <div className="mt-1">
                        {t(msg`状态`)}: {statusLabel}
                      </div>
                      <div>
                        {t(msg`创建时间`)}:{" "}
                        {formatDateTime(item.createdAt) ?? fallbackNotSet}
                      </div>
                      {item.rejectReason ? (
                        <div>
                          {t(msg`拒绝原因`)}: {item.rejectReason}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!invite.recentRedemptions.length ? (
                  <InlineNotice tone="muted">
                    {t(msg`暂无邀请记录。`)}
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
