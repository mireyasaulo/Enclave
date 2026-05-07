import type { WorldLifecycleJobSummary } from "@yinjie/contracts";
import { translateCloudConsoleTextForActiveLocale } from "./cloud-console-i18n";

export type QueueStateFilter =
  | "all"
  | "running_now"
  | "lease_expired"
  | "delayed";

type JobQueueStateKey = "running_now" | "lease_expired" | "delayed" | "other";

export type JobQueueState = {
  key: JobQueueStateKey;
  label: string;
  tone: string;
  sortOrder: number;
};

export const QUEUE_STATE_FILTER_VALUES: readonly QueueStateFilter[] = [
  "all",
  "running_now",
  "lease_expired",
  "delayed",
];

export function getQueueStateFilters(): Array<{
  value: QueueStateFilter;
  label: string;
}> {
  return [
    {
      value: "all",
      label: translateCloudConsoleTextForActiveLocale("queue: all"),
    },
    {
      value: "running_now",
      label: translateCloudConsoleTextForActiveLocale("queue: running"),
    },
    {
      value: "lease_expired",
      label: translateCloudConsoleTextForActiveLocale("queue: lease expired"),
    },
    {
      value: "delayed",
      label: translateCloudConsoleTextForActiveLocale("queue: delayed"),
    },
  ];
}

export function resolveQueueState(
  job: WorldLifecycleJobSummary,
  now = Date.now(),
): JobQueueState {
  const availableAtMs = job.availableAt
    ? new Date(job.availableAt).getTime()
    : Number.NaN;

  if (job.status === "running") {
    return {
      key: "running_now",
      label: translateCloudConsoleTextForActiveLocale("Running"),
      tone: "border-sky-300/50 bg-sky-50 text-sky-700",
      sortOrder: 0,
    };
  }

  if (job.failureCode === "lease_expired") {
    return {
      key: "lease_expired",
      label: translateCloudConsoleTextForActiveLocale("Lease expired"),
      tone: "border-rose-300/60 bg-rose-50 text-rose-700",
      sortOrder: 1,
    };
  }

  if (
    job.status === "pending" &&
    Number.isFinite(availableAtMs) &&
    availableAtMs > now
  ) {
    return {
      key: "delayed",
      label: translateCloudConsoleTextForActiveLocale("Delayed"),
      tone: "border-amber-300/50 bg-amber-50 text-amber-700",
      sortOrder: 2,
    };
  }

  return {
    key: "other",
    label: translateCloudConsoleTextForActiveLocale("Other"),
    tone: "border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]",
    sortOrder: 3,
  };
}

export function matchesQueueStateFilter(
  job: WorldLifecycleJobSummary,
  filter: QueueStateFilter,
  now = Date.now(),
) {
  if (filter === "all") {
    return true;
  }

  return resolveQueueState(job, now).key === filter;
}

export function groupJobsByQueueState(
  jobs: WorldLifecycleJobSummary[],
  now = Date.now(),
) {
  const groups = new Map<
    string,
    { state: JobQueueState; jobs: WorldLifecycleJobSummary[] }
  >();

  for (const job of jobs) {
    const state = resolveQueueState(job, now);
    const existing = groups.get(state.key);
    if (existing) {
      existing.jobs.push(job);
      continue;
    }

    groups.set(state.key, {
      state,
      jobs: [job],
    });
  }

  return [...groups.values()].sort(
    (left, right) => left.state.sortOrder - right.state.sortOrder,
  );
}
