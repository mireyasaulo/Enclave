// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  FARM_DEFAULT_PLOT_COUNT,
  FARM_DOG_BLOCK_BASE_RATE,
  FARM_DOG_ENERGY_DECAY_PER_HOUR,
  FARM_LEVEL_EXPERIENCE_THRESHOLDS,
  FARM_LEVEL_PLOT_UNLOCKS,
  FarmConsumableDefinition,
  FarmConsumableId,
  FarmCropDefinition,
  FarmCropId,
  FarmDogState,
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

export const FARM_CONSUMABLE_CATALOG: Record<FarmConsumableId, FarmConsumableDefinition> = {
  fertilizer: {
    id: 'fertilizer',
    nameZh: '化肥',
    emoji: '💩',
    price: 120,
    unlockLevel: 2,
    descriptionZh: '把作物剩余成长时间砍掉一半，每株作物只能用一次。',
  },
  pesticide: {
    id: 'pesticide',
    nameZh: '农药',
    emoji: '🧴',
    price: 80,
    unlockLevel: 2,
    descriptionZh: '立刻清掉害虫，并在 12 小时内免疫虫害。',
  },
  dog_food: {
    id: 'dog_food',
    nameZh: '狗粮',
    emoji: '🦴',
    price: 50,
    unlockLevel: 5,
    descriptionZh: '喂一次看家狗：回复 60 点能量，让它继续帮你看菜地。',
  },
};

export const FARM_CONSUMABLE_IDS: FarmConsumableId[] = Object.keys(
  FARM_CONSUMABLE_CATALOG,
) as FarmConsumableId[];

export function getConsumableDefinition(id: FarmConsumableId): FarmConsumableDefinition {
  const def = FARM_CONSUMABLE_CATALOG[id];
  if (!def) throw new Error(`Unknown consumable id: ${id}`);
  return def;
}

export function isFarmConsumableId(value: string): value is FarmConsumableId {
  return Object.prototype.hasOwnProperty.call(FARM_CONSUMABLE_CATALOG, value);
}

export function createDefaultDog(): FarmDogState {
  return { level: 0, energy: 0, lastFedAt: null };
}

// 按 (now - lastFedAt) 算出当前能量，不写库，纯计算函数。
export function computeDogEnergy(dog: FarmDogState | null | undefined, nowMs: number): number {
  if (!dog || dog.level <= 0) return 0;
  if (dog.lastFedAt == null) return dog.energy;
  const hours = Math.max(0, (nowMs - dog.lastFedAt) / 3_600_000);
  const decayed = dog.energy - FARM_DOG_ENERGY_DECAY_PER_HOUR * hours;
  return Math.max(0, Math.min(100, decayed));
}

// 看家狗拦截偷菜：能量越足、等级越高，拦截率越高。
// energy<30 防御减半（狗饿了）；level=0 直接 0。
export function computeDogBlockRate(dog: FarmDogState | null | undefined, nowMs: number): number {
  if (!dog || dog.level <= 0) return 0;
  const energy = computeDogEnergy(dog, nowMs);
  const baseRate = FARM_DOG_BLOCK_BASE_RATE * dog.level;
  const energyMultiplier = energy < 30 ? 0.5 : 1;
  return Math.min(0.92, baseRate * energyMultiplier);
}
// i18n-ignore-end
