import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

// 云上农场 — MVP：5 块地 / 3 种作物 / 浇水加速 / 周联营订单 / 互访邻居

export type CropKind = "carrot" | "strawberry" | "corn";

export type CropSpec = {
  kind: CropKind;
  name: string;
  emoji: string;
  seedlingEmoji: string;
  growingEmoji: string;
  ripeEmoji: string;
  witheredEmoji: string;
  baseGrowMs: number;
  seedCost: number;
  sellPrice: number;
  experience: number;
};

export const PLOT_COUNT = 5;
export const MAX_WATERINGS = 2;
export const WATER_SPEEDUP_MS = 25 * 1000;
export const WITHER_AFTER_RIPE_MS = 60 * 1000;
export const NEIGHBOR_HELP_REWARD = 28;
export const NEIGHBOR_HELP_COOLDOWN_MS = 30 * 1000;
export const LOG_LIMIT = 24;

export const CROPS: Record<CropKind, CropSpec> = {
  carrot: {
    kind: "carrot",
    name: t(msg`胡萝卜`),
    emoji: "🥕",
    seedlingEmoji: "🌱",
    growingEmoji: "🌿",
    ripeEmoji: "🥕",
    witheredEmoji: "🍂",
    baseGrowMs: 60 * 1000,
    seedCost: 30,
    sellPrice: 90,
    experience: 4,
  },
  strawberry: {
    kind: "strawberry",
    name: t(msg`草莓`),
    emoji: "🍓",
    seedlingEmoji: "🌱",
    growingEmoji: "🍃",
    ripeEmoji: "🍓",
    witheredEmoji: "🍂",
    baseGrowMs: 90 * 1000,
    seedCost: 50,
    sellPrice: 160,
    experience: 7,
  },
  corn: {
    kind: "corn",
    name: t(msg`玉米`),
    emoji: "🌽",
    seedlingEmoji: "🌱",
    growingEmoji: "🌿",
    ripeEmoji: "🌽",
    witheredEmoji: "🍂",
    baseGrowMs: 120 * 1000,
    seedCost: 80,
    sellPrice: 250,
    experience: 11,
  },
};

export const CROP_ORDER: CropKind[] = ["carrot", "strawberry", "corn"];

export type WeeklyOrderKind = CropKind | "neighbor" | "any";

export type WeeklyOrder = {
  id: string;
  label: string;
  kind: WeeklyOrderKind;
  target: number;
  done: number;
  reward: number;
  completed: boolean;
};

export function buildWeeklyOrders(): WeeklyOrder[] {
  return [
    {
      id: "wk-carrot",
      label: t(msg`收 5 个胡萝卜`),
      kind: "carrot",
      target: 5,
      done: 0,
      reward: 90,
      completed: false,
    },
    {
      id: "wk-strawberry",
      label: t(msg`收 3 个草莓`),
      kind: "strawberry",
      target: 3,
      done: 0,
      reward: 120,
      completed: false,
    },
    {
      id: "wk-neighbor",
      label: t(msg`帮邻居浇水 3 次`),
      kind: "neighbor",
      target: 3,
      done: 0,
      reward: 80,
      completed: false,
    },
  ];
}

export function getCrop(kind: CropKind): CropSpec {
  return CROPS[kind];
}
