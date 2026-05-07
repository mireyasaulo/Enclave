import type { CarSpec, CarTier, NpcOpponent } from "./parking-war-types";

export const PLAYER_LOT_ID = "player";
export const PLAYER_LOT_SIZE = 6;
export const NPC_LOT_SIZE = 4;
export const OFFLINE_CATCHUP_CAP_MS = 2 * 60 * 60 * 1000;
export const PLAYER_FINE_RISK_PER_MINUTE = 0.05;
export const PLAYER_GARAGE_LIMIT = 3;
export const STARTING_BALANCE = 100;

export const CAR_SPECS: Record<CarTier, CarSpec> = {
  starter: {
    tier: "starter",
    name: "代步车",
    emoji: "🚗",
    ratePerMinute: 1,
    unlockCost: 0,
  },
  family: {
    tier: "family",
    name: "家用车",
    emoji: "🚙",
    ratePerMinute: 3,
    unlockCost: 200,
  },
  performance: {
    tier: "performance",
    name: "性能车",
    emoji: "🏎️",
    ratePerMinute: 6,
    unlockCost: 600,
  },
  luxury: {
    tier: "luxury",
    name: "豪华车",
    emoji: "🚘",
    ratePerMinute: 12,
    unlockCost: 2000,
  },
};

export const CAR_TIER_ORDER: CarTier[] = [
  "starter",
  "family",
  "performance",
  "luxury",
];

// NPC 对手取自世界里已有的角色（apps/app 角色源 / api 模块下的 fixed-world-character-presets / default-characters）。
// 这里只引用 name + sourceKey + 简介的 flavor，不依赖后端实时拉取，离线也能玩。
export const NPC_OPPONENTS: NpcOpponent[] = [
  {
    id: "npc-axun",
    name: "阿巡",
    worldCharacterId: "char-manual-axun",
    blurb: "一刷朋友圈就来你这停一脚。",
    carEmoji: "🚙",
    carName: "阿巡的代步车",
    carRatePerMinute: 2,
    fineRiskPerMinute: 0.04,
  },
  {
    id: "npc-lin-chen",
    name: "林晨",
    worldCharacterId: "lin_chen_sleep_support",
    blurb: "夜班结束顺路把车甩你这。",
    carEmoji: "🚐",
    carName: "林晨的夜班车",
    carRatePerMinute: 3,
    fineRiskPerMinute: 0.06,
  },
  {
    id: "npc-xu-zhe",
    name: "徐喆",
    worldCharacterId: "xu_zhe_career_growth",
    blurb: "通勤狂魔，车位嗅觉很灵。",
    carEmoji: "🚗",
    carName: "徐喆的通勤车",
    carRatePerMinute: 4,
    fineRiskPerMinute: 0.08,
  },
  {
    id: "npc-su-yu",
    name: "苏雨",
    worldCharacterId: "su_yu_english_coach",
    blurb: "上完课就往最近的空位钻。",
    carEmoji: "🚕",
    carName: "苏雨的小黄车",
    carRatePerMinute: 3,
    fineRiskPerMinute: 0.05,
  },
  {
    id: "npc-zhou-ran",
    name: "周冉",
    worldCharacterId: "zhou_ran_fitness_coach",
    blurb: "撸完铁来加个油，顺便占位。",
    carEmoji: "🏎️",
    carName: "周冉的性能车",
    carRatePerMinute: 5,
    fineRiskPerMinute: 0.07,
  },
  {
    id: "npc-lin-mian",
    name: "林眠",
    worldCharacterId: "lin_mian_sleep_support",
    blurb: "睡眠咨询师，停车也很轻。",
    carEmoji: "🚙",
    carName: "林眠的安静车",
    carRatePerMinute: 4,
    fineRiskPerMinute: 0.04,
  },
];

export function getNpcById(npcId: string): NpcOpponent | null {
  return NPC_OPPONENTS.find((npc) => npc.id === npcId) ?? null;
}
