// 天空竞速 — 类型定义
// 一条赛道 8-12 个加速门，2 分钟冲线。节奏式点击：加速门进入窗口时点 boost。

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export type Track = {
  id: string;
  name: string;
  blurb: string;
  totalGates: number;
  baseSpeed: number; // 速度倍数（progress per second）
  unlockShards: number; // 0 = 默认开放
  badgeColor: "ocean" | "violet" | "sunset" | "forest" | "gold";
  isLimited?: boolean;
};

export type GateOutcome = "perfect" | "good" | "missed";

export type GateState = {
  index: number;
  perfectAtProgress: number; // 0-100
  resolved: GateOutcome | null;
  tappedAtMs: number | null;
};

export type SkyRallyLogTone = "info" | "success" | "warn";

export type SkyRallyLogEntry = {
  id: string;
  atMs: number;
  text: string;
  tone: SkyRallyLogTone;
};

export type SkyRallyOutcome = "finished" | "timeout" | "abandoned";

export type SkyRallyStatus = "idle" | "racing" | "ended";

export type SkyRallyState = {
  schemaVersion: 1;
  status: SkyRallyStatus;
  currentTrackId: string;
  trackProgress: number; // 0-100
  speedMultiplier: number;
  speedBoostUntilMs: number;
  speedPenaltyUntilMs: number;
  gates: GateState[];
  upcomingGateIndex: number;
  hits: { perfect: number; good: number; missed: number };
  startedAtMs: number | null;
  endedAtMs: number | null;
  raceTimeMs: number;
  outcome: SkyRallyOutcome | null;
  bestLapByTrack: Record<string, number>; // ms
  starShards: number;
  paintTokens: number;
  log: SkyRallyLogEntry[];
  lastTickAtMs: number;
};
// i18n-ignore-end
