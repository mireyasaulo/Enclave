import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type {
  CloudComputeProviderSummary,
  CloudInstancePowerState,
  CloudWorldAttentionItem,
  CloudWorldInstanceFleetItem,
  WorldLifecycleJobSummary,
} from "@yinjie/contracts";
import {
  formatDateTime as formatLocaleDateTime,
  useAppLocale,
} from "@yinjie/i18n";
import {
  CloudAdminErrorBlock,
  showCloudAdminErrorNotice,
} from "../components/cloud-admin-error-block";
import { ConsoleConfirmDialog } from "../components/console-confirm-dialog";
import { JobsPermalinkLink } from "../components/jobs-permalink-link";
import { useConsoleNotice } from "../components/console-notice";
import { WorldsPermalinkLink } from "../components/worlds-permalink-link";
import { WorldLifecycleActionButtons } from "../components/world-lifecycle-action-buttons";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import {
  formatCloudConsoleLastGeneratedAt,
  translateCloudConsoleTextForActiveLocale,
  useCloudConsoleText,
} from "../lib/cloud-console-i18n";
import { resolveQueueState } from "../lib/job-queue-state";
import { describeJobResult, getJobAuditBadgeLabel } from "../lib/job-result";
import { buildCompactJobsRouteSearch } from "../lib/job-route-search";
import {
  createRequestScopedNotice,
  showRequestScopedNotice,
} from "../lib/request-scoped-notice";
import { PageHeader, SurfaceCard } from "../components/ui";
import {
  DASHBOARD_ACTIVE_JOB_ACTIONS,
  DASHBOARD_ATTENTION_ACTIONS,
  DASHBOARD_FAILED_JOB_ACTIONS,
  createWorldActionConfirmationCopy,
  createWorldActionLabel,
  listAllowedWorldActions,
  performWorldLifecycleActionWithMeta,
  requiresWorldActionConfirmation,
  type ConfirmableWorldLifecycleAction,
  type WorldLifecycleAction,
} from "../lib/world-lifecycle-actions";
import {
  buildCompactWorldsRouteSearch,
  buildWorldsRouteSearch,
} from "../lib/world-route-search";

function getMetricTone(value: number) {
  if (value > 0) {
    return "text-[color:var(--text-primary)]";
  }

  return "text-[color:var(--text-secondary)]";
}

const JOB_AUDIT_BADGE_CLASS_NAME =
  "rounded-full border border-amber-300/50 bg-amber-50 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-700";

