import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CloudFeedbackCategory,
  CloudFeedbackPriority,
  CloudFeedbackSource,
  CloudFeedbackStatus,
  CloudFeedbackSummary,
} from "@yinjie/contracts";
import { Button, ErrorBlock, InlineNotice, LoadingBlock } from "@yinjie/ui";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

const CATEGORY_OPTIONS: Array<{ value: CloudFeedbackCategory; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "interaction", label: "Interaction" },
  { value: "performance", label: "Performance" },
  { value: "content", label: "Content" },
  { value: "feature", label: "Feature" },
];

const PRIORITY_OPTIONS: Array<{ value: CloudFeedbackPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: Array<{ value: CloudFeedbackStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

const SOURCE_OPTIONS: Array<{ value: CloudFeedbackSource; label: string }> = [
  { value: "desktop", label: "Desktop" },
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "wechat", label: "WeChat" },
];

function categoryLabel(value: CloudFeedbackCategory) {
  return CATEGORY_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function priorityLabel(value: CloudFeedbackPriority) {
  return PRIORITY_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function statusLabel(value: CloudFeedbackStatus) {
  return STATUS_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function sourceLabel(value: CloudFeedbackSource) {
  return SOURCE_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

function priorityTone(priority: CloudFeedbackPriority) {
  if (priority === "high") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (priority === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusTone(status: CloudFeedbackStatus) {
  if (status === "new") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (status === "in_progress") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "resolved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function FeedbacksPage() {
  const t = useCloudConsoleText();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CloudFeedbackCategory | "">("");
  const [priority, setPriority] = useState<CloudFeedbackPriority | "">("");
  const [status, setStatus] = useState<CloudFeedbackStatus | "">("");
  const [source, setSource] = useState<CloudFeedbackSource | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const feedbacksQuery = useQuery({
    queryKey: [
      "cloud-console",
      "feedbacks",
      query,
      category,
      priority,
      status,
      source,
      page,
    ],
    queryFn: () =>
      cloudAdminApi.listFeedbacks({
        query: query || undefined,
        category: category || undefined,
        priority: priority || undefined,
        status: status || undefined,
        source: source || undefined,
        page,
        pageSize: 30,
      }),
  });

  const items = feedbacksQuery.data?.items ?? [];
  const stats = feedbacksQuery.data?.stats;
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { status: CloudFeedbackStatus; handlerNote?: string | null };
    }) => cloudAdminApi.updateFeedbackStatus(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["cloud-console", "feedbacks"],
      });
    },
  });

  return (
    <section className="space-y-4">
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label={t("New")} value={stats.new} tone="sky" />
          <StatCard
            label={t("In progress")}
            value={stats.inProgress}
            tone="amber"
          />
          <StatCard
            label={t("Resolved")}
            value={stats.resolved}
            tone="emerald"
          />
          <StatCard
            label={t("Archived")}
            value={stats.archived}
            tone="slate"
          />
          <StatCard
            label={t("High priority active")}
            value={stats.highPriority}
            tone="rose"
          />
        </div>
      ) : null}

      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-section)]">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("Search title, detail, owner, phone, email")}
            className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm md:col-span-2"
          />
          <FilterSelect
            value={status}
            placeholder={t("All statuses")}
            options={STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            onChange={(next) => {
              setStatus((next as CloudFeedbackStatus) || "");
              setPage(1);
            }}
          />
          <FilterSelect
            value={priority}
            placeholder={t("All priorities")}
            options={PRIORITY_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            onChange={(next) => {
              setPriority((next as CloudFeedbackPriority) || "");
              setPage(1);
            }}
          />
          <FilterSelect
            value={category}
            placeholder={t("All categories")}
            options={CATEGORY_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            onChange={(next) => {
              setCategory((next as CloudFeedbackCategory) || "");
              setPage(1);
            }}
          />
          <FilterSelect
            value={source}
            placeholder={t("All sources")}
            options={SOURCE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            onChange={(next) => {
              setSource((next as CloudFeedbackSource) || "");
              setPage(1);
            }}
          />
        </div>

        {feedbacksQuery.isLoading ? (
          <div className="mt-4">
            <LoadingBlock label={t("Loading feedbacks...")} />
          </div>
        ) : null}
        {feedbacksQuery.isError ? (
          <div className="mt-4">
            <ErrorBlock
              message={
                feedbacksQuery.error instanceof Error
                  ? feedbacksQuery.error.message
                  : t("Failed to load feedbacks.")
              }
            />
          </div>
        ) : null}

        {feedbacksQuery.data && !items.length ? (
          <div className="mt-4">
            <InlineNotice tone="muted">
              {t("No feedback matched the current filters.")}
            </InlineNotice>
          </div>
        ) : null}

        {items.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={
                      "w-full rounded-[18px] border px-4 py-3 text-left transition " +
                      (selectedItem?.id === item.id
                        ? "border-[color:var(--border-brand)] bg-[color:var(--surface-card)] shadow-[var(--shadow-soft)]"
                        : "border-[color:var(--border-faint)] bg-[#fafafa] hover:border-[color:var(--border-subtle)]")
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Pill tone={priorityTone(item.priority)}>
                        {t(priorityLabel(item.priority))}
                      </Pill>
                      <Pill tone={statusTone(item.status)}>
                        {t(statusLabel(item.status))}
                      </Pill>
                      <span className="text-[color:var(--text-muted)]">
                        {t(categoryLabel(item.category))}
                      </span>
                      <span className="text-[color:var(--text-muted)]">·</span>
                      <span className="text-[color:var(--text-muted)]">
                        {t(sourceLabel(item.source))}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-1 text-sm font-medium text-[color:var(--text-primary)]">
                      {item.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-secondary)]">
                      {item.detail}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                      <span>{formatDateTime(item.createdAt)}</span>
                      {item.submitterPhone ? (
                        <>
                          <span>·</span>
                          <span>{item.submitterPhone}</span>
                        </>
                      ) : null}
                      {item.submitterEmail ? (
                        <>
                          <span>·</span>
                          <span>{item.submitterEmail}</span>
                        </>
                      ) : null}
                      {item.ownerName ? (
                        <>
                          <span>·</span>
                          <span>{item.ownerName}</span>
                        </>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {selectedItem ? (
              <FeedbackDetailPanel
                item={selectedItem}
                isUpdating={updateMutation.isPending}
                onUpdateStatus={(payload) =>
                  updateMutation.mutate({ id: selectedItem.id, payload })
                }
              />
            ) : null}
          </div>
        ) : null}

        {feedbacksQuery.data && feedbacksQuery.data.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[color:var(--text-muted)]">
            <div>
              {t("Page")} {feedbacksQuery.data.page} / {feedbacksQuery.data.totalPages} ·
              {" "}
              {feedbacksQuery.data.total} {t("entries")}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="rounded-2xl"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("Previous")}
              </Button>
              <Button
                variant="secondary"
                className="rounded-2xl"
                disabled={
                  feedbacksQuery.data.page >= feedbacksQuery.data.totalPages
                }
                onClick={() => setPage((current) => current + 1)}
              >
                {t("Next")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "amber" | "emerald" | "slate" | "rose";
}) {
  const toneClass = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];

  return (
    <div
      className={`rounded-[20px] border px-4 py-3 ${toneClass}`}
    >
      <div className="text-xs uppercase tracking-[0.18em] opacity-80">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {children}
    </span>
  );
}

function FilterSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-2xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function FeedbackDetailPanel({
  item,
  isUpdating,
  onUpdateStatus,
}: {
  item: CloudFeedbackSummary;
  isUpdating: boolean;
  onUpdateStatus: (payload: {
    status: CloudFeedbackStatus;
    handlerNote?: string | null;
  }) => void;
}) {
  const t = useCloudConsoleText();
  const [note, setNote] = useState(item.handlerNote ?? "");

  return (
    <div className="rounded-[22px] border border-[color:var(--border-faint)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Pill tone={priorityTone(item.priority)}>
          {t(priorityLabel(item.priority))}
        </Pill>
        <Pill tone={statusTone(item.status)}>
          {t(statusLabel(item.status))}
        </Pill>
        <span className="text-[color:var(--text-muted)]">
          {t(categoryLabel(item.category))}
        </span>
        <span className="text-[color:var(--text-muted)]">·</span>
        <span className="text-[color:var(--text-muted)]">
          {t(sourceLabel(item.source))}
        </span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-[color:var(--text-primary)]">
        {item.title}
      </h2>

      <DetailRow label={t("Detail")} value={item.detail} />
      <DetailRow label={t("Reproduction")} value={item.reproduction || "-"} />
      <DetailRow label={t("Expected")} value={item.expected || "-"} />
      <DetailRow
        label={t("Diagnostic summary")}
        value={item.diagnosticSummary || "-"}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ContextItem label={t("Phone")} value={item.submitterPhone || "-"} />
        <ContextItem label={t("Email")} value={item.submitterEmail || "-"} />
        <ContextItem label={t("Owner")} value={item.ownerName || "-"} />
        <ContextItem label={t("Owner signature")} value={item.ownerSignature || "-"} />
        <ContextItem label={t("App platform")} value={item.appPlatform || "-"} />
        <ContextItem label={t("API base url")} value={item.apiBaseUrl || "-"} />
        <ContextItem label={t("Submitter IP")} value={item.submitterIp || "-"} />
        <ContextItem
          label={t("User agent")}
          value={item.submitterUserAgent || "-"}
        />
        <ContextItem
          label={t("Client record id")}
          value={item.clientRecordId || "-"}
        />
        <ContextItem
          label={t("Client submitted at")}
          value={item.clientSubmittedAt ? formatDateTime(item.clientSubmittedAt) : "-"}
        />
        <ContextItem label={t("Created at")} value={formatDateTime(item.createdAt)} />
        <ContextItem
          label={t("Handled at")}
          value={item.handledAt ? formatDateTime(item.handledAt) : "-"}
        />
      </div>

      <div className="mt-5 border-t border-[color:var(--border-faint)] pt-4">
        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
          {t("Handler note")}
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t(
            "Internal note for this feedback. Saved when you change status.",
          )}
          className="mt-2 min-h-[96px] w-full rounded-[14px] border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-[color:var(--border-brand)]"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={item.status === opt.value ? "primary" : "secondary"}
              className="rounded-2xl"
              disabled={isUpdating}
              onClick={() =>
                onUpdateStatus({
                  status: opt.value,
                  handlerNote: note.trim() ? note.trim() : null,
                })
              }
            >
              {t(opt.label)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap rounded-[14px] border border-[color:var(--border-faint)] bg-[#fafafa] px-3 py-2 text-sm leading-6 text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[color:var(--border-faint)] bg-[#fafafa] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
