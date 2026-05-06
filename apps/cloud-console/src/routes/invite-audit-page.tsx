import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InviteRedemptionStatus } from "@yinjie/contracts";
import { Button, ErrorBlock, InlineNotice, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

export function InviteAuditPage() {
  const t = useCloudConsoleText();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InviteRedemptionStatus | "">("");

  const redemptionsQuery = useQuery({
    queryKey: ["cloud-console", "invite-redemptions", query, status],
    queryFn: () =>
      cloudAdminApi.listInviteRedemptions({
        query: query || undefined,
        status: status || undefined,
        page: 1,
        pageSize: 50,
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cloudAdminApi.rejectInviteRedemption(id, { reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "invite-redemptions"],
      });
    },
  });

  return (
    <section className="space-y-4 rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search phone or code")}
          className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as InviteRedemptionStatus | "")
          }
          className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
        >
          <option value="">{t("All redemption states")}</option>
          <option value="rewarded">{t("rewarded")}</option>
          <option value="rejected">{t("rejected")}</option>
        </select>
      </div>

      {redemptionsQuery.isLoading ? (
        <LoadingBlock label={t("Loading invite audit...")} />
      ) : null}
      {redemptionsQuery.isError ? (
        <ErrorBlock
          message={
            redemptionsQuery.error instanceof Error
              ? redemptionsQuery.error.message
              : t("Failed to load invite audit.")
          }
        />
      ) : null}

      {redemptionsQuery.data ? (
        <div className="space-y-3">
          {redemptionsQuery.data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-[color:var(--border-faint)] bg-[#fafafa] px-4 py-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="text-sm leading-7 text-[color:var(--text-secondary)]">
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {item.inviteePhone} {"->"} {item.inviterPhone}
                  </div>
                  <div>
                    {t("Code:")} {item.inviteCode}
                  </div>
                  <div>
                    {t("Status:")} {t(item.status)}
                  </div>
                  <div>
                    {t("IP:")} {item.inviteeIp || "-"}
                  </div>
                  <div>
                    {t("Device:")} {item.inviteeDeviceFingerprint || "-"}
                  </div>
                  <div>
                    {t("Created at:")} {item.createdAt}
                  </div>
                  {item.rejectReason ? (
                    <div>
                      {t("Reason:")} {item.rejectReason}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  className="rounded-2xl"
                  disabled={rejectMutation.isPending || item.status === "rejected"}
                  onClick={() => {
                    const reason =
                      window.prompt(
                        t("Reject reason"),
                        item.rejectReason || "manual-review",
                      ) || "";
                    if (!reason.trim()) {
                      return;
                    }
                    rejectMutation.mutate({ id: item.id, reason });
                  }}
                >
                  {t("Reject reward")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {redemptionsQuery.data && !redemptionsQuery.data.items.length ? (
        <InlineNotice tone="muted">
          {t("No invite redemptions matched the current filters.")}
        </InlineNotice>
      ) : null}
    </section>
  );
}