function formatDateTime(value?: string | null) {
  if (!value) {
    return translateCloudConsoleTextForActiveLocale("Not available");
  }

  return formatLocaleDateTime(new Date(value), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getAttentionTone(severity: CloudWorldAttentionItem["severity"]) {
  switch (severity) {
    case "critical":
      return "border-rose-300/60 bg-rose-50 text-rose-700";
    case "warning":
      return "border-amber-300/50 bg-amber-50 text-amber-700";
    case "info":
    default:
      return "border-sky-300/50 bg-sky-50 text-sky-700";
  }
}

function getPowerStateTone(powerState: CloudInstancePowerState) {
  switch (powerState) {
    case "running":
      return "border-emerald-300/50 bg-emerald-50 text-emerald-700";
    case "starting":
    case "provisioning":
    case "stopping":
      return "border-sky-300/50 bg-sky-50 text-sky-700";
    case "error":
      return "border-rose-300/60 bg-rose-50 text-rose-700";
    case "stopped":
    case "absent":
    default:
      return "border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]";
  }
}

function formatPowerState(powerState: CloudInstancePowerState) {
  switch (powerState) {
    case "running":
      return translateCloudConsoleTextForActiveLocale("Running");
    case "starting":
      return translateCloudConsoleTextForActiveLocale("Starting");
    case "provisioning":
      return translateCloudConsoleTextForActiveLocale("Provisioning");
    case "stopped":
      return translateCloudConsoleTextForActiveLocale("Stopped");
    case "stopping":
      return translateCloudConsoleTextForActiveLocale("Stopping");
    case "error":
      return translateCloudConsoleTextForActiveLocale("Error");
    case "absent":
    default:
      return translateCloudConsoleTextForActiveLocale("Absent");
  }
}

function resolveProviderKey(item: CloudWorldInstanceFleetItem) {
  return item.instance?.providerKey?.trim() || item.world.providerKey?.trim() || "";
}

function resolvePowerState(item: CloudWorldInstanceFleetItem): CloudInstancePowerState {
  return item.instance?.powerState ?? "absent";
}

function resolveProviderLabel(
  item: CloudWorldInstanceFleetItem,
  labelByKey: Map<string, string>,
) {
  const providerKey = resolveProviderKey(item);
  if (!providerKey) {
    return translateCloudConsoleTextForActiveLocale("Unassigned");
  }

  return labelByKey.get(providerKey) ?? providerKey;
}

function buildProviderLabelMap(providers: CloudComputeProviderSummary[] | undefined) {
  return new Map((providers ?? []).map((provider) => [provider.key, provider.label] as const));
}

function getJobStatusTone(status: WorldLifecycleJobSummary["status"]) {
  switch (status) {
    case "running":
      return "border-sky-300/50 bg-sky-50 text-sky-700";
    case "pending":
      return "border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)]";
    case "failed":
      return "border-rose-300/60 bg-rose-50 text-rose-700";
    case "succeeded":
      return "border-emerald-300/50 bg-emerald-50 text-emerald-700";
    case "cancelled":
    default:
      return "border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]";
  }
}

function compareNewest(left?: string | null, right?: string | null) {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}

function buildAttentionWorldSearch(item: CloudWorldAttentionItem) {
  return buildWorldsRouteSearch({
    attention: item.severity,
  });
}

function buildAttentionJobsSearch(item: CloudWorldAttentionItem) {
  return buildCompactJobsRouteSearch({
    worldId: item.worldId,
    jobType: item.activeJobType ?? "all",
    status:
      item.reason === "failed_world" || item.reason === "provider_error"
        ? "failed"
        : "all",
  });
}

function describeAttentionJobsLabel(item: CloudWorldAttentionItem) {
  if (item.activeJobType) {
    return `${item.activeJobType} jobs`;
  }

  return translateCloudConsoleTextForActiveLocale("Related jobs");
}

type QuickActionConfirmState = {
  worldId: string;
  worldName: string;
  action: ConfirmableWorldLifecycleAction;
};

export function DashboardPage() {
  const t = useCloudConsoleText();
  const { locale } = useAppLocale();
  const queryClient = useQueryClient();
  const { showNotice } = useConsoleNotice();
  const [confirmAction, setConfirmAction] =
    useState<QuickActionConfirmState | null>(null);
  const driftSummaryQuery = useQuery({
    queryKey: ["cloud-console", "dashboard", "drift-summary"],
    queryFn: () => cloudAdminApi.getWorldDriftSummary(),
    refetchInterval: 15_000,
  });
  const instanceFleetQuery = useQuery({
    queryKey: ["cloud-console", "dashboard", "instances"],
    queryFn: () => cloudAdminApi.listInstances(),
    refetchInterval: 15_000,
  });
  const providersQuery = useQuery({
    queryKey: ["cloud-console", "dashboard", "providers"],
    queryFn: () => cloudAdminApi.listProviders(),
  });
  const jobsQuery = useQuery({
    queryKey: ["cloud-console", "dashboard", "jobs"],
    queryFn: () => cloudAdminApi.listJobs({ page: 1, pageSize: 100 }),
    refetchInterval: 15_000,
  });
  const jobSummaryQuery = useQuery({
    queryKey: ["cloud-console", "dashboard", "job-summary"],
    queryFn: () => cloudAdminApi.getJobSummary(),
    refetchInterval: 15_000,
  });

  const driftSummary = driftSummaryQuery.data;
  const attentionItems = driftSummary?.attentionItems ?? [];
  const fleetItems = instanceFleetQuery.data ?? [];
  const providerLabelByKey = useMemo(
    () => buildProviderLabelMap(providersQuery.data),
    [providersQuery.data],
  );
  const fleetMetaByWorldId = useMemo(
    () =>
      new Map(
        fleetItems.map((item) => [
          item.world.id,
          {
            worldName: item.world.name,
            phone: item.world.phone,
            status: item.world.status,
            providerLabel: resolveProviderLabel(item, providerLabelByKey),
            powerState: resolvePowerState(item),
          },
        ] as const),
      ),
    [fleetItems, providerLabelByKey],
  );
  const activeJobs = useMemo(
    () =>
      (jobsQuery.data?.items ?? [])
        .filter((job) => job.status === "pending" || job.status === "running")
        .sort((left, right) => compareNewest(left.updatedAt, right.updatedAt))
        .slice(0, 6),
    [jobsQuery.data],
  );
  const jobSummaryFallback = useMemo(() => {
    const counts = {
      running_now: 0,
      lease_expired: 0,
      delayed: 0,
    };
    let failedJobs = 0;
    let supersededJobs = 0;

    for (const job of jobsQuery.data?.items ?? []) {
      if (job.status === "failed") {
        failedJobs += 1;
      }
      if (getJobAuditBadgeLabel(job) !== null) {
        supersededJobs += 1;
      }
      const queueState = resolveQueueState(job).key;
      if (queueState === "running_now") {
        counts.running_now += 1;
      } else if (queueState === "lease_expired") {
        counts.lease_expired += 1;
      } else if (queueState === "delayed") {
        counts.delayed += 1;
      }
    }

    return {
      failedJobs,
      supersededJobs,
      queueState: counts,
    };
  }, [jobsQuery.data]);
  const queueStateSummary = useMemo(() => {
    const counts = jobSummaryQuery.data?.queueState
      ? {
          running_now: jobSummaryQuery.data.queueState.runningNow,
          lease_expired: jobSummaryQuery.data.queueState.leaseExpired,
          delayed: jobSummaryQuery.data.queueState.delayed,
        }
      : jobSummaryFallback.queueState;

    return [
      {
        key: "running_now",
        label: t("Running jobs"),
        count: counts.running_now,
      },
      {
        key: "lease_expired",
        label: t("Lease expired jobs"),
        count: counts.lease_expired,
      },
      {
        key: "delayed",
        label: t("Delayed jobs"),
        count: counts.delayed,
      },
    ] as const;
  }, [jobSummaryFallback.queueState, jobSummaryQuery.data?.queueState]);
  const failedJobCount =
    jobSummaryQuery.data?.failedJobs ?? jobSummaryFallback.failedJobs;
  const supersededJobCount =
    jobSummaryQuery.data?.supersededJobs ?? jobSummaryFallback.supersededJobs;
  const supersededJobs = useMemo(
    () =>
      (jobsQuery.data?.items ?? [])
        .filter((job) => getJobAuditBadgeLabel(job) !== null)
        .sort((left, right) => compareNewest(left.updatedAt, right.updatedAt))
        .slice(0, 4),
    [jobsQuery.data],
  );
  const failedJobs = useMemo(
    () =>
      (jobsQuery.data?.items ?? [])
        .filter((job) => job.status === "failed")
        .sort((left, right) => compareNewest(left.updatedAt, right.updatedAt))
        .slice(0, 4),
    [jobsQuery.data],
  );
  const quickActionMutation = useMutation({
    mutationFn: (input: { worldId: string; action: WorldLifecycleAction }) =>
      performWorldLifecycleActionWithMeta(input.worldId, input.action),
    onSuccess: async (response, variables) => {
      if (requiresWorldActionConfirmation(variables.action)) {
        setConfirmAction(null);
      }
      showRequestScopedNotice(
        showNotice,
        createRequestScopedNotice(
          createWorldActionLabel(variables.action, response.data),
          "success",
          response.requestId,
        ),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cloud-console", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["cloud-console", "worlds"] }),
        queryClient.invalidateQueries({ queryKey: ["cloud-console", "instances"] }),
        queryClient.invalidateQueries({
          queryKey: ["cloud-console", "world-drift-summary"],
        }),
        queryClient.invalidateQueries({ queryKey: ["cloud-console", "jobs"] }),
      ]);
    },
    onError: (error, variables) => {
      if (requiresWorldActionConfirmation(variables.action)) {
        setConfirmAction(null);
      }
      showCloudAdminErrorNotice(showNotice, error);
    },
  });
  const pageErrors = [
    driftSummaryQuery.error,
    instanceFleetQuery.error,
    providersQuery.error,
    jobsQuery.error,
  ].filter((error): error is Error => error instanceof Error);
  const activeConfirm = confirmAction
    ? createWorldActionConfirmationCopy(confirmAction.action, {
        name: confirmAction.worldName,
      })
    : null;

  function handleQuickAction(
    worldId: string,
    worldName: string,
    action: WorldLifecycleAction,
  ) {
    if (requiresWorldActionConfirmation(action)) {
      setConfirmAction({
        worldId,
        worldName,
        action,
      });
      return;
    }

    quickActionMutation.mutate({
      worldId,
      action,
    });
  }

  return (
    <section className="space-y-6">
      <SurfaceCard>
        <PageHeader
          title={t("Fleet Dashboard")}
          subtitle="Quick view of world availability, queued recovery, and the most urgent runtime drift signals across the cloud fleet."
          actions={
            <>
              <WorldsPermalinkLink
                search={buildCompactWorldsRouteSearch()}
                className="rounded-full border border-[color:var(--border-faint)] px-4 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
              >
                {t("Open worlds")}
              </WorldsPermalinkLink>
              <JobsPermalinkLink
                search={buildCompactJobsRouteSearch()}
                className="rounded-full border border-[color:var(--border-faint)] px-4 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
              >
                {t("Inspect jobs")}
              </JobsPermalinkLink>
            </>
          }
        />

        {pageErrors.length ? (
          <div className="mt-4 space-y-3">
            {pageErrors.map((error) => (
              <CloudAdminErrorBlock key={error.message} error={error} />
            ))}
          </div>
        ) : null}

        <div className="mt-4 text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
          {formatCloudConsoleLastGeneratedAt(
            formatDateTime(driftSummary?.generatedAt),
            locale,
          )}
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[color:var(--text-primary)]">
                {t("Operator Queue")}
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                {t("Pending and running lifecycle work across the instance fleet.")}
              </div>
            </div>

            <JobsPermalinkLink
              search={buildCompactJobsRouteSearch()}
              className="text-sm text-[color:var(--text-secondary)] underline decoration-[color:var(--border-strong)] underline-offset-4 hover:text-[color:var(--text-primary)]"
            >
              {t("Open jobs")}
            </JobsPermalinkLink>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {queueStateSummary.map((item) => (
              <JobsPermalinkLink
                key={item.key}
                search={buildCompactJobsRouteSearch({ queueState: item.key })}
                className="rounded-full border border-[color:var(--border-faint)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
              >
                {item.label} {item.count}
              </JobsPermalinkLink>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {activeJobs.map((job) => {
              const worldMeta = fleetMetaByWorldId.get(job.worldId);
              const actions: readonly WorldLifecycleAction[] = worldMeta
                ? listAllowedWorldActions(
                    worldMeta.status,
                    DASHBOARD_ACTIVE_JOB_ACTIONS,
                  )
                : ["reconcile"];

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4"
                >
                  <Link
                    to="/worlds/$worldId"
                    params={{ worldId: job.worldId }}
                    className="block transition hover:opacity-90"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getJobStatusTone(
                          job.status,
                        )}`}
                      >
                        {job.status}
                      </span>
                      <span className="text-sm text-[color:var(--text-primary)]">
                        {job.jobType}
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)]">
                        attempt {job.attempt}/{job.maxAttempts}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-[color:var(--text-secondary)]">
                      {worldMeta?.worldName ?? job.worldId}
                      {worldMeta?.phone ? ` · ${worldMeta.phone}` : ""}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[color:var(--border-faint)] px-3 py-1 text-[color:var(--text-secondary)]">
                        {worldMeta?.providerLabel ?? t("Unassigned")}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 uppercase tracking-[0.18em] ${getPowerStateTone(
                          worldMeta?.powerState ?? "absent",
                        )}`}
                      >
                        {formatPowerState(worldMeta?.powerState ?? "absent")}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                      Updated {formatDateTime(job.updatedAt)}
                    </div>
                  </Link>

                  <WorldLifecycleActionButtons
                    actions={actions}
                    world={{ name: worldMeta?.worldName ?? job.worldId }}
                    pendingAction={
                      quickActionMutation.isPending &&
                      quickActionMutation.variables?.worldId === job.worldId
                        ? quickActionMutation.variables.action
                        : null
                    }
                    disabled={quickActionMutation.isPending}
                    onAction={(action) =>
                      handleQuickAction(
                        job.worldId,
                        worldMeta?.worldName ?? job.worldId,
                        action,
                      )
                    }
                    className="mt-4 flex flex-wrap gap-2"
                    buttonClassName="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] disabled:opacity-60"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <JobsPermalinkLink
                      search={buildCompactJobsRouteSearch({
                        worldId: job.worldId,
                      })}
                      aria-label={`Open operator jobs for ${worldMeta?.worldName ?? job.worldId}`}
                      className="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                    >
                      {t("World operator jobs")}
                    </JobsPermalinkLink>
                  </div>
                </div>
              );
            })}

            {!jobsQuery.isLoading && activeJobs.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-secondary)]">
                {t("No pending or running jobs in the operator queue.")}
              </div>
            ) : null}

            {jobsQuery.isLoading ? (
              <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
                {t("Loading lifecycle jobs...")}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-[color:var(--text-primary)]">
                  {t("Recent Failures")}
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {t("Latest failed lifecycle work that may need manual recovery.")}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <JobsPermalinkLink
                  search={buildCompactJobsRouteSearch({ status: "failed" })}
                  className="text-sm text-[color:var(--text-secondary)] underline decoration-[color:var(--border-strong)] underline-offset-4 hover:text-[color:var(--text-primary)]"
                >
                  Open failed jobs ({failedJobCount})
                </JobsPermalinkLink>
                <JobsPermalinkLink
                  search={buildCompactJobsRouteSearch({ audit: "superseded" })}
                  className="text-sm text-[color:var(--text-secondary)] underline decoration-[color:var(--border-strong)] underline-offset-4 hover:text-[color:var(--text-primary)]"
                >
                  Open superseded jobs ({supersededJobCount})
                </JobsPermalinkLink>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {failedJobs.map((job) => {
                const worldMeta = fleetMetaByWorldId.get(job.worldId);
                const actions: readonly WorldLifecycleAction[] = worldMeta
                  ? listAllowedWorldActions(
                      worldMeta.status,
                      DASHBOARD_FAILED_JOB_ACTIONS,
                    )
                  : ["reconcile"];
                const auditBadgeLabel = getJobAuditBadgeLabel(job);

                return (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4"
                  >
                    <Link
                      to="/worlds/$worldId"
                      params={{ worldId: job.worldId }}
                      className="block transition hover:opacity-90"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getJobStatusTone(
                            job.status,
                          )}`}
                        >
                          {job.status}
                        </span>
                        <span className="text-sm text-[color:var(--text-primary)]">
                          {job.jobType}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-[color:var(--text-secondary)]">
                        {worldMeta?.worldName ?? job.worldId}
                        {worldMeta?.phone ? ` · ${worldMeta.phone}` : ""}
                      </div>
                      <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
                        {describeJobResult(job)}
                      </div>
                      {auditBadgeLabel ? (
                        <div className="mt-2">
                          <span className={JOB_AUDIT_BADGE_CLASS_NAME}>
                            {auditBadgeLabel}
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-[color:var(--border-faint)] px-3 py-1 text-[color:var(--text-secondary)]">
                          {worldMeta?.providerLabel ?? t("Unassigned")}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 uppercase tracking-[0.18em] ${getPowerStateTone(
                            worldMeta?.powerState ?? "absent",
                          )}`}
                        >
                          {formatPowerState(worldMeta?.powerState ?? "absent")}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                        Updated {formatDateTime(job.updatedAt)}
                      </div>
                    </Link>

                    <WorldLifecycleActionButtons
                      actions={actions}
                      world={{ name: worldMeta?.worldName ?? job.worldId }}
                      pendingAction={
                        quickActionMutation.isPending &&
                        quickActionMutation.variables?.worldId === job.worldId
                          ? quickActionMutation.variables.action
                          : null
                      }
                      disabled={quickActionMutation.isPending}
                      onAction={(action) =>
                        handleQuickAction(
                          job.worldId,
                          worldMeta?.worldName ?? job.worldId,
                          action,
                        )
                      }
                      className="mt-4 flex flex-wrap gap-2"
                      buttonClassName="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] disabled:opacity-60"
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <JobsPermalinkLink
                        search={buildCompactJobsRouteSearch({
                          status: "failed",
                          worldId: job.worldId,
                        })}
                        aria-label={`Open failed jobs for ${worldMeta?.worldName ?? job.worldId}`}
                        className="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                      >
                        {t("World failed jobs")}
                      </JobsPermalinkLink>
                    </div>
                  </div>
                );
              })}

              {!jobsQuery.isLoading && failedJobs.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-secondary)]">
                  {t("No recent failed jobs.")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-[color:var(--text-primary)]">
                  {t("Superseded Queue")}
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {t("Latest lifecycle jobs that were replaced by newer work.")}
                </div>
              </div>

              <JobsPermalinkLink
                search={buildCompactJobsRouteSearch({ audit: "superseded" })}
                className="text-sm text-[color:var(--text-secondary)] underline decoration-[color:var(--border-strong)] underline-offset-4 hover:text-[color:var(--text-primary)]"
              >
                Open superseded queue ({supersededJobCount})
              </JobsPermalinkLink>
            </div>

            <div className="mt-4 space-y-3">
              {supersededJobs.map((job) => {
                const worldMeta = fleetMetaByWorldId.get(job.worldId);
                const auditBadgeLabel =
                  getJobAuditBadgeLabel(job) ?? "Superseded";
                const worldLabel = worldMeta?.worldName ?? job.worldId;

                return (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4"
                  >
                    <Link
                      to="/worlds/$worldId"
                      params={{ worldId: job.worldId }}
                      className="block transition hover:opacity-90"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getJobStatusTone(
                            job.status,
                          )}`}
                        >
                          {job.status}
                        </span>
                        <span className="text-sm text-[color:var(--text-primary)]">
                          {job.jobType}
                        </span>
                        <span className={JOB_AUDIT_BADGE_CLASS_NAME}>
                          {auditBadgeLabel}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-[color:var(--text-secondary)]">
                        {worldLabel}
                        {worldMeta?.phone ? ` · ${worldMeta.phone}` : ""}
                      </div>
                      <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
                        {describeJobResult(job)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-[color:var(--border-faint)] px-3 py-1 text-[color:var(--text-secondary)]">
                          {worldMeta?.providerLabel ?? t("Unassigned")}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 uppercase tracking-[0.18em] ${getPowerStateTone(
                            worldMeta?.powerState ?? "absent",
                          )}`}
                        >
                          {formatPowerState(worldMeta?.powerState ?? "absent")}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                        Updated {formatDateTime(job.updatedAt)}
                      </div>
                    </Link>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <JobsPermalinkLink
                        search={buildCompactJobsRouteSearch({
                          audit: "superseded",
                          worldId: job.worldId,
                        })}
                        aria-label={`Open superseded jobs for ${worldLabel}`}
                        className="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                      >
                        {t("World superseded jobs")}
                      </JobsPermalinkLink>
                    </div>
                  </div>
                );
              })}

              {!jobsQuery.isLoading && supersededJobs.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-secondary)]">
                  {t("No recent superseded jobs.")}
                </div>
              ) : null}

              {jobsQuery.isLoading ? (
                <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
                  {t("Loading superseded lifecycle jobs...")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[color:var(--text-primary)]">
              {t("Attention Queue")}
            </div>
            <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
              {t("Most urgent worlds needing manual inspection or follow-up.")}
            </div>
          </div>

          <WorldsPermalinkLink
            search={buildCompactWorldsRouteSearch()}
            className="text-sm text-[color:var(--text-secondary)] underline decoration-[color:var(--border-strong)] underline-offset-4 hover:text-[color:var(--text-primary)]"
          >
            {t("Open world fleet")}
          </WorldsPermalinkLink>
        </div>

        <div className="mt-4 space-y-3">
          {attentionItems.map((item) => {
            const fleetMeta = fleetMetaByWorldId.get(item.worldId);
            const actions = listAllowedWorldActions(
              item.worldStatus,
              DASHBOARD_ATTENTION_ACTIONS,
            );

            return (
              <div
                key={item.worldId}
                className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4"
              >
                <Link
                  to="/worlds/$worldId"
                  params={{ worldId: item.worldId }}
                  className="block transition hover:opacity-90"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getAttentionTone(
                        item.severity,
                      )}`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-sm text-[color:var(--text-primary)]">
                      {item.worldName}
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {item.phone}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-[color:var(--text-secondary)]">
                    {item.message}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-[color:var(--border-faint)] px-3 py-1 text-[color:var(--text-secondary)]">
                      {fleetMeta?.providerLabel ?? t("Unassigned")}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 uppercase tracking-[0.18em] ${getPowerStateTone(
                        fleetMeta?.powerState ?? "absent",
                      )}`}
                    >
                      {formatPowerState(fleetMeta?.powerState ?? "absent")}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                    Status {item.worldStatus} · Updated{" "}
                    {formatDateTime(item.updatedAt)}
                  </div>
                </Link>

                <div className="mt-4 flex flex-wrap gap-2">
                  <WorldsPermalinkLink
                    search={buildCompactWorldsRouteSearch(
                      buildAttentionWorldSearch(item),
                    )}
                    aria-label={`Open worlds with ${item.severity} attention`}
                    className="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                  >
                    {item.severity} worlds
                  </WorldsPermalinkLink>
                  <JobsPermalinkLink
                    search={buildAttentionJobsSearch(item)}
                    aria-label={`Open jobs for ${item.worldName}`}
                    className="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                  >
                    {describeAttentionJobsLabel(item)}
                  </JobsPermalinkLink>
                </div>

                <WorldLifecycleActionButtons
                  actions={actions}
                  world={{ name: item.worldName }}
                  pendingAction={
                    quickActionMutation.isPending &&
                    quickActionMutation.variables?.worldId === item.worldId
                      ? quickActionMutation.variables.action
                      : null
                  }
                  disabled={quickActionMutation.isPending}
                  onAction={(action) =>
                    handleQuickAction(item.worldId, item.worldName, action)
                  }
                  className="mt-4 flex flex-wrap gap-2"
                  buttonClassName="rounded-lg border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] disabled:opacity-60"
                />
              </div>
            );
          })}

          {!driftSummaryQuery.isLoading &&
          !driftSummaryQuery.isError &&
          attentionItems.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-secondary)]">
              {t("No active attention items. The fleet currently looks healthy.")}
            </div>
          ) : null}

          {driftSummaryQuery.isLoading ? (
            <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
              {t("Loading fleet dashboard...")}
            </div>
          ) : null}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={Boolean(activeConfirm && confirmAction)}
        title={activeConfirm?.title ?? ""}
        description={activeConfirm?.description ?? ""}
        confirmLabel={activeConfirm?.confirmLabel}
        pendingLabel={activeConfirm?.pendingLabel}
        danger={activeConfirm?.danger}
        pending={
          Boolean(confirmAction) &&
          quickActionMutation.isPending &&
          quickActionMutation.variables?.worldId === confirmAction?.worldId &&
          quickActionMutation.variables?.action === confirmAction?.action
        }
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) {
            return;
          }

          quickActionMutation.mutate({
            worldId: confirmAction.worldId,
            action: confirmAction.action,
          });
        }}
      />
    </section>
  );
}
