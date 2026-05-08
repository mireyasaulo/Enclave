import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  backToIdle,
  cloneState,
  collectAll,
  collectStall,
  consumePermit,
  createInitialState,
  endRoundEarly,
  startRound,
  tick,
  upgradeStall,
  visitFriendStall,
} from "./night-market-engine";
import {
  loadNightMarketState,
  resetNightMarketState,
  saveNightMarketState,
} from "./night-market-storage";
import type { NightMarketState, StallKind } from "./night-market-types";

type Action =
  | { type: "tick"; nowMs: number }
  | { type: "start"; nowMs: number }
  | { type: "collect"; kind: StallKind; nowMs: number }
  | { type: "collect-all"; nowMs: number }
  | { type: "upgrade"; kind: StallKind; nowMs: number }
  | { type: "visit-friend"; nowMs: number }
  | { type: "use-permit"; nowMs: number }
  | { type: "end-early"; nowMs: number }
  | { type: "back-idle" }
  | { type: "reset"; nowMs: number };

function reducer(state: NightMarketState, action: Action): NightMarketState {
  if (action.type === "reset") return createInitialState(action.nowMs);
  const next = cloneState(state);
  switch (action.type) {
    case "tick":
      return tick(next, action.nowMs);
    case "start":
      return startRound(next, action.nowMs);
    case "collect":
      return collectStall(next, action.kind, action.nowMs);
    case "collect-all":
      return collectAll(next, action.nowMs);
    case "upgrade":
      return upgradeStall(next, action.kind, action.nowMs);
    case "visit-friend":
      return visitFriendStall(next, action.nowMs);
    case "use-permit":
      return consumePermit(next, action.nowMs);
    case "end-early":
      return endRoundEarly(next, action.nowMs);
    case "back-idle":
      return backToIdle(next);
  }
  return next;
}

function init(): NightMarketState {
  const now = Date.now();
  const stored = loadNightMarketState();
  if (!stored) return createInitialState(now);
  // 重新进入：进行中的局重置回 idle，但保留货款 / 摊位等级 / 周任务
  if (stored.status === "running") {
    return {
      ...stored,
      status: "idle",
      startedAtMs: null,
      endedAtMs: null,
      remainingMs: stored.remainingMs > 0 ? stored.remainingMs : 0,
      waves: [],
      lastTickAtMs: now,
    };
  }
  return { ...stored, lastTickAtMs: now };
}

export function useNightMarketState() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => saveNightMarketState(state), 500);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [state]);

  useEffect(() => {
    return () => {
      saveNightMarketState(state);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: "tick", nowMs: Date.now() });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const start = useCallback(
    () => dispatch({ type: "start", nowMs: Date.now() }),
    [],
  );
  const collect = useCallback(
    (kind: StallKind) => dispatch({ type: "collect", kind, nowMs: Date.now() }),
    [],
  );
  const collectAllAction = useCallback(
    () => dispatch({ type: "collect-all", nowMs: Date.now() }),
    [],
  );
  const upgrade = useCallback(
    (kind: StallKind) => dispatch({ type: "upgrade", kind, nowMs: Date.now() }),
    [],
  );
  const visitFriend = useCallback(
    () => dispatch({ type: "visit-friend", nowMs: Date.now() }),
    [],
  );
  const usePermit = useCallback(
    () => dispatch({ type: "use-permit", nowMs: Date.now() }),
    [],
  );
  const endEarly = useCallback(
    () => dispatch({ type: "end-early", nowMs: Date.now() }),
    [],
  );
  const backIdle = useCallback(() => dispatch({ type: "back-idle" }), []);
  const reset = useCallback(() => {
    resetNightMarketState();
    dispatch({ type: "reset", nowMs: Date.now() });
  }, []);

  return {
    state,
    actions: {
      start,
      collect,
      collectAll: collectAllAction,
      upgrade,
      visitFriend,
      usePermit,
      endEarly,
      backIdle,
      reset,
    },
  };
}
