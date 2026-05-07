export type FarmCropId =
  | "cabbage"
  | "potato"
  | "carrot"
  | "wheat"
  | "corn"
  | "tomato"
  | "strawberry"
  | "sunflower"
  | "rice"
  | "pumpkin"
  | "lavender"
  | "ginseng"
  | "goji"
  | "snow_lotus";

export type FarmPlotStage =
  | "empty"
  | "seed"
  | "sprout"
  | "growing"
  | "ripe"
  | "rotten";

export type FarmCropRarity = "common" | "uncommon" | "rare";

export type FarmActorType = "owner" | "character";

export type FarmEventKind =
  | "plant"
  | "harvest"
  | "water"
  | "weed"
  | "debug"
  | "buy"
  | "sell"
  | "level_up"
  | "steal"
  | "visit"
  | "intimacy_change"
  | "incident_broadcast";

export interface FarmPlot {
  index: number;
  cropId: FarmCropId | null;
  plantedAt: number | null;
  maturedAt: number | null;
  stage: FarmPlotStage;
  watered: boolean;
  weeds: number;
  bugs: number;
  stolenBy: string[];
  plantedBy?: string;
  yieldOverride?: number | null;
}

export interface FarmCharacterMood {
  energy: number;
  diligence: number;
  pickpocketBias: number;
}

export interface FarmStolenLogEntry {
  thiefCharacterId: string;
  thiefName: string;
  cropId: FarmCropId;
  amount: number;
  atMs: number;
}

export interface FarmCropDefinition {
  id: FarmCropId;
  nameZh: string;
  emoji: string;
  seedCost: number;
  sellPrice: number;
  growHours: number;
  yieldRange: [number, number];
  preferredDomains: string[];
  unlockLevel: number;
  rarity: FarmCropRarity;
  experience: number;
}

export interface FarmPlayerStateView {
  ownerId: string;
  coins: number;
  experience: number;
  level: number;
  plotCount: number;
  plots: FarmPlot[];
  warehouse: Record<string, number>;
  seedBag: Record<string, number>;
  weeklyStolenLog: FarmStolenLogEntry[];
  serverNowMs: number;
  updatedAt: string;
}

export interface FarmNeighborSummary {
  characterId: string;
  characterName: string;
  characterAvatar?: string | null;
  intimacyLevel: number;
  isOnline: boolean;
  ripePlotCount: number;
  totalPlotCount: number;
  level: number;
  coins: number;
  lastActedAt: string | null;
  expertDomains: string[];
  relationship?: string | null;
}

export interface FarmNeighborDetail extends FarmNeighborSummary {
  plots: FarmPlot[];
  recentEvents: FarmEventView[];
  serverNowMs: number;
}

