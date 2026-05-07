import { NPC_OPPONENTS } from "./parking-war-data";
import type { ParkingWarState } from "./parking-war-types";

const STORAGE_KEY = "yinjie.parking-war.v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type AnyStored = {
  schemaVersion?: number;
  balance?: number;
  ownedCars?: ParkingWarState["ownedCars"];
  playerLot?: ParkingWarState["playerLot"];
  npcLots?: ParkingWarState["npcLots"];
  npcBalances?: ParkingWarState["npcBalances"];
  lastTickAtMs?: number;
  lastDailyBonusDateKey?: string;
  events?: ParkingWarState["events"];
  visitLog?: ParkingWarState["visitLog"];
};

function migrateToV2(input: AnyStored): ParkingWarState | null {
  if (!input) return null;
  const balance = typeof input.balance === "number" ? input.balance : 0;
  const ownedCars = input.ownedCars ?? [];
  const playerLot = input.playerLot;
  const npcLots = input.npcLots ?? {};
  if (!playerLot) return null;

  // 默认补齐每个 NPC 的余额（v1 没有这个字段）。
  const npcBalances: Record<string, number> = {};
  for (const npc of NPC_OPPONENTS) {
    npcBalances[npc.id] = input.npcBalances?.[npc.id] ?? npc.startingBalance;
  }

  return {
    schemaVersion: 2,
    balance,
    ownedCars,
    playerLot,
    npcLots,
    npcBalances,
    lastTickAtMs: input.lastTickAtMs ?? Date.now(),
    lastDailyBonusDateKey: input.lastDailyBonusDateKey ?? "",
    events: input.events ?? [],
    visitLog: input.visitLog ?? [],
  };
}

export function loadParkingWarState(): ParkingWarState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnyStored;
    if (parsed.schemaVersion === 2) return parsed as ParkingWarState;
    if (parsed.schemaVersion === 1) return migrateToV2(parsed);
    return null;
  } catch {
    return null;
  }
}

export function saveParkingWarState(state: ParkingWarState) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function resetParkingWarState() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
