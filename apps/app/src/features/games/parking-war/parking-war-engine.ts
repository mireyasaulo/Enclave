import {
  CAR_SPECS,
  CAR_TIER_ORDER,
  NPC_LOT_SIZE,
  NPC_OPPONENTS,
  OFFLINE_CATCHUP_CAP_MS,
  PLAYER_FINE_RISK_PER_MINUTE,
  PLAYER_GARAGE_LIMIT,
  PLAYER_LOT_ID,
  PLAYER_LOT_SIZE,
  STARTING_BALANCE,
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
} from "./parking-war-types";

let eventCounter = 0;

function nextEventId(nowMs: number) {
  eventCounter += 1;
  return `pw-${nowMs.toString(36)}-${eventCounter.toString(36)}`;
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
    schemaVersion: 1,
    balance: state.balance,
    ownedCars: state.ownedCars.map((car) => ({ ...car })),
    playerLot: clonePlayerLot(state.playerLot),
    npcLots: cloneNpcLots(state.npcLots),
    lastTickAtMs: state.lastTickAtMs,
    events: state.events.map((event) => ({ ...event })),
  };
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
  for (const npc of NPC_OPPONENTS) {
    npcLots[npc.id] = makeNpcLot(npc.id);
  }

  const ownedCars: OwnedCar[] = [{ carId: "car-starter-1", tier: "starter" }];

  return {
    schemaVersion: 1,
    balance: STARTING_BALANCE,
    ownedCars,
    playerLot,
    npcLots,
    lastTickAtMs: nowMs,
    events: [
      {
        id: nextEventId(nowMs),
        atMs: nowMs,
        text: "停车场开张了，和世界里的熟人抢一抢。",
        tone: "info",
      },
    ],
  };
}

function ratePerMinuteFor(parked: ParkedCar): number {
  if (parked.source.kind === "player") {
    return CAR_SPECS.starter.ratePerMinute;
  }
  const npc = getNpcById(parked.source.npcId);
  return npc?.carRatePerMinute ?? 1;
}

function ratePerMinuteForPlayerCar(state: ParkingWarState, carId: string) {
  const car = state.ownedCars.find((entry) => entry.carId === carId);
  return car ? CAR_SPECS[car.tier].ratePerMinute : CAR_SPECS.starter.ratePerMinute;
}

function isPlayerCarParkedAnywhere(state: ParkingWarState, carId: string) {
  const inOwn = state.playerLot.slots.some(
    (slot) => slot.parked?.source.kind === "player" && slot.parked.source.carId === carId,
  );
  if (inOwn) return true;
  return Object.values(state.npcLots).some((lot) =>
    lot.slots.some(
      (slot) => slot.parked?.source.kind === "player" && slot.parked.source.carId === carId,
    ),
  );
}

