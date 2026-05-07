import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  CAR_SPECS,
  CAR_TIER_ORDER,
  DAILY_BONUS_AMOUNT,
  NPC_LOT_SIZE,
  NPC_OPPONENTS,
  OFFLINE_CATCHUP_CAP_MS,
  PLAYER_FINE_RISK_PER_MINUTE,
  PLAYER_GARAGE_LIMIT,
  PLAYER_LOT_ID,
  PLAYER_LOT_SIZE,
  STARTING_BALANCE,
  VISIT_LOG_LIMIT,
  getNpcById,
} from "./parking-war-data";
import type {
  CarTier,
  Lot,
  OwnedCar,
  ParkedCar,
  ParkingWarEvent,
  ParkingWarState,
  Slot,
  VisitLogEntry,
  VisitLogKind,
} from "./parking-war-types";

const t = translateRuntimeMessage;

let counter = 0;

function nextId(prefix: string, nowMs: number) {
  counter += 1;
  return `${prefix}-${nowMs.toString(36)}-${counter.toString(36)}`;
}

function rng(seed: number) {
  let value = seed | 0;
  return () => {
    value = (value * 1664525 + 1013904223) | 0;
    return ((value >>> 0) % 1_000_000) / 1_000_000;
  };
}

function emptySlots(size: number): Slot[] {
  return Array.from({ length: size }, (_, index) => ({ index, parked: null }));
}

function makeNpcLot(npcId: string): Lot {
  return {
    ownerKind: "npc_owned",
    ownerId: npcId,
    slots: emptySlots(NPC_LOT_SIZE),
  };
}

function clonePlayerLot(lot: Lot): Lot {
  return {
    ownerKind: lot.ownerKind,
    ownerId: lot.ownerId,
    slots: lot.slots.map((slot) => ({
      index: slot.index,
      parked: slot.parked ? { ...slot.parked } : null,
    })),
  };
}

function cloneNpcLots(lots: Record<string, Lot>): Record<string, Lot> {
  const next: Record<string, Lot> = {};
  for (const [id, lot] of Object.entries(lots)) {
    next[id] = clonePlayerLot(lot);
  }
  return next;
}

export function cloneState(state: ParkingWarState): ParkingWarState {
  return {
    schemaVersion: 2,
    balance: state.balance,
    ownedCars: state.ownedCars.map((car) => ({ ...car })),
    playerLot: clonePlayerLot(state.playerLot),
    npcLots: cloneNpcLots(state.npcLots),
    npcBalances: { ...state.npcBalances },
    lastTickAtMs: state.lastTickAtMs,
    lastDailyBonusDateKey: state.lastDailyBonusDateKey,
    events: state.events.map((event) => ({ ...event })),
    visitLog: state.visitLog.map((entry) => ({ ...entry })),
  };
}

