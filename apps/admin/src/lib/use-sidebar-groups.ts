import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "adminSidebarGroups";

type GroupState = Record<string, boolean>;

function readStored(): GroupState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as GroupState;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeStored(state: GroupState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function useSidebarGroups(
  groupIds: readonly string[],
  activeGroupId: string | null,
) {
  const [state, setState] = useState<GroupState>(() => {
    const stored = readStored();
    const initial: GroupState = {};
    for (const id of groupIds) {
      initial[id] = stored[id] !== false;
    }
    return initial;
  });

  useEffect(() => {
    writeStored(state);
  }, [state]);

  const isOpen = useCallback(
    (id: string) => {
      if (id === activeGroupId) return true;
      return state[id] !== false;
    },
    [state, activeGroupId],
  );

  const toggle = useCallback((id: string) => {
    setState((prev) => ({ ...prev, [id]: prev[id] === false }));
  }, []);

  return { isOpen, toggle };
}