function accumulateOnSlot(
  state: ParkingWarState,
  slot: Slot,
  elapsedMs: number,
) {
  if (!slot.parked) return;
  const minutes = elapsedMs / 60_000;
  const rate =
    slot.parked.source.kind === "player"
      ? ratePerMinuteForPlayerCar(state, slot.parked.source.carId)
      : ratePerMinuteFor(slot.parked);
  slot.parked.pendingEarnings = round2(slot.parked.pendingEarnings + rate * minutes);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function pushEvent(
  state: ParkingWarState,
  event: Omit<ParkingWarEvent, "id">,
) {
  state.events = [
    ...state.events,
    { ...event, id: nextEventId(event.atMs) },
  ].slice(-12);
}

function findEmptySlot(lot: Lot) {
  return lot.slots.find((slot) => !slot.parked) ?? null;
}

/**
 * Catch up on offline elapsed time: accumulate earnings on every parked slot,
 * roll dice for NPCs to park in player's empty slots, and roll dice for NPC
 * owners to fine the player's cars parked on their lots.
 */
export function catchUpOffline(state: ParkingWarState, nowMs: number) {
  const elapsedMs = Math.min(
    Math.max(0, nowMs - state.lastTickAtMs),
    OFFLINE_CATCHUP_CAP_MS,
  );
  if (elapsedMs <= 0) {
    state.lastTickAtMs = nowMs;
    return;
  }

  // 1) Earnings on every parked slot.
  for (const slot of state.playerLot.slots) accumulateOnSlot(state, slot, elapsedMs);
  for (const lot of Object.values(state.npcLots)) {
    for (const slot of lot.slots) accumulateOnSlot(state, slot, elapsedMs);
  }

  const random = rng(nowMs);

  // 2) NPCs park into player empties (1 chance per NPC, weighted by elapsed time).
  const elapsedMinutes = elapsedMs / 60_000;
  for (const npc of NPC_OPPONENTS) {
    const empty = findEmptySlot(state.playerLot);
    if (!empty) break;
    const probability = Math.min(0.85, elapsedMinutes * 0.18);
    if (random() < probability) {
      const parkedAt = nowMs - random() * elapsedMs * 0.7;
      const minutesParked = (nowMs - parkedAt) / 60_000;
      empty.parked = {
        source: { kind: "npc", npcId: npc.id },
        parkedAtMs: parkedAt,
        pendingEarnings: round2(npc.carRatePerMinute * minutesParked),
      };
      pushEvent(state, {
        atMs: parkedAt,
        text: `${npc.name} 趁你不在停了一下。`,
        tone: "warn",
      });
    }
  }

  // 3) NPC owners fine player cars parked in their lots.
  for (const [npcId, lot] of Object.entries(state.npcLots)) {
    const npc = getNpcById(npcId);
    if (!npc) continue;
    for (const slot of lot.slots) {
      if (!slot.parked || slot.parked.source.kind !== "player") continue;
      const fineProbability = 1 - Math.pow(1 - npc.fineRiskPerMinute, elapsedMinutes);
      if (random() < fineProbability) {
        pushEvent(state, {
          atMs: nowMs,
          text: `${npc.name} 给你贴了张条，¥${slot.parked.pendingEarnings.toFixed(2)} 没了。`,
          tone: "warn",
        });
        slot.parked = null;
      }
    }
  }

  state.lastTickAtMs = nowMs;
}

/** Per-second tick while game is open. */
export function tickOnline(state: ParkingWarState, nowMs: number) {
  const elapsedMs = Math.max(0, nowMs - state.lastTickAtMs);
  if (elapsedMs === 0) return;

  for (const slot of state.playerLot.slots) accumulateOnSlot(state, slot, elapsedMs);
  for (const lot of Object.values(state.npcLots)) {
    for (const slot of lot.slots) accumulateOnSlot(state, slot, elapsedMs);
  }

  const random = rng(nowMs);
  const elapsedMinutes = elapsedMs / 60_000;

  // Rare chance NPC parks while playing (~1 NPC per 60s on average).
  const npcParkProb = elapsedMinutes * 0.4;
  if (random() < npcParkProb) {
    const empty = findEmptySlot(state.playerLot);
    if (empty) {
      const candidates = NPC_OPPONENTS.filter((npc) => {
        const lot = state.npcLots[npc.id];
        if (!lot) return true;
        return !lot.slots.some(
          (slot) =>
            slot.parked?.source.kind === "npc" && slot.parked.source.npcId === npc.id,
        );
      });
      const pool = candidates.length > 0 ? candidates : NPC_OPPONENTS;
      const npc = pool[Math.floor(random() * pool.length)]!;
      empty.parked = {
        source: { kind: "npc", npcId: npc.id },
        parkedAtMs: nowMs,
        pendingEarnings: 0,
      };
      pushEvent(state, {
        atMs: nowMs,
        text: `${npc.name} 把车停到你这了。`,
        tone: "warn",
      });
    }
  }

  // Player cars parked in NPC lots: per-NPC fine risk per minute.
  for (const [npcId, lot] of Object.entries(state.npcLots)) {
    const npc = getNpcById(npcId);
    if (!npc) continue;
    for (const slot of lot.slots) {
      if (!slot.parked || slot.parked.source.kind !== "player") continue;
      const risk = (npc.fineRiskPerMinute + PLAYER_FINE_RISK_PER_MINUTE) * elapsedMinutes;
      if (random() < risk) {
        pushEvent(state, {
          atMs: nowMs,
          text: `${npc.name} 把你停在他车场的车贴条了，¥${slot.parked.pendingEarnings.toFixed(2)} 没了。`,
          tone: "warn",
        });
        slot.parked = null;
      }
    }
  }

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
  pushEvent(state, {
    atMs: nowMs,
    text: `收车收到 ¥${gained.toFixed(2)}。`,
    tone: "success",
  });
}

export function fineNpcOnPlayerSlot(
  state: ParkingWarState,
  slotIndex: number,
  nowMs: number,
) {
  const slot = state.playerLot.slots[slotIndex];
  if (!slot?.parked || slot.parked.source.kind !== "npc") return;
  const npc = getNpcById(slot.parked.source.npcId);
  const gained = slot.parked.pendingEarnings;
  state.balance = round2(state.balance + gained);
  pushEvent(state, {
    atMs: nowMs,
    text: `给 ${npc?.name ?? "NPC"} 贴了张条，吃下 ¥${gained.toFixed(2)}。`,
    tone: "success",
  });
  slot.parked = null;
}

export function kickNpcOffPlayerSlot(
  state: ParkingWarState,
  slotIndex: number,
  nowMs: number,
) {
  const slot = state.playerLot.slots[slotIndex];
  if (!slot?.parked || slot.parked.source.kind !== "npc") return;
  const npc = getNpcById(slot.parked.source.npcId);
  pushEvent(state, {
    atMs: nowMs,
    text: `直接把 ${npc?.name ?? "NPC"} 的车赶走了。`,
    tone: "info",
  });
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
  pushEvent(state, {
    atMs: nowMs,
    text: `把车停到 ${npc?.name ?? "对方"} 的车场了，能蹭多久看运气。`,
    tone: "info",
  });
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
  pushEvent(state, {
    atMs: nowMs,
    text: `把车开回来了，顺手收了 ¥${gained.toFixed(2)}。`,
    tone: "success",
  });
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
  pushEvent(state, {
    atMs: nowMs,
    text: "把车开回了自己的车位。",
    tone: "info",
  });
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
  pushEvent(state, {
    atMs: nowMs,
    text: `提了一台 ${spec.name}，每分钟 ¥${spec.ratePerMinute}。`,
    tone: "success",
  });
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