function dateKey(nowMs: number) {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pushEvent(state: ParkingWarState, event: Omit<ParkingWarEvent, "id">) {
  state.events = [
    ...state.events,
    { ...event, id: nextId("ev", event.atMs) },
  ].slice(-12);
}

function pushVisitLog(
  state: ParkingWarState,
  entry: Omit<VisitLogEntry, "id">,
) {
  state.visitLog = [
    { ...entry, id: nextId("vl", entry.atMs) },
    ...state.visitLog,
  ].slice(0, VISIT_LOG_LIMIT);
}

function logBoth(
  state: ParkingWarState,
  atMs: number,
  text: string,
  tone: ParkingWarEvent["tone"],
  kind: VisitLogKind,
  amount?: number,
) {
  pushEvent(state, { atMs, text, tone });
  pushVisitLog(state, { atMs, text, kind, amount });
}

export function createInitialState(nowMs: number): ParkingWarState {
  const playerLot: Lot = {
    ownerKind: "player_owned",
    ownerId: PLAYER_LOT_ID,
    slots: emptySlots(PLAYER_LOT_SIZE),
  };
  playerLot.slots[0]!.parked = {
    source: { kind: "player", carId: "car-starter-1" },
    parkedAtMs: nowMs,
    pendingEarnings: 0,
  };

  const npcLots: Record<string, Lot> = {};
  const npcBalances: Record<string, number> = {};
  for (const npc of NPC_OPPONENTS) {
    npcLots[npc.id] = makeNpcLot(npc.id);
    npcBalances[npc.id] = npc.startingBalance;
    // NPC 自己车场默认放一辆自己的车（占位 + 自动赚钱）。
    npcLots[npc.id]!.slots[0]!.parked = {
      source: { kind: "npc", npcId: npc.id },
      parkedAtMs: nowMs,
      pendingEarnings: 0,
    };
  }

  const ownedCars: OwnedCar[] = [{ carId: "car-starter-1", tier: "starter" }];

  const state: ParkingWarState = {
    schemaVersion: 2,
    balance: STARTING_BALANCE,
    ownedCars,
    playerLot,
    npcLots,
    npcBalances,
    lastTickAtMs: nowMs,
    lastDailyBonusDateKey: "",
    events: [],
    visitLog: [],
  };
  logBoth(
    state,
    nowMs,
    t(msg`停车场开张，去看看世界里的人都在抢什么。`),
    "info",
    "system",
  );
  return state;
}

function ratePerMinuteForPlayerCar(state: ParkingWarState, carId: string) {
  const car = state.ownedCars.find((entry) => entry.carId === carId);
  return car ? CAR_SPECS[car.tier].ratePerMinute : CAR_SPECS.starter.ratePerMinute;
}

function ratePerMinuteForNpc(parked: ParkedCar) {
  if (parked.source.kind !== "npc") return 1;
  const npc = getNpcById(parked.source.npcId);
  return npc?.carRatePerMinute ?? 1;
}

function isPlayerCarParkedAnywhere(state: ParkingWarState, carId: string) {
  const own = state.playerLot.slots.some(
    (slot) => slot.parked?.source.kind === "player" && slot.parked.source.carId === carId,
  );
  if (own) return true;
  return Object.values(state.npcLots).some((lot) =>
    lot.slots.some(
      (slot) => slot.parked?.source.kind === "player" && slot.parked.source.carId === carId,
    ),
  );
}

function accumulateOnSlot(state: ParkingWarState, slot: Slot, elapsedMs: number) {
  if (!slot.parked) return;
  const minutes = elapsedMs / 60_000;
  const rate =
    slot.parked.source.kind === "player"
      ? ratePerMinuteForPlayerCar(state, slot.parked.source.carId)
      : ratePerMinuteForNpc(slot.parked);
  slot.parked.pendingEarnings = round2(slot.parked.pendingEarnings + rate * minutes);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function findEmptySlot(lot: Lot) {
  return lot.slots.find((slot) => !slot.parked) ?? null;
}

function applyDailyBonusIfNeeded(state: ParkingWarState, nowMs: number) {
  const today = dateKey(nowMs);
  if (state.lastDailyBonusDateKey === today) return;
  // First-ever load also grants the bonus once (lastDailyBonusDateKey === "").
  state.balance = round2(state.balance + DAILY_BONUS_AMOUNT);
  state.lastDailyBonusDateKey = today;
  logBoth(
    state,
    nowMs,
    `${t(msg`每日开张奖励`)} ¥${DAILY_BONUS_AMOUNT}${t(msg`，到账。`)}`,
    "success",
    "daily_bonus",
    DAILY_BONUS_AMOUNT,
  );
}

/** 把 NPC 自己车场内"NPC 车"的累积收益结算进 NPC 钱包；玩家被贴条时也走这里。 */
function settleNpcOwnSlots(state: ParkingWarState) {
  for (const [npcId, lot] of Object.entries(state.npcLots)) {
    let gained = 0;
    for (const slot of lot.slots) {
      if (slot.parked && slot.parked.source.kind === "npc" && slot.parked.source.npcId === npcId) {
        gained += slot.parked.pendingEarnings;
        slot.parked.pendingEarnings = 0;
        slot.parked.parkedAtMs = state.lastTickAtMs;
      }
    }
    if (gained > 0) {
      state.npcBalances[npcId] = round2((state.npcBalances[npcId] ?? 0) + gained);
    }
  }
}

export function catchUpOffline(state: ParkingWarState, nowMs: number) {
  const elapsedMs = Math.min(
    Math.max(0, nowMs - state.lastTickAtMs),
    OFFLINE_CATCHUP_CAP_MS,
  );

  if (elapsedMs > 0) {
    for (const slot of state.playerLot.slots) accumulateOnSlot(state, slot, elapsedMs);
    for (const lot of Object.values(state.npcLots)) {
      for (const slot of lot.slots) accumulateOnSlot(state, slot, elapsedMs);
    }

    const random = rng(nowMs);
    const minutes = elapsedMs / 60_000;

    // NPC 离线期间过来停车（按各自的 aggressiveness 决定概率）
    for (const npc of NPC_OPPONENTS) {
      const empty = findEmptySlot(state.playerLot);
      if (!empty) break;
      const probability = Math.min(0.92, minutes * npc.parkAggressiveness);
      if (random() < probability) {
        const parkedAt = nowMs - random() * elapsedMs * 0.7;
        const minutesParked = Math.max(0, (nowMs - parkedAt) / 60_000);
        empty.parked = {
          source: { kind: "npc", npcId: npc.id },
          parkedAtMs: parkedAt,
          pendingEarnings: round2(npc.carRatePerMinute * minutesParked),
        };
        logBoth(
          state,
          parkedAt,
          `${npc.name} ${t(msg`趁你不在停了一下：`)}${npc.welcomeQuote}`,
          "warn",
          "npc_parked_player",
        );
      }
    }

    // NPC 离线期间贴你停在他那的车
    for (const [npcId, lot] of Object.entries(state.npcLots)) {
      const npc = getNpcById(npcId);
      if (!npc) continue;
      for (const slot of lot.slots) {
        if (!slot.parked || slot.parked.source.kind !== "player") continue;
        const fineProb = 1 - Math.pow(1 - npc.fineRiskPerMinute, minutes);
        if (random() < fineProb) {
          const stolen = slot.parked.pendingEarnings;
          state.npcBalances[npcId] = round2((state.npcBalances[npcId] ?? 0) + stolen);
          logBoth(
            state,
            nowMs,
            `${npc.name} ${t(msg`给你贴了张条，`)}¥${stolen.toFixed(2)} ${t(msg`进了对方口袋。`)}`,
            "warn",
            "npc_fined_player",
            stolen,
          );
          slot.parked = null;
        }
      }
    }

    // 结算 NPC 自家车场的车的收益到 NPC 钱包（让排行榜活起来）
    settleNpcOwnSlots(state);
  }

  state.lastTickAtMs = nowMs;
  applyDailyBonusIfNeeded(state, nowMs);
}

export function tickOnline(state: ParkingWarState, nowMs: number) {
  const elapsedMs = Math.max(0, nowMs - state.lastTickAtMs);
  if (elapsedMs === 0) return;

  for (const slot of state.playerLot.slots) accumulateOnSlot(state, slot, elapsedMs);
  for (const lot of Object.values(state.npcLots)) {
    for (const slot of lot.slots) accumulateOnSlot(state, slot, elapsedMs);
  }

  const random = rng(nowMs);
  const minutes = elapsedMs / 60_000;

  // 在线期：偶尔有 NPC 来玩家车场停车
  for (const npc of NPC_OPPONENTS) {
    const empty = findEmptySlot(state.playerLot);
    if (!empty) break;
    const prob = minutes * npc.parkAggressiveness * 0.5; // 在线期降一半，避免太密
    if (random() < prob) {
      empty.parked = {
        source: { kind: "npc", npcId: npc.id },
        parkedAtMs: nowMs,
        pendingEarnings: 0,
      };
      logBoth(
        state,
        nowMs,
        `${npc.name} ${t(msg`把车停到你这了：`)}${npc.welcomeQuote}`,
        "warn",
        "npc_parked_player",
      );
      break; // 一次最多一个 NPC 停过来
    }
  }

  // 玩家停在 NPC 车场的车，按 NPC 性格 + 全局基线决定贴条概率
  for (const [npcId, lot] of Object.entries(state.npcLots)) {
    const npc = getNpcById(npcId);
    if (!npc) continue;
    for (const slot of lot.slots) {
      if (!slot.parked || slot.parked.source.kind !== "player") continue;
      const risk = (npc.fineRiskPerMinute + PLAYER_FINE_RISK_PER_MINUTE) * minutes;
      if (random() < risk) {
        const stolen = slot.parked.pendingEarnings;
        state.npcBalances[npcId] = round2((state.npcBalances[npcId] ?? 0) + stolen);
        logBoth(
          state,
          nowMs,
          `${npc.name} ${t(msg`把你停他车场的车贴条了，`)}¥${stolen.toFixed(2)} ${t(msg`没了。`)}`,
          "warn",
          "npc_fined_player",
          stolen,
        );
        slot.parked = null;
      }
    }
  }

  settleNpcOwnSlots(state);
  state.lastTickAtMs = nowMs;
}

export function collectFromOwnSlot(
  state: ParkingWarState,
  slotIndex: number,
  nowMs: number,
) {
  const slot = state.playerLot.slots[slotIndex];
  if (!slot?.parked || slot.parked.source.kind !== "player") return;
  const gained = slot.parked.pendingEarnings;
  if (gained <= 0) return;
  state.balance = round2(state.balance + gained);
  slot.parked.pendingEarnings = 0;
  slot.parked.parkedAtMs = nowMs;
  logBoth(state, nowMs, `${t(msg`收车收到`)} ¥${gained.toFixed(2)}${t(msg`。`)}`, "success", "self_collect", gained);
}

export function collectAllOwnSlots(state: ParkingWarState, nowMs: number) {
  let total = 0;
  for (const slot of state.playerLot.slots) {
    if (slot.parked && slot.parked.source.kind === "player") {
      total += slot.parked.pendingEarnings;
      slot.parked.pendingEarnings = 0;
      slot.parked.parkedAtMs = nowMs;
    }
  }
  if (total <= 0) return;
  state.balance = round2(state.balance + total);
  logBoth(state, nowMs, `${t(msg`一键收钱：`)}¥${total.toFixed(2)}${t(msg`。`)}`, "success", "self_collect", total);
}

export function fineNpcOnPlayerSlot(
  state: ParkingWarState,
  slotIndex: number,
  nowMs: number,
) {
  const slot = state.playerLot.slots[slotIndex];
  if (!slot?.parked || slot.parked.source.kind !== "npc") return;
  const npcId = slot.parked.source.npcId;
  const npc = getNpcById(npcId);
  const gained = slot.parked.pendingEarnings;
  state.balance = round2(state.balance + gained);
  state.npcBalances[npcId] = round2(
    Math.max(0, (state.npcBalances[npcId] ?? 0) - gained * 0.6),
  );
  logBoth(
    state,
    nowMs,
    `${t(msg`给`)} ${npc?.name ?? "NPC"} ${t(msg`贴了张条，吃下`)} ¥${gained.toFixed(2)}${t(msg`。`)}`,
    "success",
    "player_fined_npc",
    gained,
  );
  slot.parked = null;
}

export function fineAllNpcsOnPlayerLot(state: ParkingWarState, nowMs: number) {
  let total = 0;
  for (const slot of state.playerLot.slots) {
    if (slot.parked && slot.parked.source.kind === "npc") {
      const npcId = slot.parked.source.npcId;
      const gained = slot.parked.pendingEarnings;
      total += gained;
      state.npcBalances[npcId] = round2(
        Math.max(0, (state.npcBalances[npcId] ?? 0) - gained * 0.6),
      );
      slot.parked = null;
    }
  }
  if (total <= 0) return;
  state.balance = round2(state.balance + total);
  logBoth(
    state,
    nowMs,
    `${t(msg`全场贴条，一共吃下`)} ¥${total.toFixed(2)}${t(msg`。`)}`,
    "success",
    "player_fined_npc",
    total,
  );
}

export function kickNpcOffPlayerSlot(
  state: ParkingWarState,
  slotIndex: number,
  nowMs: number,
) {
  const slot = state.playerLot.slots[slotIndex];
  if (!slot?.parked || slot.parked.source.kind !== "npc") return;
  const npc = getNpcById(slot.parked.source.npcId);
  logBoth(
    state,
    nowMs,
    `${t(msg`直接把`)} ${npc?.name ?? "NPC"} ${t(msg`的车赶走了。`)}`,
    "info",
    "player_kicked_npc",
  );
  slot.parked = null;
}

export function parkPlayerInNpcLot(
  state: ParkingWarState,
  npcId: string,
  slotIndex: number,
  carId: string,
  nowMs: number,
) {
  const lot = state.npcLots[npcId];
  if (!lot) return;
  const slot = lot.slots[slotIndex];
  if (!slot || slot.parked) return;
  if (!state.ownedCars.some((car) => car.carId === carId)) return;
  if (isPlayerCarParkedAnywhere(state, carId)) return;
  slot.parked = {
    source: { kind: "player", carId },
    parkedAtMs: nowMs,
    pendingEarnings: 0,
  };
  const npc = getNpcById(npcId);
  logBoth(
    state,
    nowMs,
    `${t(msg`把车停到`)} ${npc?.name ?? t(msg`对方`)} ${t(msg`的车场了，能蹭多久看运气。`)}`,
    "info",
    "player_parked_npc",
  );
}

export function recallPlayerFromNpcLot(
  state: ParkingWarState,
  npcId: string,
  slotIndex: number,
  nowMs: number,
) {
  const lot = state.npcLots[npcId];
  if (!lot) return;
  const slot = lot.slots[slotIndex];
  if (!slot?.parked || slot.parked.source.kind !== "player") return;
  const gained = slot.parked.pendingEarnings;
  state.balance = round2(state.balance + gained);
  state.npcBalances[npcId] = round2(
    Math.max(0, (state.npcBalances[npcId] ?? 0) - gained * 0.4),
  );
  logBoth(
    state,
    nowMs,
    `${t(msg`把车开回来了，顺手收了`)} ¥${gained.toFixed(2)}${t(msg`。`)}`,
    "success",
    "player_recalled_npc",
    gained,
  );
  slot.parked = null;
}

export function parkOwnedCarHome(
  state: ParkingWarState,
  carId: string,
  nowMs: number,
) {
  if (!state.ownedCars.some((car) => car.carId === carId)) return;
  if (isPlayerCarParkedAnywhere(state, carId)) return;
  const empty = findEmptySlot(state.playerLot);
  if (!empty) return;
  empty.parked = {
    source: { kind: "player", carId },
    parkedAtMs: nowMs,
    pendingEarnings: 0,
  };
  logBoth(state, nowMs, t(msg`把车开回了自己的车位。`), "info", "system");
}

export function buyCar(state: ParkingWarState, tier: CarTier, nowMs: number) {
  if (state.ownedCars.length >= PLAYER_GARAGE_LIMIT) return;
  const spec = CAR_SPECS[tier];
  if (state.balance < spec.unlockCost) return;
  const tierIdx = CAR_TIER_ORDER.indexOf(tier);
  const ownedTopIdx = state.ownedCars.reduce(
    (max, car) => Math.max(max, CAR_TIER_ORDER.indexOf(car.tier)),
    -1,
  );
  if (tierIdx <= ownedTopIdx) return;
  state.balance = round2(state.balance - spec.unlockCost);
  const carId = `car-${tier}-${state.ownedCars.length + 1}`;
  state.ownedCars.push({ carId, tier });
  logBoth(
    state,
    nowMs,
    `${t(msg`提了一台`)} ${spec.name}${t(msg`，每分钟`)} ¥${spec.ratePerMinute}${t(msg`。`)}`,
    "success",
    "buy_car",
    spec.unlockCost,
  );
  parkOwnedCarHome(state, carId, nowMs);
}

export function findPlayerCarLocation(state: ParkingWarState, carId: string):
  | { kind: "home"; slotIndex: number }
  | { kind: "npc"; npcId: string; slotIndex: number }
  | { kind: "garage" } {
  for (const slot of state.playerLot.slots) {
    if (slot.parked?.source.kind === "player" && slot.parked.source.carId === carId) {
      return { kind: "home", slotIndex: slot.index };
    }
  }
  for (const [npcId, lot] of Object.entries(state.npcLots)) {
    for (const slot of lot.slots) {
      if (slot.parked?.source.kind === "player" && slot.parked.source.carId === carId) {
        return { kind: "npc", npcId, slotIndex: slot.index };
      }
    }
  }
  return { kind: "garage" };
}

export type LeaderboardEntry = {
  rank: number;
  name: string;
  isPlayer: boolean;
  balance: number;
  parkedHere?: boolean;
};

export function buildLeaderboard(state: ParkingWarState): LeaderboardEntry[] {
  const rows = [
    {
      name: t(msg`我`),
      isPlayer: true as const,
      balance: state.balance,
    },
    ...NPC_OPPONENTS.map((npc) => ({
      name: npc.name,
      isPlayer: false as const,
      balance: state.npcBalances[npc.id] ?? 0,
      npcId: npc.id,
    })),
  ];
  rows.sort((a, b) => b.balance - a.balance);
  return rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    isPlayer: row.isPlayer,
    balance: row.balance,
  }));
}
