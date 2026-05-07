import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type {
  CloudComputeProviderSummary,
  CloudWorldAttentionItem,
  CloudWorldLifecycleJobAggregateSummary,
  CloudWorldLifecycleStatus,
  WorldLifecycleJobStatus,
} from "@yinjie/contracts";
import { formatDateTime as formatLocaleDateTime, useAppLocale } from "@yinjie/i18n";
import { ErrorBlock } from "@yinjie/ui";
import {
  CloudAdminErrorBlock,
  showCloudAdminErrorNotice,
} from "../components/cloud-admin-error-block";
import { ConsoleConfirmDialog } from "../components/console-confirm-dialog";
import { JobsPermalinkLink } from "../components/jobs-permalink-link";
import { useConsoleNotice } from "../components/console-notice";
import { WorldLifecycleActionButtons } from "../components/world-lifecycle-action-buttons";
import { copyTextToClipboard } from "../lib/clipboard";
import {
  groupJobsByQueueState,
  matchesQueueStateFilter,
  QUEUE_STATE_FILTERS,
  type QueueStateFilter,
} from "../lib/job-queue-state";
import { buildCompactJobsRouteSearch } from "../lib/job-route-search";
import { cloudAdminApi } from "../lib/cloud-admin-api";
import {
  formatCloudConsoleJobLeaseAvailable,
  formatCloudConsoleJobLeaseExpires,
  formatCloudConsoleJobLeaseRemaining,
  formatCloudConsoleJobsGroupCount,
  translateCloudConsoleTextForActiveLocale,
  useCloudConsoleText,
} from "../lib/cloud-console-i18n";
import {
  localizeProviderDescription,
  localizeProviderLabel,
} from "../lib/provider-i18n";
import { describeJobResult, getJobAuditBadgeLabel } from "../lib/job-result";
import {
  createRequestScopedNotice,
  showRequestScopedNotice,
} from "../lib/request-scoped-notice";
import {
  ALL_WORLD_LIFECYCLE_ACTIONS,
  createWorldActionConfirmationCopy,
  createWorldActionLabel,
  listAllowedWorldActions,
  performWorldLifecycleActionWithMeta,
  requiresWorldActionConfirmation,
  type ConfirmableWorldLifecycleAction,
  type WorldLifecycleAction,
} from "../lib/world-lifecycle-actions";

const WORLD_STATUSES: CloudWorldLifecycleStatus[] = [
  "queued",
  "creating",
  "bootstrapping",
  "starting",
  "ready",
  "sleeping",
  "stopping",
  "failed",
  "disabled",
  "deleting",
];

const SECONDARY_ACTION_BUTTON =
  "rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-secondary)] px-4 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-tertiary)] disabled:opacity-60";
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

function formatLeaseOwner(value?: string | null) {
  if (!value) {
    return translateCloudConsoleTextForActiveLocale("Unleased");
  }

  return value;
}

