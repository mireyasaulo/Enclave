import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { StallKind, StallSpec } from "./night-market-types";

const t = translateRuntimeMessage;

export const ROUND_DURATION_MS = 8 * 60 * 1000;
export const HOUR_START = 18;
export const HOUR_END = 26;
export const WAVE_MIN_GAP_MS = 4500;
export const WAVE_MAX_GAP_MS = 8500;
export const WAVE_LIFETIME_MS = 14000;
export const LOG_LIMIT = 32;
export const MAX_LEVEL = 5;
export const PEAK_INCOME_BONUS = 1.4;
export const WEEKEND_INCOME_BONUS = 2;
export const PERMIT_TICKET_FOR_HIGH_INCOME = 600;
export const COUPON_PER_LEVEL_UPGRADE_DISCOUNT = 0;

export const STALL_SPECS: Record<StallKind, StallSpec> = {
  food: {
    kind: "food",
    name: t(msg`卤味烤串摊`),
    emoji: "🍡",
    baseIncome: 12,
    baseAttract: 6,
    upgradeCostBase: 80,
    peakHours: [19, 20, 21],
  },
  drink: {
    kind: "drink",
    name: t(msg`柠茶气泡摊`),
    emoji: "🧋",
    baseIncome: 9,
    baseAttract: 7,
    upgradeCostBase: 70,
    peakHours: [18, 19, 22],
  },
  craft: {
    kind: "craft",
    name: t(msg`手作文创摊`),
    emoji: "🎐",
    baseIncome: 18,
    baseAttract: 4,
    upgradeCostBase: 110,
    peakHours: [20, 21, 22],
  },
  game: {
    kind: "game",
    name: t(msg`套圈打靶摊`),
    emoji: "🎯",
    baseIncome: 14,
    baseAttract: 5,
    upgradeCostBase: 95,
    peakHours: [21, 22, 23],
  },
};

export const STALL_KIND_ORDER: StallKind[] = ["food", "drink", "craft", "game"];

export const STALL_KIND_LABEL: Record<StallKind, string> = {
  food: t(msg`食物`),
  drink: t(msg`饮品`),
  craft: t(msg`文创`),
  game: t(msg`游戏`),
};

export function attractAtLevel(spec: StallSpec, level: number): number {
  // 每级 + base * 0.4 顾客
  return Math.round(spec.baseAttract * (1 + (level - 1) * 0.4));
}

export function incomePerCustomerAtLevel(spec: StallSpec, level: number): number {
  return Math.round(spec.baseIncome * (1 + (level - 1) * 0.35));
}

export function upgradeCost(spec: StallSpec, currentLevel: number): number {
  // 1→2: base; 2→3: base*2; ...
  return spec.upgradeCostBase * Math.pow(2, currentLevel - 1);
}

export function getStallSpec(kind: StallKind): StallSpec {
  return STALL_SPECS[kind];
}
