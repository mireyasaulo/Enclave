import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { formatDateTime } from "@yinjie/i18n";
import { Button, ErrorBlock, InlineNotice, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

export function UserDetailPage() {
  const t = useCloudConsoleText();
  const { userId } = useParams({ strict: false }) as { userId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [grantDays, setGrantDays] = useState("30");
  const [banReason, setBanReason] = useState("manual-ban");

  const userQuery = useQuery({
    queryKey: ["cloud-console", "saas-user", userId],
    queryFn: () => cloudAdminApi.getCloudUser(userId),
    enabled: Boolean(userId),
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      cloudAdminApi.grantSubscription(userId, {
        durationDays: Number(grantDays),
        source: "admin_grant",
        note: "Cloud console manual grant",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "saas-user", userId],
      });
    },
  });

  const banMutation = useMutation({
    mutationFn: () => cloudAdminApi.banUser(userId, { reason: banReason || "manual-ban" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "saas-user", userId],
      });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: () => cloudAdminApi.unbanUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "saas-user", userId],
      });
    },
  });

  if (userQuery.isLoading) {
    return <LoadingBlock label={t("Loading cloud user...")} />;
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <ErrorBlock
        message={
          userQuery.error instanceof Error
            ? userQuery.error.message
            : t("Failed to load cloud user.")
        }
      />
    );
  }

  const user = userQuery.data;

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
              {t("SaaS user")}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
              {user.phone}
            </h2>
            <div className="mt-2 text-sm leading-7 text-[color:var(--text-secondary)]">
              {t("Account:")} {t(user.status)}
              <br />
              {t("Subscription:")} {t(user.subscriptionStatus)}
              <br />
              {t("Current plan:")} {user.currentPlanCode || "-"}
              <br />
              {t("Expires at:")} {formatTimestamp(user.subscriptionExpiresAt)}
              <br />
              {t("Invite code:")} {user.inviteCode || "-"}
              <br />
              {t("World status:")} {user.worldStatus ? t(user.worldStatus) : "-"}
              <br />
              {t("World:")} {user.worldId || "-"}{" "}
              {user.worldApiBaseUrl ? `(${user.worldApiBaseUrl})` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.worldId ? (
              <Button
                variant="secondary"
                className="rounded-2xl border-[color:var(--border-subtle)] bg-white"
                onClick={() =>
                  void navigate({
                    to: "/worlds/$worldId",
                    params: { worldId: user.worldId as string },
                  })
                }
              >
                {t("Open world")}
              </Button>
            ) : null}
            <Link
              to="/users"
              className="rounded-2xl border border-[color:var(--border-subtle)] bg-white px-4 py-2 text-sm"
            >
              {t("Back to users")}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
          <div className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t("Manual grant")}
          </div>
          <div className="mt-3 flex gap-3">
            <input
              value={grantDays}
              onChange={(event) => setGrantDays(event.target.value)}
              className="w-28 rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
            />
            <Button
              variant="primary"
              className="rounded-2xl bg-[color:var(--brand-primary)] text-white"
              disabled={grantMutation.isPending}
              onClick={() => grantMutation.mutate()}
            >
              {t("Grant days")}
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
          <div className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t("Account state")}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            <input
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
              placeholder={t("Ban reason")}
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="rounded-2xl border-[rgba(220,38,38,0.16)] text-[#b42318]"
                disabled={banMutation.isPending || user.status === "banned"}
                onClick={() => banMutation.mutate()}
              >
                {t("Ban")}
              </Button>
              <Button
                variant="secondary"
                className="rounded-2xl"
                disabled={unbanMutation.isPending || user.status === "active"}
                onClick={() => unbanMutation.mutate()}
              >
                {t("Unban")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
          <div className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t("Subscription history")}
          </div>
          <div className="mt-3 space-y-3">
            {user.subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="rounded-[20px] border border-[color:var(--border-faint)] bg-[#fafafa] px-4 py-3 text-sm"
              >
                <div className="font-medium text-[color:var(--text-primary)]">
                  {subscription.planName}
                </div>
                <div className="mt-1 text-[color:var(--text-secondary)]">
                  {t(subscription.status)} | {subscription.source}
                  <br />
                  {formatTimestamp(subscription.startsAt)} {"->"} {formatTimestamp(subscription.expiresAt)}
                  <br />
                  {subscription.note || "-"}
                </div>
              </div>
            ))}
            {!user.subscriptions.length ? (
              <InlineNotice tone="muted">
                {t("No subscription records found.")}
              </InlineNotice>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
          <div className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t("Invite history")}
          </div>
          <div className="mt-3 space-y-3">
            {user.redemptionsAsInviter.map((record) => (
              <div
                key={record.id}
                className="rounded-[20px] border border-[color:var(--border-faint)] bg-[#fafafa] px-4 py-3 text-sm"
              >
                <div className="font-medium text-[color:var(--text-primary)]">
                  {record.inviteePhoneMasked}
                </div>
                <div className="mt-1 text-[color:var(--text-secondary)]">
                  {t(record.status)} | {formatTimestamp(record.createdAt)}
                  {record.rejectReason ? ` | ${record.rejectReason}` : ""}
                </div>
              </div>
            ))}
            {!user.redemptionsAsInviter.length ? (
              <InlineNotice tone="muted">
                {t("No invite rewards recorded.")}
              </InlineNotice>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
