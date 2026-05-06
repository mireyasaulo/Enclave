import { useSyncExternalStore } from "react";

const STORAGE_KEY = "yinjie-admin-runtime";

export type AdminRuntimeState = {
  apiBaseUrl?: string;
  cloudApiBaseUrl?: string;
  accessToken?: string;
  cloudPhone?: string;
  cloudEmail?: string;
  cloudWorldId?: string;
  cloudAccessSessionId?: string;
};

const listeners = new Set<() => void>();

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPersisted(): AdminRuntimeState {
  const storage = getStorage();
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as AdminRuntimeState;
    }
  } catch {
    // ignore
  }

  return {};
}

function writePersisted(state: AdminRuntimeState) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (Object.keys(state).length === 0) {
    storage.removeItem(STORAGE_KEY);
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let runtime: AdminRuntimeState = readPersisted();

function emit() {
  listeners.forEach((listener) => listener());
}

function compact(state: AdminRuntimeState): AdminRuntimeState {
  const result: AdminRuntimeState = {};
  for (const key of Object.keys(state) as (keyof AdminRuntimeState)[]) {
    const value = state[key];
    if (value !== undefined && value !== null && value !== "") {
      result[key] = value;
    }
  }
  return result;
}

export function getAdminRuntime(): AdminRuntimeState {
  return runtime;
}

export function setAdminRuntime(next: Partial<AdminRuntimeState>): AdminRuntimeState {
  runtime = compact({ ...runtime, ...next });
  writePersisted(runtime);
  emit();
  return runtime;
}

export function clearAdminRuntimeSession() {
  runtime = {};
  writePersisted(runtime);
  emit();
}

export function subscribeAdminRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAdminRuntime(): AdminRuntimeState {
  return useSyncExternalStore(subscribeAdminRuntime, getAdminRuntime, getAdminRuntime);
}
