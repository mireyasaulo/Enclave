// 夜市合伙人 — 类型定义
// 8 分钟一轮营业，从 18:00 到 26:00（凌晨 2 点），客流按时段流动。
// 玩家管理 4 个摊位（食物/饮料/文创/游戏），升级、收银，周末双倍客流。

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export type StallKind = "food" | "drink" | "craft" | "game";

export type StallSpec = {
  kind: StallKind;
  name: string;
  emoji: string;
  baseIncome: number; // 1 级时一名顾客的收益
  baseAttract: number; // 1 级时单波最大顾客数基础
  upgradeCostBase: number; // 1→2 升级成本，每级翻倍
  peakHours: number[]; // 此摊位的高峰时段（18-25 整数小时）
};

export type Stall = {
  id: string;
  kind: StallKind;
  level: number; // 1-5
  pendingCustomers: number;
  pendingIncome: number;
  totalCustomersThisRound: number;
  totalIncomeThisRound: number;
};

export type CustomerWave = {
  id: string;
  kind: StallKind;
  spawnedAtMs: number;
  expiresAtMs: number;
  customers: number;
  income: number;
  collected: boolean;
};

export type WeeklyOrderKind = StallKind | "any";

export type WeeklyOrder = {
  id: string;
  label: string;
  kind: WeeklyOrderKind;
  targetCount: number; // 需服务多少顾客
  doneCount: number;
  rewardCoupon: number;
  rewardPermit: number;
  completed: boolean;
};

export type NightMarketLogTone = "info" | "success" | "warn";

export type NightMarketLogEntry = {
  id: string;
  atMs: number;
  text: string;
  tone: NightMarketLogTone;
};

export type NightMarketStatus = "idle" | "running" | "ended";

export type NightMarketState = {
  schemaVersion: 1;
  status: NightMarketStatus;
  startedAtMs: number | null;
  endedAtMs: number | null;
  remainingMs: number;
  stalls: Stall[];
  waves: CustomerWave[];
  hour: number; // 当前营业时段 18-26（含半小时浮动）
  isWeekendBoost: boolean;
  coupon: number; // 夜市券（持久）
  permitTickets: number; // 摊位许可（持久）
  weeklyOrders: WeeklyOrder[];
  weeklyOrderEpochKey: string; // 用于换周重置
  totalCustomersThisRound: number;
  totalIncomeThisRound: number;
  log: NightMarketLogEntry[];
  lastTickAtMs: number;
  nextWaveAtMs: number;
  rngSeed: number;
};
// i18n-ignore-end
