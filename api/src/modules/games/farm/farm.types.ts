export type FarmCropId =
  | 'cabbage'
  | 'potato'
  | 'carrot'
  | 'wheat'
  | 'corn'
  | 'tomato'
  | 'strawberry'
  | 'sunflower'
  | 'rice'
  | 'pumpkin'
  | 'lavender'
  | 'ginseng'
  | 'goji'
  | 'snow_lotus';

export type FarmPlotStage =
  | 'empty'
  | 'seed'
  | 'sprout'
  | 'growing'
  | 'ripe'
  | 'rotten';

export type FarmCropRarity = 'common' | 'uncommon' | 'rare';

export type FarmActorType = 'owner' | 'character';

export type FarmEventKind =
  | 'plant'
  | 'harvest'
  | 'water'
  | 'weed'
  | 'debug'
  | 'buy'
  | 'sell'
  | 'level_up'
  | 'steal'
  | 'visit'
  | 'intimacy_change'
  | 'incident_broadcast';

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

export interface FarmNeighborDetail extends FarmNeighborSummary {
  plots: FarmPlot[];
  recentEvents: FarmEventView[];
  serverNowMs: number;
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

export const FARM_DEFAULT_PLOT_COUNT = 6;
export const FARM_DEFAULT_PLAYER_COINS = 200;
export const FARM_DEFAULT_NPC_COINS = 100;
export const FARM_DEFAULT_NPC_PLOT_COUNT = 4;
export const FARM_FARMING_DOMAIN_NPC_PLOT_COUNT = 6;
export const FARM_RIPE_TO_ROTTEN_HOURS = 24;
export const FARM_PLAYER_DAILY_STEAL_LIMIT = 10;
export const FARM_NPC_TICK_CRON = '*/10 * * * *';
export const FARM_INCIDENT_BROADCAST_CHANCE = 0.08;

export const FARM_LEVEL_PLOT_UNLOCKS: ReadonlyArray<{ level: number; plotCount: number }> = [
  { level: 1, plotCount: 6 },
  { level: 4, plotCount: 9 },
  { level: 8, plotCount: 12 },
];

export const FARM_LEVEL_EXPERIENCE_THRESHOLDS: ReadonlyArray<number> = [
  0, 100, 260, 480, 760, 1120, 1560, 2080, 2680, 3360,
];

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

export const FARM_EXCLUDED_CHARACTER_IDS = new Set<string>([
  // Legacy bare ids (kept defensively in case older fixtures still use them).
  'self',
  'self-character',
  'reminder',
  'reminder-character',
  'world-news-desk',
  'system',
  'system-character',
  // Actual default-character ids in this codebase. 漏掉这些会让 "我自己 / 小盯 /
  // 界闻" 这些系统 NPC 出现在邻居列表，并且能被串门 / 偷菜。
  'char-default-self',
  'char-default-reminder',
  'char-default-world-news-desk',
]);

export const FARM_PLAYER_ACTOR_ID = 'owner';