export interface FarmEventView {
  id: string;
  kind: FarmEventKind;
  actorType: FarmActorType;
  actorId: string;
  actorName: string;
  targetType?: FarmActorType | null;
  targetId?: string | null;
  cropId?: FarmCropId | null;
  intimacyDelta?: number | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface FarmHarvestResult {
  player: FarmPlayerStateView;
  harvested: {
    cropId: FarmCropId;
    amount: number;
    coinsGained: number;
    experienceGained: number;
    leveledUp: boolean;
  };
}

export interface FarmStealResult {
  player: FarmPlayerStateView;
  target: FarmNeighborSummary;
  stolen: {
    cropId: FarmCropId;
    amount: number;
    coinsGained: number;
    intimacyDelta: number;
  };
}

export interface FarmTickSummary {
  scannedCharacterCount: number;
  actedCount: number;
  plantCount: number;
  harvestCount: number;
  stealCount: number;
  incidentBroadcastCount: number;
  durationMs: number;
}

export interface FarmPlantInput {
  plotIndex: number;
  cropId: FarmCropId;
}

export interface FarmPlotActionInput {
  plotIndex: number;
  characterId?: string;
}

export interface FarmStealInput {
  characterId: string;
  plotIndex: number;
}

export interface FarmSeedTransactionInput {
  cropId: FarmCropId;
  quantity: number;
}

export const FARM_CROP_CATALOG: Record<FarmCropId, FarmCropDefinition> = {
  cabbage: {
    id: "cabbage",
    nameZh: "白菜",
    emoji: "🥬",
    seedCost: 20,
    sellPrice: 50,
    growHours: 2,
    yieldRange: [2, 4],
    preferredDomains: ["cooking", "wellness", "life"],
    unlockLevel: 1,
    rarity: "common",
    experience: 5,
  },
  potato: {
    id: "potato",
    nameZh: "土豆",
    emoji: "🥔",
    seedCost: 30,
    sellPrice: 80,
    growHours: 3,
    yieldRange: [2, 4],
    preferredDomains: ["cooking", "life"],
    unlockLevel: 1,
    rarity: "common",
    experience: 7,
  },
  carrot: {
    id: "carrot",
    nameZh: "胡萝卜",
    emoji: "🥕",
    seedCost: 35,
    sellPrice: 100,
    growHours: 4,
    yieldRange: [2, 5],
    preferredDomains: ["cooking", "wellness"],
    unlockLevel: 1,
    rarity: "common",
    experience: 8,
  },
  wheat: {
    id: "wheat",
    nameZh: "小麦",
    emoji: "🌾",
    seedCost: 45,
    sellPrice: 130,
    growHours: 5,
    yieldRange: [3, 5],
    preferredDomains: ["cooking", "farming"],
    unlockLevel: 2,
    rarity: "common",
    experience: 10,
  },
  corn: {
    id: "corn",
    nameZh: "玉米",
    emoji: "🌽",
    seedCost: 60,
    sellPrice: 180,
    growHours: 6,
    yieldRange: [3, 5],
    preferredDomains: ["cooking", "farming"],
    unlockLevel: 2,
    rarity: "common",
    experience: 12,
  },
  strawberry: {
    id: "strawberry",
    nameZh: "草莓",
    emoji: "🍓",
    seedCost: 90,
    sellPrice: 260,
    growHours: 8,
    yieldRange: [3, 6],
    preferredDomains: ["fashion", "life", "romance"],
    unlockLevel: 2,
    rarity: "uncommon",
    experience: 16,
  },
  tomato: {
    id: "tomato",
    nameZh: "西红柿",
    emoji: "🍅",
    seedCost: 80,
    sellPrice: 240,
    growHours: 12,
    yieldRange: [3, 6],
    preferredDomains: ["cooking"],
    unlockLevel: 3,
    rarity: "uncommon",
    experience: 18,
  },
  sunflower: {
    id: "sunflower",
    nameZh: "向日葵",
    emoji: "🌻",
    seedCost: 100,
    sellPrice: 280,
    growHours: 9,
    yieldRange: [2, 4],
    preferredDomains: ["fashion", "art"],
    unlockLevel: 3,
    rarity: "uncommon",
    experience: 18,
  },
  rice: {
    id: "rice",
    nameZh: "稻米",
    emoji: "🌾",
    seedCost: 110,
    sellPrice: 320,
    growHours: 10,
    yieldRange: [3, 5],
    preferredDomains: ["cooking", "farming"],
    unlockLevel: 3,
    rarity: "uncommon",
    experience: 20,
  },
  pumpkin: {
    id: "pumpkin",
    nameZh: "南瓜",
    emoji: "🎃",
    seedCost: 160,
    sellPrice: 480,
    growHours: 14,
    yieldRange: [2, 4],
    preferredDomains: ["cooking", "art"],
    unlockLevel: 4,
    rarity: "uncommon",
    experience: 28,
  },
  lavender: {
    id: "lavender",
    nameZh: "薰衣草",
    emoji: "💜",
    seedCost: 200,
    sellPrice: 620,
    growHours: 18,
    yieldRange: [2, 4],
    preferredDomains: ["psychology", "romance", "fashion"],
    unlockLevel: 4,
    rarity: "rare",
    experience: 36,
  },
  goji: {
    id: "goji",
    nameZh: "枸杞",
    emoji: "🔴",
    seedCost: 280,
    sellPrice: 920,
    growHours: 30,
    yieldRange: [2, 4],
    preferredDomains: ["medicine", "wellness"],
    unlockLevel: 4,
    rarity: "rare",
    experience: 50,
  },
  ginseng: {
    id: "ginseng",
    nameZh: "人参",
    emoji: "🪴",
    seedCost: 600,
    sellPrice: 2200,
    growHours: 48,
    yieldRange: [1, 2],
    preferredDomains: ["medicine"],
    unlockLevel: 5,
    rarity: "rare",
    experience: 110,
  },
  snow_lotus: {
    id: "snow_lotus",
    nameZh: "雪莲",
    emoji: "❄️",
    seedCost: 1100,
    sellPrice: 4200,
    growHours: 72,
    yieldRange: [1, 1],
    preferredDomains: ["medicine"],
    unlockLevel: 6,
    rarity: "rare",
    experience: 220,
  },
};

export const FARM_DEFAULT_PLOT_COUNT = 6;
export const FARM_DEFAULT_PLAYER_COINS = 200;
export const FARM_DEFAULT_PLAYER_SEED_BAG: Record<FarmCropId, number> = {
  cabbage: 5,
  potato: 3,
  carrot: 0,
  wheat: 0,
  corn: 0,
  strawberry: 0,
  tomato: 0,
  sunflower: 0,
  rice: 0,
  pumpkin: 0,
  lavender: 0,
  goji: 0,
  ginseng: 0,
  snow_lotus: 0,
};

export const FARM_DEFAULT_NPC_COINS = 100;
export const FARM_DEFAULT_NPC_PLOT_COUNT = 4;
export const FARM_FARMING_DOMAIN_NPC_PLOT_COUNT = 6;

export const FARM_LEVEL_PLOT_UNLOCKS: ReadonlyArray<{ level: number; plotCount: number }> = [
  { level: 1, plotCount: 6 },
  { level: 4, plotCount: 9 },
  { level: 8, plotCount: 12 },
];

export const FARM_LEVEL_EXPERIENCE_THRESHOLDS: ReadonlyArray<number> = [
  0, 100, 260, 480, 760, 1120, 1560, 2080, 2680, 3360,
];

export const FARM_RIPE_TO_ROTTEN_HOURS = 24;

export const FARM_PLAYER_DAILY_STEAL_LIMIT = 10;

export const FARM_NPC_TICK_CRON = "*/10 * * * *";

export const FARM_INCIDENT_BROADCAST_CHANCE = 0.08;

export function computeMaturedAtMs(
  cropId: FarmCropId,
  plantedAtMs: number,
): number {
  return plantedAtMs + FARM_CROP_CATALOG[cropId].growHours * 3600 * 1000;
}

export function computeRottenAtMs(
  cropId: FarmCropId,
  plantedAtMs: number,
): number {
  return (
    computeMaturedAtMs(cropId, plantedAtMs) +
    FARM_RIPE_TO_ROTTEN_HOURS * 3600 * 1000
  );
}

export function computeLevelFromExperience(experience: number): number {
  let level = 1;
  for (let i = 0; i < FARM_LEVEL_EXPERIENCE_THRESHOLDS.length; i += 1) {
    if (experience >= FARM_LEVEL_EXPERIENCE_THRESHOLDS[i]!) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

export function computePlotCountForLevel(level: number): number {
  let plotCount = FARM_DEFAULT_PLOT_COUNT;
  for (const entry of FARM_LEVEL_PLOT_UNLOCKS) {
    if (level >= entry.level) plotCount = entry.plotCount;
  }
  return plotCount;
}
