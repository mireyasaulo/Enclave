// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  FARM_DEFAULT_PLOT_COUNT,
  FARM_LEVEL_EXPERIENCE_THRESHOLDS,
  FARM_LEVEL_PLOT_UNLOCKS,
  FarmCropDefinition,
  FarmCropId,
} from './farm.types';

export const FARM_CROP_CATALOG: Record<FarmCropId, FarmCropDefinition> = {
  cabbage: {
    id: 'cabbage',
    nameZh: '白菜',
    emoji: '🥬',
    seedCost: 20,
    sellPrice: 50,
    growHours: 2,
    yieldRange: [2, 4],
    preferredDomains: ['cooking', 'wellness', 'life'],
    unlockLevel: 1,
    rarity: 'common',
    experience: 5,
  },
  potato: {
    id: 'potato',
    nameZh: '土豆',
    emoji: '🥔',
    seedCost: 30,
    sellPrice: 80,
    growHours: 3,
    yieldRange: [2, 4],
    preferredDomains: ['cooking', 'life'],
    unlockLevel: 1,
    rarity: 'common',
    experience: 7,
  },
  carrot: {
    id: 'carrot',
    nameZh: '胡萝卜',
    emoji: '🥕',
    seedCost: 35,
    sellPrice: 100,
    growHours: 4,
    yieldRange: [2, 5],
    preferredDomains: ['cooking', 'wellness'],
    unlockLevel: 1,
    rarity: 'common',
    experience: 8,
  },
  wheat: {
    id: 'wheat',
    nameZh: '小麦',
    emoji: '🌾',
    seedCost: 45,
    sellPrice: 130,
    growHours: 5,
    yieldRange: [3, 5],
    preferredDomains: ['cooking', 'farming'],
    unlockLevel: 2,
    rarity: 'common',
    experience: 10,
  },
  corn: {
    id: 'corn',
    nameZh: '玉米',
    emoji: '🌽',
    seedCost: 60,
    sellPrice: 180,
    growHours: 6,
    yieldRange: [3, 5],
    preferredDomains: ['cooking', 'farming'],
    unlockLevel: 2,
    rarity: 'common',
    experience: 12,
  },
  strawberry: {
    id: 'strawberry',
    nameZh: '草莓',
    emoji: '🍓',
    seedCost: 90,
    sellPrice: 260,
    growHours: 8,
    yieldRange: [3, 6],
    preferredDomains: ['fashion', 'life', 'romance'],
    unlockLevel: 2,
    rarity: 'uncommon',
    experience: 16,
  },
  tomato: {
    id: 'tomato',
    nameZh: '西红柿',
    emoji: '🍅',
    seedCost: 80,
    sellPrice: 240,
    growHours: 12,
    yieldRange: [3, 6],
    preferredDomains: ['cooking'],
    unlockLevel: 3,
    rarity: 'uncommon',
    experience: 18,
  },
  sunflower: {
    id: 'sunflower',
    nameZh: '向日葵',
    emoji: '🌻',
    seedCost: 100,
    sellPrice: 280,
    growHours: 9,
    yieldRange: [2, 4],
    preferredDomains: ['fashion', 'art'],
    unlockLevel: 3,
    rarity: 'uncommon',
    experience: 18,
  },
  rice: {
    id: 'rice',
    nameZh: '稻米',
    emoji: '🌾',
    seedCost: 110,
    sellPrice: 320,
    growHours: 10,
    yieldRange: [3, 5],
    preferredDomains: ['cooking', 'farming'],
    unlockLevel: 3,
    rarity: 'uncommon',
    experience: 20,
  },
  pumpkin: {
    id: 'pumpkin',
    nameZh: '南瓜',
    emoji: '🎃',
    seedCost: 160,
    sellPrice: 480,
    growHours: 14,
    yieldRange: [2, 4],
    preferredDomains: ['cooking', 'art'],
    unlockLevel: 4,
    rarity: 'uncommon',
    experience: 28,
  },
  lavender: {
    id: 'lavender',
    nameZh: '薰衣草',
    emoji: '💜',
    seedCost: 200,
    sellPrice: 620,
    growHours: 18,
    yieldRange: [2, 4],
    preferredDomains: ['psychology', 'romance', 'fashion'],
    unlockLevel: 4,
    rarity: 'rare',
    experience: 36,
  },
  goji: {
    id: 'goji',
    nameZh: '枸杞',
    emoji: '🔴',
    seedCost: 280,
    sellPrice: 920,
    growHours: 30,
    yieldRange: [2, 4],
    preferredDomains: ['medicine', 'wellness'],
    unlockLevel: 4,
    rarity: 'rare',
    experience: 50,
  },
  ginseng: {
    id: 'ginseng',
    nameZh: '人参',
    emoji: '🪴',
    seedCost: 600,
    sellPrice: 2200,
    growHours: 48,
    yieldRange: [1, 2],
    preferredDomains: ['medicine'],
    unlockLevel: 5,
    rarity: 'rare',
    experience: 110,
  },
  snow_lotus: {
    id: 'snow_lotus',
    nameZh: '雪莲',
    emoji: '❄️',
    seedCost: 1100,
    sellPrice: 4200,
    growHours: 72,
    yieldRange: [1, 1],
    preferredDomains: ['medicine'],
    unlockLevel: 6,
    rarity: 'rare',
    experience: 220,
  },
};

export const FARM_CROP_IDS: FarmCropId[] = Object.keys(FARM_CROP_CATALOG) as FarmCropId[];

export function getCropDefinition(cropId: FarmCropId): FarmCropDefinition {
  const def = FARM_CROP_CATALOG[cropId];
  if (!def) throw new Error(`Unknown crop id: ${cropId}`);
  return def;
}

export function isFarmCropId(value: string): value is FarmCropId {
  return Object.prototype.hasOwnProperty.call(FARM_CROP_CATALOG, value);
}

export function computeMaturedAtMs(cropId: FarmCropId, plantedAtMs: number): number {
  return plantedAtMs + getCropDefinition(cropId).growHours * 3600 * 1000;
}

export function computeRottenAtMs(cropId: FarmCropId, plantedAtMs: number): number {
  return computeMaturedAtMs(cropId, plantedAtMs) + 24 * 3600 * 1000;
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
// i18n-ignore-end
