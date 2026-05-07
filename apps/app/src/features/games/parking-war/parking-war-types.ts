export type CarTier =
  | "starter"
  | "family"
  | "business"
  | "performance"
  | "luxury"
  | "super";

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
  welcomeQuote: string;
  carEmoji: string;
  carName: string;
  carRatePerMinute: number;
  fineRiskPerMinute: number;
  parkAggressiveness: number;
  startingBalance: number;
};

export type ParkingWarEvent = {
  id: string;
  atMs: number;
  text: string;
  tone: "info" | "success" | "warn";
};

export type VisitLogKind =
  | "npc_parked_player"
  | "npc_left_player"
  | "player_fined_npc"
  | "player_kicked_npc"
  | "player_parked_npc"
  | "player_recalled_npc"
  | "npc_fined_player"
  | "daily_bonus"
  | "self_collect"
  | "buy_car"
  | "system";

export type VisitLogEntry = {
  id: string;
  atMs: number;
  kind: VisitLogKind;
  text: string;
  amount?: number;
};

export type ParkingWarState = {
  schemaVersion: 2;
  balance: number;
  ownedCars: OwnedCar[];
  playerLot: Lot;
  npcLots: Record<string, Lot>;
  npcBalances: Record<string, number>;
  lastTickAtMs: number;
  lastDailyBonusDateKey: string;
  events: ParkingWarEvent[];
  visitLog: VisitLogEntry[];
};