function formatDuration(value?: number | null) {
  if (value == null) {
    return translateCloudConsoleTextForActiveLocale("Not leased");
  }

  if (value <= 0) {
    return translateCloudConsoleTextForActiveLocale("Expired");
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function compareNewest(left?: string | null, right?: string | null) {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}

function formatOptional(value?: string | null) {
  return value?.trim() || translateCloudConsoleTextForActiveLocale("Not set");
}

function getJobStatusTone(status: WorldLifecycleJobStatus) {
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

function getEscalationLabel(
  reason?: CloudWorldAttentionItem["escalationReason"] | null,
) {
  switch (reason) {
    case "world_failed":
      return translateCloudConsoleTextForActiveLocale("World failed");
    case "provider_error":
      return translateCloudConsoleTextForActiveLocale("Provider error");
    case "retry_threshold":
      return translateCloudConsoleTextForActiveLocale("Retry threshold");
    case "heartbeat_duration":
      return translateCloudConsoleTextForActiveLocale("Heartbeat duration");
    default:
      return translateCloudConsoleTextForActiveLocale("Not escalated");
  }
}

function resolveCanonicalProviderKey(value?: string | null) {
  return value?.trim() === "manual" ? "manual-docker" : value?.trim() || "";
}

function findProviderByKey(
  providers: CloudComputeProviderSummary[],
  providerKey: string,
) {
  const canonicalProviderKey = resolveCanonicalProviderKey(providerKey);
  return (
    providers.find((provider) => provider.key === canonicalProviderKey) ?? null
  );
}

function buildProviderOptions(
  providers: CloudComputeProviderSummary[],
  providerKey: string,
) {
  const selectedProvider = findProviderByKey(providers, providerKey);
  if (selectedProvider || !providerKey) {
    return providers;
  }

  return [
    ...providers,
    {
      key: providerKey,
      label: `${providerKey} (legacy)`,
      description: translateCloudConsoleTextForActiveLocale(
        "This provider key is not in the current catalog yet.",
      ),
      provisionStrategy: providerKey,
      deploymentMode: "custom",
      defaultRegion: null,
      defaultZone: null,
      capabilities: {
        managedProvisioning: false,
        managedLifecycle: false,
        bootstrapPackage: false,
        snapshots: false,
      },
    },
  ];
}

function validateWorldForm(params: {
  phone: string;
  name: string;
  status: CloudWorldLifecycleStatus;
  apiBaseUrl: string;
}) {
  if (!params.phone.trim()) {
    return translateCloudConsoleTextForActiveLocale("Phone is required.");
  }

  if (!params.name.trim()) {
    return translateCloudConsoleTextForActiveLocale("World name is required.");
  }

  if (params.status === "ready" && !params.apiBaseUrl.trim()) {
    return translateCloudConsoleTextForActiveLocale("A ready world must include a world API base URL.");
  }

  return null;
}

function formatBootstrapCallbackEndpoints(endpoints: {
  bootstrap: string;
  heartbeat: string;
  activity: string;
  health: string;
  fail: string;
}) {
  return [
    `BOOTSTRAP=${endpoints.bootstrap}`,
    `HEARTBEAT=${endpoints.heartbeat}`,
    `ACTIVITY=${endpoints.activity}`,
    `HEALTH=${endpoints.health}`,
    `FAIL=${endpoints.fail}`,
  ].join("\n");
}

type WorldConfirmAction =
  | ConfirmableWorldLifecycleAction
  | "rotate-callback-token";

export function WorldDetailPage() {
  const t = useCloudConsoleText();
  const { locale } = useAppLocale();
  const { worldId } = useParams({ from: "/worlds/$worldId" });
  const queryClient = useQueryClient();
  const { showNotice } = useConsoleNotice();

  const worldQuery = useQuery({
    queryKey: ["cloud-console", "world", worldId],
    queryFn: () => cloudAdminApi.getWorld(worldId),
  });
  const providersQuery = useQuery({
    queryKey: ["cloud-console", "providers"],
    queryFn: () => cloudAdminApi.listProviders(),
  });
  const instanceQuery = useQuery({
    queryKey: ["cloud-console", "world-instance", worldId],
    queryFn: () => cloudAdminApi.getWorldInstance(worldId),
  });
  const bootstrapConfigQuery = useQuery({
    queryKey: ["cloud-console", "world-bootstrap-config", worldId],
    queryFn: () => cloudAdminApi.getWorldBootstrapConfig(worldId),
  });
  const runtimeStatusQuery = useQuery({
    queryKey: ["cloud-console", "world-runtime-status", worldId],
    queryFn: () => cloudAdminApi.getWorldRuntimeStatus(worldId),
  });
  const alertSummaryQuery = useQuery({
    queryKey: ["cloud-console", "world-alert-summary", worldId],
    queryFn: () => cloudAdminApi.getWorldAlertSummary(worldId),
  });
  const jobsQuery = useQuery({
    queryKey: ["cloud-console", "jobs", "world", worldId],
    queryFn: () => cloudAdminApi.listJobs({ worldId, page: 1, pageSize: 20 }),
    refetchInterval: 15_000,
  });
  const jobSummaryQuery = useQuery({
    queryKey: ["cloud-console", "jobs", "summary", "world", worldId],
    queryFn: () => cloudAdminApi.getJobSummary({ worldId }),
    refetchInterval: 15_000,
  });

  const [draftStatus, setDraftStatus] =
    useState<CloudWorldLifecycleStatus>("queued");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [provisionStrategy, setProvisionStrategy] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [providerRegion, setProviderRegion] = useState("");
  const [providerZone, setProviderZone] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [adminUrl, setAdminUrl] = useState("");
  const [note, setNote] = useState("");
  const [formHydrated, setFormHydrated] = useState(false);
  const [queueStateFilter, setQueueStateFilter] =
    useState<QueueStateFilter>("all");
  const [confirmAction, setConfirmAction] = useState<WorldConfirmAction | null>(
    null,
  );
  const validationMessage = formHydrated
    ? validateWorldForm({
        phone,
        name,
        status: draftStatus,
        apiBaseUrl,
      })
    : null;

  async function invalidateWorldQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["cloud-console", "world", worldId],
      }),
      queryClient.invalidateQueries({ queryKey: ["cloud-console", "worlds"] }),
      queryClient.invalidateQueries({
        queryKey: ["cloud-console", "world-instance", worldId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["cloud-console", "world-bootstrap-config", worldId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["cloud-console", "world-runtime-status", worldId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["cloud-console", "world-alert-summary", worldId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["cloud-console", "world-drift-summary"],
      }),
      queryClient.invalidateQueries({ queryKey: ["cloud-console", "jobs"] }),
    ]);
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      cloudAdminApi.updateWorldWithMeta(worldId, {
        phone,
        name,
        status: draftStatus,
        provisionStrategy,
        providerKey,
        providerRegion,
        providerZone,
        apiBaseUrl,
        adminUrl,
        note,
      }),
    onSuccess: async (response) => {
      await invalidateWorldQueries();
      showRequestScopedNotice(
        showNotice,
        createRequestScopedNotice(
          "World settings saved.",
          "success",
          response.requestId,
        ),
      );
    },
    onError: (error) => {
      showCloudAdminErrorNotice(showNotice, error);
    },
  });
  const worldActionMutation = useMutation({
    mutationFn: (action: WorldLifecycleAction) =>
      performWorldLifecycleActionWithMeta(worldId, action),
    onSuccess: async (response, action) => {
      await invalidateWorldQueries();
      if (action === "suspend" || action === "retry") {
        setConfirmAction(null);
      }
      showRequestScopedNotice(
        showNotice,
        createRequestScopedNotice(
          createWorldActionLabel(action, response.data),
          "success",
          response.requestId,
        ),
      );
    },
    onError: (error, action) => {
      if (requiresWorldActionConfirmation(action)) {
        setConfirmAction(null);
      }
      showCloudAdminErrorNotice(showNotice, error);
    },
  });
  const rotateCallbackTokenMutation = useMutation({
    mutationFn: () => cloudAdminApi.rotateWorldCallbackTokenWithMeta(worldId),
    onSuccess: async (response) => {
      await invalidateWorldQueries();
      setConfirmAction(null);
      showRequestScopedNotice(
        showNotice,
        createRequestScopedNotice(
          "Callback token rotated.",
          "success",
          response.requestId,
        ),
      );
    },
    onError: (error) => {
      setConfirmAction(null);
      showCloudAdminErrorNotice(showNotice, error);
    },
  });

  const world = worldQuery.data;
  const instance = instanceQuery.data;
  const bootstrapConfig = bootstrapConfigQuery.data;
  const runtimeStatus = runtimeStatusQuery.data;
  const alertSummary = alertSummaryQuery.data;
  const currentAlert = alertSummary?.item ?? null;
  const jobs = jobsQuery.data?.items ?? [];
  const now = Date.now();
  const jobSummaryFallback: CloudWorldLifecycleJobAggregateSummary = {
    totalJobs: jobs.length,
    activeJobs: 0,
    failedJobs: 0,
    supersededJobs: 0,
    queueState: {
      runningNow: 0,
      leaseExpired: 0,
      delayed: 0,
    },
  };
  for (const job of jobs) {
    if (job.status === "pending" || job.status === "running") {
      jobSummaryFallback.activeJobs += 1;
    }
    if (job.status === "failed") {
      jobSummaryFallback.failedJobs += 1;
    }
    if (getJobAuditBadgeLabel(job) !== null) {
      jobSummaryFallback.supersededJobs += 1;
    }
  }
  for (const group of groupJobsByQueueState(jobs, now)) {
    if (group.state.key === "running_now") {
      jobSummaryFallback.queueState.runningNow = group.jobs.length;
    } else if (group.state.key === "lease_expired") {
      jobSummaryFallback.queueState.leaseExpired = group.jobs.length;
    } else if (group.state.key === "delayed") {
      jobSummaryFallback.queueState.delayed = group.jobs.length;
    }
  }
  const jobSummary = jobSummaryQuery.data;
  const jobSummaryCards = [
    {
      key: "active",
      label: t("Active jobs"),
      count: jobSummary?.activeJobs ?? jobSummaryFallback.activeJobs,
    },
    {
      key: "failed",
      label: t("Failed jobs"),
      count: jobSummary?.failedJobs ?? jobSummaryFallback.failedJobs,
    },
    {
      key: "superseded",
      label: t("Superseded jobs"),
      count: jobSummary?.supersededJobs ?? jobSummaryFallback.supersededJobs,
    },
    {
      key: "running_now",
      label: t("Running jobs"),
      count:
        jobSummary?.queueState.runningNow ??
        jobSummaryFallback.queueState.runningNow,
    },
    {
      key: "lease_expired",
      label: t("Lease expired jobs"),
      count:
        jobSummary?.queueState.leaseExpired ??
        jobSummaryFallback.queueState.leaseExpired,
    },
    {
      key: "delayed",
      label: t("Delayed jobs"),
      count:
        jobSummary?.queueState.delayed ?? jobSummaryFallback.queueState.delayed,
    },
  ] as const;
  const visibleJobs = [...jobs]
    .filter((job) => matchesQueueStateFilter(job, queueStateFilter, now))
    .sort((left, right) => compareNewest(left.updatedAt, right.updatedAt));
  const groupedJobs = groupJobsByQueueState(visibleJobs, now);
  const providers = providersQuery.data ?? [];
  const providerOptions = buildProviderOptions(providers, providerKey);
  const selectedProvider = findProviderByKey(providerOptions, providerKey);
  async function copyValue(text: string, successMessage: string) {
    const copied = await copyTextToClipboard(text);
    showNotice(
      copied ? successMessage : "Clipboard copy failed in this environment.",
      copied ? "success" : "danger",
    );
  }

  function handleProviderKeyChange(nextProviderKey: string) {
    const nextProvider = findProviderByKey(providers, nextProviderKey);
    const previousProvider = findProviderByKey(providers, providerKey);

    setProviderKey(nextProviderKey);
    if (!nextProvider) {
      return;
    }

    setProvisionStrategy(nextProvider.provisionStrategy);

    if (
      !providerRegion ||
      providerRegion === (previousProvider?.defaultRegion ?? "")
    ) {
      setProviderRegion(nextProvider.defaultRegion ?? "");
    }
    if (
      !providerZone ||
      providerZone === (previousProvider?.defaultZone ?? "")
    ) {
      setProviderZone(nextProvider.defaultZone ?? "");
    }
  }

  useEffect(() => {
    if (!world) {
      return;
    }

    setDraftStatus(world.status);
    setPhone(world.phone);
    setName(world.name);
    setProvisionStrategy(world.provisionStrategy ?? "");
    setProviderKey(resolveCanonicalProviderKey(world.providerKey));
    setProviderRegion(world.providerRegion ?? "");
    setProviderZone(world.providerZone ?? "");
    setApiBaseUrl(world.apiBaseUrl ?? "");
    setAdminUrl(world.adminUrl ?? "");
    setNote(world.note ?? "");
    setFormHydrated(true);
  }, [world]);

  if (worldQuery.isError) {
    return <CloudAdminErrorBlock error={worldQuery.error} />;
  }

  if (!world) {
    return (
      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5">
        {t("Loading world...")}
      </div>
    );
  }

  const actionPending =
    worldActionMutation.isPending ||
    rotateCallbackTokenMutation.isPending;
  const allowedActions = new Set(
    listAllowedWorldActions(world.status, ALL_WORLD_LIFECYCLE_ACTIONS),
  );
  const disabledDetailActions = ALL_WORLD_LIFECYCLE_ACTIONS.filter(
    (action) => !allowedActions.has(action),
  );
  const pendingWorldAction = worldActionMutation.isPending
    ? worldActionMutation.variables
    : null;
  const confirmLifecycleAction =
    confirmAction && confirmAction !== "rotate-callback-token"
      ? confirmAction
      : null;
  const sharedConfirmCopy =
    confirmLifecycleAction
      ? createWorldActionConfirmationCopy(confirmLifecycleAction, world)
      : null;
  let activeConfirm: {
    title: string;
    description: string;
    confirmLabel: string;
    pendingLabel: string;
    danger: boolean;
    pending: boolean;
    onConfirm: () => void;
  } | null = null;
  if (confirmLifecycleAction && sharedConfirmCopy) {
    const action = confirmLifecycleAction;
    activeConfirm = {
      ...sharedConfirmCopy,
      pending:
        worldActionMutation.isPending &&
        worldActionMutation.variables === action,
      onConfirm: () => worldActionMutation.mutate(action),
    };
  } else if (confirmAction === "rotate-callback-token") {
    activeConfirm = {
      title: t("Rotate the callback token?"),
      description: t(
        "Existing bootstrap packages and runtime env overlays will become stale until operators redeploy the updated token.",
      ),
      confirmLabel: t("Rotate token"),
      pendingLabel: t("Rotating..."),
      danger: true,
      pending: rotateCallbackTokenMutation.isPending,
      onConfirm: () => rotateCallbackTokenMutation.mutate(),
    };
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold text-[color:var(--text-primary)]">
                {world.name}
              </div>
              <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
                {world.phone}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                {world.status}
              </div>
            </div>

            <WorldLifecycleActionButtons
              actions={ALL_WORLD_LIFECYCLE_ACTIONS}
              world={world}
              pendingAction={pendingWorldAction}
              disabled={actionPending}
              disabledActions={disabledDetailActions}
              onAction={(action) => {
                if (requiresWorldActionConfirmation(action)) {
                  setConfirmAction(action);
                  return;
                }

                worldActionMutation.mutate(action);
              }}
              className="flex flex-wrap gap-2"
              buttonClassName={SECONDARY_ACTION_BUTTON}
            />
          </div>

          <div className="mt-3 text-xs leading-6 text-[color:var(--text-muted)]">
            {t(
              "Resume is available for worlds that still need to move back toward running, including sleeping, failed, queued, and stopping states. Suspend is limited to worlds that are currently active. Retry is reserved for failed or in-flight lifecycle states.",
            )}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span>{t("Phone")}</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span>{t("World name")}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span>{t("Status")}</span>
              <select
                value={draftStatus}
                onChange={(event) =>
                  setDraftStatus(
                    event.target.value as CloudWorldLifecycleStatus,
                  )
                }
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              >
                {WORLD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span>{t("Provision strategy")}</span>
              <input
                value={provisionStrategy}
                onChange={(event) => setProvisionStrategy(event.target.value)}
                placeholder={selectedProvider?.provisionStrategy ?? "mock"}
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span>{t("Provider key")}</span>
              <select
                value={providerKey}
                onChange={(event) =>
                  handleProviderKeyChange(event.target.value)
                }
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              >
                {!providerKey ? (
                  <option value="">{t("Select provider")}</option>
                ) : null}
                {providerOptions.map((provider) => (
                  <option key={provider.key} value={provider.key}>
                    {localizeProviderLabel(provider.key, provider.label, locale)} ({provider.key})
                  </option>
                ))}
              </select>
            </label>

            {providersQuery.isError && providersQuery.error instanceof Error ? (
              <CloudAdminErrorBlock error={providersQuery.error} />
            ) : null}

            {selectedProvider ? (
              <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  {t("Provider profile")}
                </div>
                <div className="mt-2 font-medium text-[color:var(--text-primary)]">
                  {localizeProviderLabel(selectedProvider.key, selectedProvider.label, locale)}
                </div>
                <div className="mt-1 leading-6">
                  {localizeProviderDescription(selectedProvider.key, selectedProvider.description, locale)}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    {t("Deployment")}: {selectedProvider.deploymentMode}
                  </div>
                  <div>
                    {t("Default region")}:{" "}
                    {formatOptional(selectedProvider.defaultRegion)}
                  </div>
                  <div>
                    {t("Default zone")}:{" "}
                    {formatOptional(selectedProvider.defaultZone)}
                  </div>
                  <div>
                    {t("Managed lifecycle")}:{" "}
                    {selectedProvider.capabilities.managedLifecycle
                      ? t("Yes")
                      : t("No")}
                  </div>
                  <div>
                    {t("Managed provisioning")}:{" "}
                    {selectedProvider.capabilities.managedProvisioning
                      ? t("Yes")
                      : t("No")}
                  </div>
                  <div>
                    {t("Snapshots")}:{" "}
                    {selectedProvider.capabilities.snapshots
                      ? t("Yes")
                      : t("No")}
                  </div>
                </div>
              </div>
            ) : providersQuery.isLoading ? (
              <div className="text-sm text-[color:var(--text-muted)]">
                {t("Loading provider catalog...")}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span>{t("Provider region")}</span>
                <input
                  value={providerRegion}
                  onChange={(event) => setProviderRegion(event.target.value)}
                  placeholder="mock-local"
                  className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span>{t("Provider zone")}</span>
                <input
                  value={providerZone}
                  onChange={(event) => setProviderZone(event.target.value)}
                  placeholder="mock-a"
                  className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span>{t("World API base URL")}</span>
              <input
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder="https://world-api.example.com"
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span>{t("World admin URL")}</span>
              <input
                value={adminUrl}
                onChange={(event) => setAdminUrl(event.target.value)}
                placeholder="https://world-admin.example.com"
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span>{t("Ops note")}</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 text-[color:var(--text-primary)]"
              />
            </label>

            <button
              type="button"
              disabled={
                updateMutation.isPending ||
                !formHydrated ||
                Boolean(validationMessage)
              }
              onClick={() => updateMutation.mutate()}
              className="rounded-xl bg-[color:var(--surface-secondary)] px-4 py-3 text-[color:var(--text-primary)] hover:bg-[color:var(--surface-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateMutation.isPending ? t("Saving...") : t("Save world")}
            </button>

            {validationMessage ? (
              <ErrorBlock message={validationMessage} />
            ) : null}

          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              {t("Lifecycle summary")}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: t("Desired state"),
                  value: world.desiredState ?? "running",
                },
                { label: t("Health"), value: world.healthStatus ?? "unknown" },
                {
                  label: t("Strategy"),
                  value: world.provisionStrategy ?? "unknown",
                },
                { label: t("Provider"), value: world.providerKey ?? "unknown" },
                { label: t("Region"), value: world.providerRegion ?? "unknown" },
                { label: t("Zone"), value: world.providerZone ?? "unknown" },
                { label: t("Failure code"), value: world.failureCode ?? "none" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3"
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                    {item.label}
                  </div>
                  <div className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-sm text-[color:var(--text-secondary)]">
              <div>
                {t("Health message")}: {formatOptional(world.healthMessage)}
              </div>
              <div>
                {t("Failure message")}: {formatOptional(world.failureMessage)}
              </div>
              <div>API: {formatOptional(world.apiBaseUrl)}</div>
              <div>
                {t("Admin")}: {formatOptional(world.adminUrl)}
              </div>
              <div>
                {t("Last accessed")}: {formatDateTime(world.lastAccessedAt)}
              </div>
              <div>
                {t("Last interactive")}:{" "}
                {formatDateTime(world.lastInteractiveAt)}
              </div>
              <div>
                {t("Last booted")}: {formatDateTime(world.lastBootedAt)}
              </div>
              <div>
                {t("Last heartbeat")}: {formatDateTime(world.lastHeartbeatAt)}
              </div>
              <div>
                {t("Last suspended")}: {formatDateTime(world.lastSuspendedAt)}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {t("Alert status")}
                </div>
                <div className="mt-1 text-xs leading-6 text-[color:var(--text-muted)]">
                  {t(
                    "Current alert severity after applying retry and stale-heartbeat thresholds.",
                  )}
                </div>
              </div>

              {currentAlert ? (
                <div
                  className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${getAttentionTone(currentAlert.severity)}`}
                >
                  {currentAlert.severity}
                </div>
              ) : null}
            </div>

            {alertSummaryQuery.isError &&
            alertSummaryQuery.error instanceof Error ? (
              <div className="mt-4">
                <CloudAdminErrorBlock error={alertSummaryQuery.error} />
              </div>
            ) : null}

            {currentAlert ? (
              <div className="mt-4 space-y-3 text-sm text-[color:var(--text-secondary)]">
                <div>{currentAlert.message}</div>
                <div>{t("Reason:")} {currentAlert.reason}</div>
                <div>
                  {t("Escalated:")} {currentAlert.escalated ? t("Yes") : t("No")}
                </div>
                <div>
                  {t("Escalation reason:")}{" "}
                  {getEscalationLabel(currentAlert.escalationReason)}
                </div>
                <div>{t("Retry count:")} {currentAlert.retryCount}</div>
                <div>
                  {t("Stale heartbeat seconds:")}{" "}
                  {typeof currentAlert.staleHeartbeatSeconds === "number"
                    ? currentAlert.staleHeartbeatSeconds
                    : t("Not stale")}
                </div>
                <div>
                  {t("Retry threshold:")}{" "}
                  {alertSummary?.thresholds.retryCount ?? t("Not set")}
                </div>
                <div>
                  {t("Critical stale threshold:")}{" "}
                  {alertSummary?.thresholds.criticalHeartbeatStaleSeconds
                    ? `${alertSummary.thresholds.criticalHeartbeatStaleSeconds}s`
                    : t("Disabled")}
                </div>
              </div>
            ) : alertSummaryQuery.isLoading ? (
              <div className="mt-4 text-sm text-[color:var(--text-muted)]">
                {t("Loading alert status...")}
              </div>
            ) : (
              <div className="mt-4 text-sm text-[color:var(--text-muted)]">
                {t("No current alert. This world is below escalation thresholds.")}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              {t("Instance")}
            </div>
            {instanceQuery.isError && instanceQuery.error instanceof Error ? (
              <div className="mt-4">
                <CloudAdminErrorBlock error={instanceQuery.error} />
              </div>
            ) : null}

            {instance ? (
              <div className="mt-4 space-y-2 text-sm text-[color:var(--text-secondary)]">
                <div>
                  {t("Name")}: {instance.name}
                </div>
                <div>
                  {t("Power state")}: {instance.powerState}
                </div>
                <div>
                  {t("Provider instance")}:{" "}
                  {formatOptional(instance.providerInstanceId)}
                </div>
                <div>
                  {t("Provider volume")}:{" "}
                  {formatOptional(instance.providerVolumeId)}
                </div>
                <div>
                  {t("Provider snapshot")}:{" "}
                  {formatOptional(instance.providerSnapshotId)}
                </div>
                <div>
                  {t("Private IP")}: {formatOptional(instance.privateIp)}
                </div>
                <div>
                  {t("Public IP")}: {formatOptional(instance.publicIp)}
                </div>
                <div>
                  {t("Region")}: {formatOptional(instance.region)}
                </div>
                <div>
                  {t("Zone")}: {formatOptional(instance.zone)}
                </div>
                <div>
                  {t("Image")}: {formatOptional(instance.imageId)}
                </div>
                <div>
                  {t("Flavor")}: {formatOptional(instance.flavor)}
                </div>
                <div>
                  {t("Disk")}: {instance.diskSizeGb ?? t("Not set")} GB
                </div>
                <div>
                  {t("Bootstrapped")}:{" "}
                  {formatDateTime(instance.bootstrappedAt)}
                </div>
                <div>
                  {t("Last heartbeat")}:{" "}
                  {formatDateTime(instance.lastHeartbeatAt)}
                </div>
                <div>
                  {t("Last operation")}:{" "}
                  {formatDateTime(instance.lastOperationAt)}
                </div>
                <div>
                  {t("Created")}: {formatDateTime(instance.createdAt)}
                </div>
                <div>
                  {t("Updated")}: {formatDateTime(instance.updatedAt)}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-[color:var(--text-muted)]">
                {t("No instance record exists yet. Provisioning will create one automatically.")}
              </div>
            )}

            {instance?.launchConfig ? (
              <label className="mt-4 grid gap-2 text-sm">
                <span className="text-[color:var(--text-primary)]">
                  {t("Launch config snapshot")}
                </span>
                <textarea
                  readOnly
                  value={Object.entries(instance.launchConfig)
                    .map(([key, value]) => `${key}=${value}`)
                    .join("\n")}
                  rows={6}
                  className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 font-mono text-xs text-[color:var(--text-primary)]"
                />
              </label>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {t("Runtime observation")}
                </div>
                <div className="mt-1 text-xs leading-6 text-[color:var(--text-muted)]">
                  {t(
                    "Provider-side deployment status observed from the current compute adapter.",
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => runtimeStatusQuery.refetch()}
                disabled={runtimeStatusQuery.isFetching}
                className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-secondary)] px-4 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-tertiary)] disabled:opacity-60"
              >
                {runtimeStatusQuery.isFetching
                  ? t("Refreshing...")
                  : t("Refresh status")}
              </button>
            </div>

            {runtimeStatusQuery.isError &&
            runtimeStatusQuery.error instanceof Error ? (
              <div className="mt-4">
                <CloudAdminErrorBlock error={runtimeStatusQuery.error} />
              </div>
            ) : null}

            {runtimeStatus ? (
              <div className="mt-4 space-y-2 text-sm text-[color:var(--text-secondary)]">
                <div>
                  {t("Deployment state")}: {runtimeStatus.deploymentState}
                </div>
                <div>
                  {t("Deployment mode")}:{" "}
                  {formatOptional(runtimeStatus.deploymentMode)}
                </div>
                <div>
                  {t("Executor mode")}:{" "}
                  {formatOptional(runtimeStatus.executorMode)}
                </div>
                <div>
                  {t("Remote host")}: {formatOptional(runtimeStatus.remoteHost)}
                </div>
                <div>
                  {t("Remote path")}:{" "}
                  {formatOptional(runtimeStatus.remoteDeployPath)}
                </div>
                <div>
                  {t("Project")}: {formatOptional(runtimeStatus.projectName)}
                </div>
                <div>
                  {t("Container")}:{" "}
                  {formatOptional(runtimeStatus.containerName)}
                </div>
                <div>
                  {t("Raw status")}: {formatOptional(runtimeStatus.rawStatus)}
                </div>
                <div>
                  {t("Observed at")}: {formatDateTime(runtimeStatus.observedAt)}
                </div>
                <div>
                  {t("Provider message")}:{" "}
                  {formatOptional(runtimeStatus.providerMessage)}
                </div>
              </div>
            ) : runtimeStatusQuery.isLoading ? (
              <div className="mt-4 text-sm text-[color:var(--text-muted)]">
                {t("Loading runtime status...")}
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {t("Bootstrap package")}
                </div>
                <div className="mt-1 text-xs leading-6 text-[color:var(--text-muted)]">
                  {t(
                    "Use this env overlay when deploying the user's dedicated world runtime.",
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {bootstrapConfig ? (
                  <button
                    type="button"
                    onClick={() =>
                      void copyValue(
                        formatBootstrapCallbackEndpoints(
                          bootstrapConfig.callbackEndpoints,
                        ),
                        "Callback endpoints copied.",
                      )
                    }
                    className={SECONDARY_ACTION_BUTTON}
                  >
                    {t("Copy endpoints")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => setConfirmAction("rotate-callback-token")}
                  className={SECONDARY_ACTION_BUTTON}
                >
                  {rotateCallbackTokenMutation.isPending
                    ? t("Rotating...")
                    : t("Rotate callback token")}
                </button>
              </div>
            </div>

            {bootstrapConfigQuery.isError &&
            bootstrapConfigQuery.error instanceof Error ? (
              <div className="mt-4">
                <CloudAdminErrorBlock error={bootstrapConfigQuery.error} />
              </div>
            ) : null}

            {bootstrapConfig ? (
              <div className="mt-4 grid gap-4">
                <div className="space-y-2 text-sm text-[color:var(--text-secondary)]">
                  <div>
                    {t("Provider:")}{" "}
                    {formatOptional(
                      localizeProviderLabel(
                        bootstrapConfig.providerKey,
                        bootstrapConfig.providerLabel ??
                          bootstrapConfig.providerKey,
                        locale,
                      ),
                    )}
                  </div>
                  <div>
                    {t("Deployment:")} {formatOptional(bootstrapConfig.deploymentMode)}
                  </div>
                  <div>
                    {t("Executor:")} {formatOptional(bootstrapConfig.executorMode)}
                  </div>
                  <div>
                    {t("Cloud platform:")} {bootstrapConfig.cloudPlatformBaseUrl}
                  </div>
                  <div>
                    {t("Suggested API:")}{" "}
                    {formatOptional(bootstrapConfig.suggestedApiBaseUrl)}
                  </div>
                  <div>
                    {t("Suggested admin:")}{" "}
                    {formatOptional(bootstrapConfig.suggestedAdminUrl)}
                  </div>
                  <div>{t("Image:")} {formatOptional(bootstrapConfig.image)}</div>
                  <div>
                    {t("Container:")} {formatOptional(bootstrapConfig.containerName)}
                  </div>
                  <div>
                    {t("Volume:")} {formatOptional(bootstrapConfig.volumeName)}
                  </div>
                  <div>
                    {t("Project:")} {formatOptional(bootstrapConfig.projectName)}
                  </div>
                  <div>
                    {t("Remote path:")}{" "}
                    {formatOptional(bootstrapConfig.remoteDeployPath)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      {t("Callback token:")}{" "}
                      {bootstrapConfig.callbackToken || t("Not set")}
                    </span>
                    {bootstrapConfig.callbackToken ? (
                      <button
                        type="button"
                        onClick={() =>
                          void copyValue(
                            bootstrapConfig.callbackToken,
                            "Callback token copied.",
                          )
                        }
                        aria-label={t("Copy callback token")}
                        className="rounded-lg border border-[color:var(--border-faint)] px-2 py-1 text-xs text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                      >
                        {t("Copy token")}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-[color:var(--text-secondary)]">
                  <div>
                    {t("Bootstrap endpoint:")}{" "}
                    {bootstrapConfig.callbackEndpoints.bootstrap}
                  </div>
                  <div>
                    {t("Heartbeat endpoint:")}{" "}
                    {bootstrapConfig.callbackEndpoints.heartbeat}
                  </div>
                  <div>
                    {t("Activity endpoint:")}{" "}
                    {bootstrapConfig.callbackEndpoints.activity}
                  </div>
                  <div>
                    {t("Health endpoint:")} {bootstrapConfig.callbackEndpoints.health}
                  </div>
                  <div>
                    {t("Fail endpoint:")} {bootstrapConfig.callbackEndpoints.fail}
                  </div>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="flex items-center justify-between gap-3 text-[color:var(--text-primary)]">
                    <span>{t("Runtime env overlay")}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue(
                          bootstrapConfig.envFileContent,
                          "Runtime env overlay copied.",
                        )
                      }
                      aria-label={t("Copy runtime env overlay")}
                      className="rounded-lg border border-[color:var(--border-faint)] px-2 py-1 text-xs font-normal text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                    >
                      {t("Copy env")}
                    </button>
                  </span>
                  <textarea
                    readOnly
                    value={bootstrapConfig.envFileContent}
                    rows={6}
                    className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 font-mono text-xs text-[color:var(--text-primary)]"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="flex items-center justify-between gap-3 text-[color:var(--text-primary)]">
                    <span>{t("Docker compose snippet")}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void copyValue(
                          bootstrapConfig.dockerComposeSnippet,
                          "Docker compose snippet copied.",
                        )
                      }
                      aria-label={t("Copy docker compose snippet")}
                      className="rounded-lg border border-[color:var(--border-faint)] px-2 py-1 text-xs font-normal text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
                    >
                      {t("Copy compose")}
                    </button>
                  </span>
                  <textarea
                    readOnly
                    value={bootstrapConfig.dockerComposeSnippet}
                    rows={8}
                    className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3 font-mono text-xs text-[color:var(--text-primary)]"
                  />
                </label>

                {bootstrapConfig.notes.length ? (
                  <div className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      {t("Ops notes")}
                    </div>
                    <div className="mt-2 space-y-2 text-sm text-[color:var(--text-secondary)]">
                      {bootstrapConfig.notes.map((note, index) => (
                        <div key={`note-${index}`}>{note}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : bootstrapConfigQuery.isLoading ? (
              <div className="mt-4 text-sm text-[color:var(--text-muted)]">
                {t("Loading bootstrap package...")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]">
        <div className="text-sm font-semibold text-[color:var(--text-primary)]">
          {t("Recent lifecycle jobs")}
        </div>
        <div className="mt-1 text-xs leading-6 text-[color:var(--text-muted)]">
          {t(
            "Jobs show how this world moved through provision, resume, and suspend work.",
          )}
        </div>

        {jobsQuery.isError && jobsQuery.error instanceof Error ? (
          <div className="mt-4">
            <CloudAdminErrorBlock error={jobsQuery.error} />
          </div>
        ) : null}

        {jobSummaryQuery.isError && jobSummaryQuery.error instanceof Error ? (
          <div className="mt-4">
            <CloudAdminErrorBlock error={jobSummaryQuery.error} />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {jobSummaryCards.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] px-4 py-3"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  {item.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                  {item.count}
                </div>
              </div>
            ))}
          </div>

          <select
            value={queueStateFilter}
            onChange={(event) =>
              setQueueStateFilter(event.target.value as QueueStateFilter)
            }
            className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-2 text-sm text-[color:var(--text-primary)]"
          >
            {QUEUE_STATE_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <JobsPermalinkLink
            search={buildCompactJobsRouteSearch({
              worldId,
              queueState: queueStateFilter,
            })}
            className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-soft)]"
          >
            {t("Open full queue")}
          </JobsPermalinkLink>
        </div>

        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          {t(
            "Queue totals reflect all jobs for this world, not just the recent 20 jobs below.",
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:var(--border-faint)]">
          <table className="min-w-[52rem] border-collapse text-left text-sm">
            <thead className="bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">{t("Job")}</th>
                <th className="px-4 py-3">{t("Status")}</th>
                <th className="px-4 py-3">{t("Attempt")}</th>
                <th className="px-4 py-3">{t("Lease")}</th>
                <th className="px-4 py-3">{t("Updated")}</th>
                <th className="px-4 py-3">{t("Outcome")}</th>
              </tr>
            </thead>
            <tbody>
              {groupedJobs.flatMap((group) => [
                <tr
                  key={`group-${group.state.key}`}
                  className="border-t border-[color:var(--border-faint)] bg-[color:var(--surface-soft)]"
                >
                  <td colSpan={6} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${group.state.tone}`}
                      >
                        {group.state.label}
                      </span>
                      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                        {formatCloudConsoleJobsGroupCount(group.jobs.length, locale)}
                      </span>
                    </div>
                  </td>
                </tr>,
                ...group.jobs.map((job) => {
                  const auditBadgeLabel = getJobAuditBadgeLabel(job);

                  return (
                    <tr
                      key={job.id}
                      className="border-t border-[color:var(--border-faint)]"
                    >
                      <td className="px-4 py-3 text-[color:var(--text-primary)]">
                        <div>{job.jobType}</div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {job.id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getJobStatusTone(
                            job.status,
                          )}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                        {job.attempt} / {job.maxAttempts}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                        <div>{formatLeaseOwner(job.leaseOwner)}</div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {formatCloudConsoleJobLeaseRemaining(
                            formatDuration(job.leaseRemainingSeconds),
                            locale,
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {formatCloudConsoleJobLeaseExpires(
                            formatDateTime(job.leaseExpiresAt),
                            locale,
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {formatCloudConsoleJobLeaseAvailable(
                            formatDateTime(job.availableAt),
                            locale,
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                        {formatDateTime(job.updatedAt)}
                      </td>
                      <td className="max-w-[18rem] px-4 py-3 text-[color:var(--text-secondary)]">
                        {auditBadgeLabel ? (
                          <div className="mb-2">
                            <span className={JOB_AUDIT_BADGE_CLASS_NAME}>
                              {auditBadgeLabel}
                            </span>
                          </div>
                        ) : null}
                        <div>{describeJobResult(job)}</div>
                      </td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>

          {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 ? (
            <div className="p-4 text-sm text-[color:var(--text-muted)]">
              {t("No jobs recorded for this world yet.")}
            </div>
          ) : null}

          {!jobsQuery.isLoading &&
          !jobsQuery.isError &&
          jobs.length > 0 &&
          visibleJobs.length === 0 ? (
            <div className="p-4 text-sm text-[color:var(--text-muted)]">
              {t("No jobs match the selected queue filter.")}
            </div>
          ) : null}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={Boolean(activeConfirm)}
        title={activeConfirm?.title ?? ""}
        description={activeConfirm?.description ?? ""}
        confirmLabel={activeConfirm?.confirmLabel}
        pendingLabel={activeConfirm?.pendingLabel}
        danger={activeConfirm?.danger}
        pending={activeConfirm?.pending}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => activeConfirm?.onConfirm()}
      />
    </section>
  );
}
