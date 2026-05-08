// 信号小队 — 类型定义
// 玩家带 3 人小队（玩家 + 2 NPC），3 分钟内压制信号塔。
// 每隔几秒触发一次"信号事件"，玩家点击对应队员响应。

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export type Skill = "scout" | "sniper" | "medic";

export type Squadmate = {
  id: string;
  name: string;
  worldCharacterId?: string;
  emoji: string;
  blurb: string;
  skill: Skill;
  maxHp: number;
  maxMorale: number;
};

export type SquadmateState = {
  id: string;
  hp: number;
  morale: number;
  busyUntilMs: number; // 响应事件后短暂忙碌
  resolves: number; // 本局成功响应次数
};

export type SignalEventKind = "enemy" | "sync" | "supply";

// enemy 需要特定 skill；sync 需要任意两位队员相继点击；supply 任意一位队员都行。
export type SignalEvent = {
  id: string;
  kind: SignalEventKind;
  needSkill: Skill | null; // 仅 enemy 用
  spawnedAtMs: number;
  expiresAtMs: number;
  matchedBy: string[]; // sync: 已点击的队员 id 列表
  resolved: "ok" | "missed" | null;
  rewardTower: number;
  penaltyTower: number;
};

export type SignalLogTone = "info" | "success" | "warn";

export type SignalLogEntry = {
  id: string;
  atMs: number;
  text: string;
  tone: SignalLogTone;
};

export type SignalRoundStatus =
  | "idle"
  | "running"
  | "victory"
  | "defeat"
  | "timeout";

export type SignalSquadState = {
  schemaVersion: 1;
  status: SignalRoundStatus;
  squad: SquadmateState[]; // 当前选中的 3 名队员状态
  selectedSquadIds: string[]; // 选中的队员 id（与 squad 同步）
  tower: number; // 0-100
  events: SignalEvent[]; // 历史 + 当前事件
  activeEventId: string | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
  remainingMs: number;
  syncSkillReadyAtMs: number; // 协同压制技能冷却到期时间
  syncSkillUses: number;
  resolvedCount: number;
  missedCount: number;
  badgePoints: number; // 当前赛季累计徽章分
  teamScore: number; // 当前赛季累计团队积分
  log: SignalLogEntry[];
  lastTickAtMs: number;
  rngSeed: number;
};
// i18n-ignore-end
