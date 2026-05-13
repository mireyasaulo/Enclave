import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type {
  CloudUserStatus,
  CloudUserSummary,
  SubscriptionStatus,
} from "@yinjie/contracts";
import { formatDateTime, useAppLocale } from "@yinjie/i18n";
import { ErrorBlock, InlineNotice, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import {
  formatCloudConsolePageOfTotal,
  useCloudConsoleText,
} from "../lib/cloud-console-i18n";
import { useIpRegion } from "../lib/ip-region";
import { SurfaceCard } from "../components/ui";

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

const FILTER_CONTROL_CLASS =
  "rounded-2xl border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm";

type SortField = "expires" | "registered" | "lastLogin";
type SortDirection = "asc" | "desc";

function getSortValue(user: CloudUserSummary, field: SortField): number | null {
  const raw =
    field === "expires"
      ? user.subscriptionExpiresAt
      : field === "registered"
        ? user.createdAt
        : user.lastLoginAt;
  if (!raw) return null;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function IpRegionCell({ ip }: { ip: string | null }) {
  const region = useIpRegion(ip);
  if (!ip) return <span>-</span>;
  if (region.isLoading) {
    return (
      <span
        className="text-[color:var(--text-muted)]"
        title={ip}
      >
        …
      </span>
    );
  }
  if (region.isError || !region.data) {
    // 解析失败时退回展示原始 IP，避免空白
    return <span title={ip}>{ip}</span>;
  }
  return (
    <span
      className="cursor-help text-[color:var(--text-secondary)]"
      title={ip}
    >
      {region.data.display}
    </span>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onToggle,
}: {
  label: string;
  field: SortField;
  activeField: SortField | null;
  direction: SortDirection;
  onToggle: (field: SortField) => void;
}) {
  const isActive = activeField === field;
  const indicator = isActive ? (direction === "asc" ? "▲" : "▼") : "↕";
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={`inline-flex items-center gap-1 font-medium ${
        isActive
          ? "text-[color:var(--text-primary)]"
          : "text-[color:var(--text-muted)]"
      } hover:text-[color:var(--text-primary)]`}
    >
      <span>{label}</span>
      <span className="text-xs">{indicator}</span>
    </button>
  );
}

export function UsersPage() {
  const t = useCloudConsoleText();
  const { locale } = useAppLocale();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CloudUserStatus | "">("");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | "">("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const usersQuery = useQuery({
    queryKey: ["cloud-console", "saas-users", query, status, subscriptionStatus, page],
    queryFn: () =>
      cloudAdminApi.listCloudUsers({
        query: query || undefined,
        status: status || undefined,
        subscriptionStatus: subscriptionStatus || undefined,
        page,
        pageSize: 20,
      }),
  });

  // 排序仅作用在当前页的 20 条上：后端尚未提供 orderBy，全局排序需要新接口
  const sortedItems = useMemo(() => {
    const items = usersQuery.data?.items ?? [];
    if (!sortField) return items;
    const sign = sortDirection === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = getSortValue(a, sortField);
      const bv = getSortValue(b, sortField);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * sign;
    });
  }, [usersQuery.data?.items, sortField, sortDirection]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  return (
    <SurfaceCard className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={t("Search phone")}
          className={FILTER_CONTROL_CLASS}
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as CloudUserStatus | "");
            setPage(1);
          }}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">{t("All account states")}</option>
          <option value="active">{t("active")}</option>
          <option value="banned">{t("banned")}</option>
          <option value="archived">{t("archived")}</option>
        </select>
        <select
          value={subscriptionStatus}
          onChange={(event) => {
            setSubscriptionStatus(event.target.value as SubscriptionStatus | "");
            setPage(1);
          }}
          className={FILTER_CONTROL_CLASS}
        >
          <option value="">{t("All subscription states")}</option>
          <option value="active">{t("active")}</option>
          <option value="expired">{t("expired")}</option>
          <option value="none">{t("none")}</option>
        </select>
        <div className="rounded-2xl border border-[color:var(--border-faint)] bg-white px-3 py-2 text-sm text-[color:var(--text-secondary)]">
          {formatCloudConsolePageOfTotal(
            usersQuery.data?.page ?? page,
            usersQuery.data?.totalPages ?? 1,
            locale,
          )}
        </div>
      </div>

      {usersQuery.isLoading ? (
        <LoadingBlock label={t("Loading SaaS users...")} />
      ) : null}
      {usersQuery.isError ? (
        <ErrorBlock
          message={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : t("Failed to load users.")
          }
        />
      ) : null}

      {usersQuery.data ? (
        <div className="overflow-hidden rounded-[24px] border border-[color:var(--border-faint)] bg-white">
          <table className="min-w-full divide-y divide-[color:var(--border-faint)] text-sm">
            <thead className="bg-[#f8faf8] text-left text-[color:var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Email")}</th>
                <th className="px-4 py-3 font-medium">{t("Account")}</th>
                <th className="px-4 py-3 font-medium">{t("Subscription")}</th>
                <th className="px-4 py-3 font-medium">
                  <SortableHeader
                    label={t("Expires")}
                    field="expires"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <SortableHeader
                    label={t("Registered")}
                    field="registered"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">{t("Registration IP")}</th>
                <th className="px-4 py-3 font-medium">
                  <SortableHeader
                    label={t("Last login")}
                    field="lastLogin"
                    activeField={sortField}
                    direction={sortDirection}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 font-medium">{t("Last login IP")}</th>
                <th className="px-4 py-3 font-medium">{t("Inviter")}</th>
                <th className="px-4 py-3 font-medium">{t("World")}</th>
                <th className="px-4 py-3 font-medium">{t("Plan")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-faint)]">
              {sortedItems.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-4 py-3 break-all">
                    <Link
                      to="/users/$userId"
                      params={{ userId: user.id }}
                      className="font-medium text-[color:var(--brand-primary)]"
                    >
                      {user.email || user.displayName || t("(no email)")}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t(user.status)}</td>
                  <td className="px-4 py-3">{t(user.subscriptionStatus)}</td>
                  <td className="px-4 py-3">
                    {formatTimestamp(user.subscriptionExpiresAt)}
                  </td>
                  <td className="px-4 py-3">{formatTimestamp(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <IpRegionCell ip={user.registrationIp} />
                  </td>
                  <td className="px-4 py-3">{formatTimestamp(user.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <IpRegionCell ip={user.lastLoginIp} />
                  </td>
                  <td className="px-4 py-3">{user.inviterPhone || "-"}</td>
                  <td className="px-4 py-3">
                    {user.worldStatus ? t(user.worldStatus) : "-"}
                  </td>
                  <td className="px-4 py-3">{user.currentPlanCode || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {usersQuery.data && !usersQuery.data.items.length ? (
        <InlineNotice tone="muted">
          {t("No cloud users matched the current filters.")}
        </InlineNotice>
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-2xl border border-[color:var(--border-subtle)] bg-white px-4 py-2 text-sm"
          onClick={() => setPage((current) => Math.max(current - 1, 1))}
          disabled={page <= 1}
        >
          {t("Previous")}
        </button>
        <button
          type="button"
          className="rounded-2xl border border-[color:var(--border-subtle)] bg-white px-4 py-2 text-sm"
          onClick={() => setPage((current) => current + 1)}
          disabled={Boolean(usersQuery.data && page >= usersQuery.data.totalPages)}
        >
          {t("Next")}
        </button>
      </div>
    </SurfaceCard>
  );
}
