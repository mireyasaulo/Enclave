import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  buyCar,
  catchUpOffline,
  cloneState,
  collectAllOwnSlots,
  collectFromOwnSlot,
  createInitialState,
  fineAllNpcsOnPlayerLot,
  fineNpcOnPlayerSlot,
  kickNpcOffPlayerSlot,
  parkOwnedCarHome,
  parkPlayerInNpcLot,
  recallPlayerFromNpcLot,
  tickOnline,
} from "./parking-war-engine";
import {
  loadParkingWarState,
  resetParkingWarState,
  saveParkingWarState,
} from "./parking-war-storage";
import type { CarTier, ParkingWarState } from "./parking-war-types";

type Action =
  | { type: "tick"; nowMs: number }
  | { type: "collect"; slotIndex: number; nowMs: number }
  | { type: "collect-all"; nowMs: number }
  | { type: "fine"; slotIndex: number; nowMs: number }
  | { type: "fine-all"; nowMs: number }
  | { type: "kick"; slotIndex: number; nowMs: number }
  | {
      type: "park-in-npc";
      npcId: string;
      slotIndex: number;
      carId: string;
      nowMs: number;
    }
  | { type: "recall"; npcId: string; slotIndex: number; nowMs: number }
  | { type: "park-home"; carId: string; nowMs: number }
  | { type: "buy"; tier: CarTier; nowMs: number }
  | { type: "reset"; nowMs: number };

function reducer(state: ParkingWarState, action: Action): ParkingWarState {
  if (action.type === "reset") {
    return createInitialState(action.nowMs);
  }
  const next = cloneState(state);
  switch (action.type) {
    case "tick":
      tickOnline(next, action.nowMs);
      break;
    case "collect":
      collectFromOwnSlot(next, action.slotIndex, action.nowMs);
      break;
    case "collect-all":
      collectAllOwnSlots(next, action.nowMs);
      break;
    case "fine":
      fineNpcOnPlayerSlot(next, action.slotIndex, action.nowMs);
      break;
    case "fine-all":
      fineAllNpcsOnPlayerLot(next, action.nowMs);
      break;
    case "kick":
      kickNpcOffPlayerSlot(next, action.slotIndex, action.nowMs);
      break;
    case "park-in-npc":
      parkPlayerInNpcLot(
        next,
        action.npcId,
        action.slotIndex,
        action.carId,
        action.nowMs,
      );
      break;
    case "recall":
      recallPlayerFromNpcLot(next, action.npcId, action.slotIndex, action.nowMs);
      break;
    case "park-home":
      parkOwnedCarHome(next, action.carId, action.nowMs);
      break;
    case "buy":
      buyCar(next, action.tier, action.nowMs);
      break;
  }
  return next;
}

function init(): ParkingWarState {
  const now = Date.now();
  const stored = loadParkingWarState();
  if (!stored) {
    const fresh = createInitialState(now);
    catchUpOffline(fresh, now);
    return fresh;
  }
  const next = cloneState(stored);
  catchUpOffline(next, now);
  return next;
}

export function useParkingWarState() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => saveParkingWarState(state), 500);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [state]);

  useEffect(() => {
    return () => {
      saveParkingWarState(state);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: "tick", nowMs: Date.now() });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        dispatch({ type: "tick", nowMs: Date.now() });
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const collect = useCallback(
    (slotIndex: number) =>
      dispatch({ type: "collect", slotIndex, nowMs: Date.now() }),
    [],
  );
  const collectAll = useCallback(
    () => dispatch({ type: "collect-all", nowMs: Date.now() }),
    [],
  );
  const fine = useCallback(
    (slotIndex: number) => dispatch({ type: "fine", slotIndex, nowMs: Date.now() }),
    [],
  );
  const fineAll = useCallback(
    () => dispatch({ type: "fine-all", nowMs: Date.now() }),
    [],
  );
  const kick = useCallback(
    (slotIndex: number) => dispatch({ type: "kick", slotIndex, nowMs: Date.now() }),
    [],
  );
  const parkInNpc = useCallback(
    (npcId: string, slotIndex: number, carId: string) =>
      dispatch({ type: "park-in-npc", npcId, slotIndex, carId, nowMs: Date.now() }),
    [],
  );
  const recall = useCallback(
    (npcId: string, slotIndex: number) =>
      dispatch({ type: "recall", npcId, slotIndex, nowMs: Date.now() }),
    [],
  );
  const parkHome = useCallback(
    (carId: string) => dispatch({ type: "park-home", carId, nowMs: Date.now() }),
    [],
  );
  const buy = useCallback(
    (tier: CarTier) => dispatch({ type: "buy", tier, nowMs: Date.now() }),
    [],
  );
  const reset = useCallback(() => {
    resetParkingWarState();
    dispatch({ type: "reset", nowMs: Date.now() });
  }, []);

  return {
    state,
    actions: {
      collect,
      collectAll,
      fine,
      fineAll,
      kick,
      parkInNpc,
      recall,
      parkHome,
      buy,
      reset,
    },
  };
}
