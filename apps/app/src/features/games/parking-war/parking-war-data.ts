import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { CarSpec, CarTier, NpcOpponent } from "./parking-war-types";

const t = translateRuntimeMessage;

export const PLAYER_LOT_ID = "player";
export const PLAYER_LOT_SIZE = 7;
export const NPC_LOT_SIZE = 5;
export const OFFLINE_CATCHUP_CAP_MS = 2 * 60 * 60 * 1000;
export const PLAYER_FINE_RISK_PER_MINUTE = 0.05;
export const PLAYER_GARAGE_LIMIT = 4;
export const STARTING_BALANCE = 200;
export const DAILY_BONUS_AMOUNT = 50;
export const VISIT_LOG_LIMIT = 60;

export const CAR_SPECS: Record<CarTier, CarSpec> = {
  starter: {
    tier: "starter",
    name: t(msg`代步车`),
    emoji: "🚗",
    ratePerMinute: 1,
    unlockCost: 0,
  },
  family: {
    tier: "family",
    name: t(msg`家用车`),
    emoji: "🚙",
    ratePerMinute: 3,
    unlockCost: 200,
  },
  business: {
    tier: "business",
    name: t(msg`商务车`),
    emoji: "🚐",
    ratePerMinute: 5,
    unlockCost: 600,
  },
  performance: {
    tier: "performance",
    name: t(msg`性能车`),
    emoji: "🏎️",
    ratePerMinute: 9,
    unlockCost: 1500,
  },
  luxury: {
    tier: "luxury",
    name: t(msg`豪华车`),
    emoji: "🚘",
    ratePerMinute: 15,
    unlockCost: 4500,
  },
  super: {
    tier: "super",
    name: t(msg`超跑`),
    emoji: "🏁",
    ratePerMinute: 26,
    unlockCost: 12000,
  },
};

export const CAR_TIER_ORDER: CarTier[] = [
  "starter",
  "family",
  "business",
  "performance",
  "luxury",
  "super",
];

// NPC 对手取自隐界世界里既有的角色（fixed-world-character-presets / default-characters）。
// 每个 NPC 的 welcomeQuote / 性格风格按其本身角色定位写，不照搬任何外部素材。
// parkAggressiveness：每分钟主动来玩家车场的概率；fineRiskPerMinute：玩家车停他车场每分钟被贴条概率。
export const NPC_OPPONENTS: NpcOpponent[] = [
  {
    id: "npc-axun",
    name: t(msg`阿巡`),
    worldCharacterId: "char-manual-axun",
    blurb: t(msg`刷朋友圈刷到一半就来你这停一脚。`),
    welcomeQuote: t(msg`你这车位真是真人停的吧，我先停一会儿。`),
    carEmoji: "🚙",
    carName: t(msg`阿巡的代步车`),
    carRatePerMinute: 2,
    fineRiskPerMinute: 0.04,
    parkAggressiveness: 0.18,
    startingBalance: 380,
  },
  {
    id: "npc-lin-chen",
    name: t(msg`林晨`),
    worldCharacterId: "lin_chen_sleep_support",
    blurb: t(msg`夜班结束顺路把车甩你这。`),
    welcomeQuote: t(msg`我刚下班，让我在你这眯一下。`),
    carEmoji: "🚐",
    carName: t(msg`林晨的夜班车`),
    carRatePerMinute: 3,
    fineRiskPerMinute: 0.06,
    parkAggressiveness: 0.14,
    startingBalance: 520,
  },
  {
    id: "npc-xu-zhe",
    name: t(msg`徐喆`),
    worldCharacterId: "xu_zhe_career_growth",
    blurb: t(msg`通勤狂魔，车位嗅觉很灵。`),
    welcomeQuote: t(msg`我对车位有 KPI，请允许我占一格。`),
    carEmoji: "🚗",
    carName: t(msg`徐喆的通勤车`),
    carRatePerMinute: 4,
    fineRiskPerMinute: 0.09,
    parkAggressiveness: 0.22,
    startingBalance: 880,
  },
  {
    id: "npc-su-yu",
    name: t(msg`苏雨`),
    worldCharacterId: "su_yu_english_coach",
    blurb: t(msg`上完课就往最近的空位钻。`),
    welcomeQuote: t(msg`Excuse my parking, 我下节课五分钟就回来。`),
    carEmoji: "🚕",
    carName: t(msg`苏雨的小黄车`),
    carRatePerMinute: 4,
    fineRiskPerMinute: 0.05,
    parkAggressiveness: 0.16,
    startingBalance: 640,
  },
  {
    id: "npc-zhou-ran",
    name: t(msg`周冉`),
    worldCharacterId: "zhou_ran_fitness_coach",
    blurb: t(msg`撸完铁来加个油，顺便占位。`),
    welcomeQuote: t(msg`我训练完路过，借个位喝两口水。`),
    carEmoji: "🏎️",
    carName: t(msg`周冉的性能车`),
    carRatePerMinute: 7,
    fineRiskPerMinute: 0.08,
    parkAggressiveness: 0.20,
    startingBalance: 1280,
  },
  {
    id: "npc-lin-mian",
    name: t(msg`林眠`),
    worldCharacterId: "lin_mian_sleep_support",
    blurb: t(msg`睡眠咨询师，停车也很轻。`),
    welcomeQuote: t(msg`我把车放这小睡一会儿，别叫我。`),
    carEmoji: "🚙",
    carName: t(msg`林眠的安静车`),
    carRatePerMinute: 5,
    fineRiskPerMinute: 0.04,
    parkAggressiveness: 0.10,
    startingBalance: 460,
  },
  {
    id: "npc-bar-expert",
    name: t(msg`酒馆老板`),
    worldCharacterId: "char-default-bar-expert",
    blurb: t(msg`下半夜出没，车都贵。`),
    welcomeQuote: t(msg`我打烊了路过，你这位置不错。`),
    carEmoji: "🚘",
    carName: t(msg`老板的豪华车`),
    carRatePerMinute: 11,
    fineRiskPerMinute: 0.10,
    parkAggressiveness: 0.12,
    startingBalance: 2400,
  },
];

const NPC_BY_ID = new Map(NPC_OPPONENTS.map((npc) => [npc.id, npc] as const));

export function getNpcById(npcId: string): NpcOpponent | null {
  return NPC_BY_ID.get(npcId) ?? null;
}
