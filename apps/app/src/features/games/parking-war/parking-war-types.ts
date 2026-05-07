export type CarTier = "starter" | "family" | "performance" | "luxury";

export type CarSpec = {
  tier: CarTier;
  name: string;
  emoji: string;
  ratePerMinute: number;
  unlockCost: number;
};

export type OwnedCar = {
  carId: string;
  tier: CarTier;
};

export type SlotKind = "player_owned" | "npc_owned";

export type ParkedCarSource =
  | { kind: "player"; carId: string }
  | { kind: "npc"; npcId: string };

export type ParkedCar = {
  source: ParkedCarSource;
  parkedAtMs: number;
  pendingEarnings: number;
};

export type Slot = {
  index: number;
  parked: ParkedCar | null;
};

export type Lot = {
  ownerKind: SlotKind;
  ownerId: string;
  slots: Slot[];
};

export type NpcOpponent = {
  id: string;
  name: string;
  worldCharacterId: string;
  blurb: string;
  carEmoji: string;
  carName: string;
  carRatePerMinute: number;
  fineRiskPerMinute: number;
};

export type ParkingWarEvent = {
  id: string;
  atMs: number;
  text: string;
  tone: "info" | "success" | "warn";
};

export type ParkingWarState = {
  schemaVersion: 1;
  balance: number;
  ownedCars: OwnedCar[];
  playerLot: Lot;
  npcLots: Record<string, Lot>;
  lastTickAtMs: number;
  events: ParkingWarEvent[];
};
