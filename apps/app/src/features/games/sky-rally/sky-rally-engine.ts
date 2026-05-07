import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  BOOST_DURATION_MS,
  BOOST_MULTIPLIER,
  GOOD_WINDOW_PROGRESS,
  LOG_LIMIT,
  PENALTY_DURATION_MS,
  PENALTY_MULTIPLIER,
  PERFECT_BONUS_MULTIPLIER,
  PERFECT_WINDOW_PROGRESS,
  ROUND_DURATION_MS,
  TAP_OPEN_PROGRESS,
  TRACK_LENGTH,
  TRACKS,
  getTrack,
} from "./sky-rally-data";
import type {
  GateState,
  SkyRallyLogTone,
  SkyRallyState,
} from "./sky-rally-types";

const t = translateRuntimeMessage;

let counter = 0;

function nextId(prefix: string, nowMs: number) {
  counter += 1;
  return `${prefix}-${nowMs.toString(36)}-${counter.toString(36)}`;
}

export function cloneState(state: SkyRallyState): SkyRallyState {
  return JSON.parse(JSON.stringify(state)) as SkyRallyState;
}

function buildGates(totalGates: number): GateState[] {
  // 等距离布门：第 i 个门在 (i+1) / (totalGates+1) * 100 处
  const gates: GateState[] = [];
  for (let i = 0; i < totalGates; i++) {
    const ratio = (i + 1) / (totalGates + 1);
    gates.push({
      index: i,
      perfectAtProgress: Number((ratio * TRACK_LENGTH).toFixed(2)),
      resolved: null,
      tappedAtMs: null,
    });
  }
  return gates;
}

export function createInitialState(nowMs: number): SkyRallyState {
  const defaultTrack = TRACKS[0];
  return {
    schemaVersion: 1,
    status: "idle",
    currentTrackId: defaultTrack.id,
    trackProgress: 0,
    speedMultiplier: 1,
    speedBoostUntilMs: 0,
    speedPenaltyUntilMs: 0,
    gates: buildGates(defaultTrack.totalGates),
    upcomingGateIndex: 0,
    hits: { perfect: 0, good: 0, missed: 0 },
    startedAtMs: null,
    endedAtMs: null,
    raceTimeMs: 0,
    outcome: null,
    bestLapByTrack: {},
    starShards: 0,
    paintTokens: 0,
    log: [],
    lastTickAtMs: nowMs,
  };
}

function pushLog(
  state: SkyRallyState,
  text: string,
  tone: SkyRallyLogTone,
  nowMs: number,
) {
  state.log.unshift({ id: nextId("log", nowMs), atMs: nowMs, text, tone });
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

export function selectTrack(
  state: SkyRallyState,
  trackId: string,
  nowMs: number,
): SkyRallyState {
  if (state.status === "racing") return state;
  const track = getTrack(trackId);
  if (!track) return state;
  if (
    track.unlockShards > 0 &&
    state.starShards < track.unlockShards &&
    !(trackId in state.bestLapByTrack)
  ) {
    pushLog(
      state,
      t(msg`星章不够，攒到 ${track.unlockShards} 颗再来 ${track.name}。`),
      "warn",
      nowMs,
    );
    return state;
  }
  state.currentTrackId = trackId;
  state.gates = buildGates(track.totalGates);
  state.trackProgress = 0;
  state.upcomingGateIndex = 0;
  state.outcome = null;
  return state;
}

export function startRace(state: SkyRallyState, nowMs: number): SkyRallyState {
  const track = getTrack(state.currentTrackId);
  if (!track) return state;
  state.status = "racing";
  state.trackProgress = 0;
  state.speedMultiplier = 1;
  state.speedBoostUntilMs = 0;
  state.speedPenaltyUntilMs = 0;
  state.gates = buildGates(track.totalGates);
  state.upcomingGateIndex = 0;
  state.hits = { perfect: 0, good: 0, missed: 0 };
  state.startedAtMs = nowMs;
  state.endedAtMs = null;
  state.raceTimeMs = 0;
  state.outcome = null;
  state.lastTickAtMs = nowMs;
  pushLog(state, t(msg`${track.name} 开赛，把握节拍。`), "info", nowMs);
  return state;
}

function effectiveSpeed(state: SkyRallyState, nowMs: number): number {
  const track = getTrack(state.currentTrackId);
  const base = track?.baseSpeed ?? 1;
  if (nowMs < state.speedPenaltyUntilMs) return base * PENALTY_MULTIPLIER;
  if (nowMs < state.speedBoostUntilMs) return base * state.speedMultiplier;
  return base;
}

export function tick(state: SkyRallyState, nowMs: number): SkyRallyState {
  if (state.status !== "racing") {
    state.lastTickAtMs = nowMs;
    return state;
  }
  const dt = Math.max(0, (nowMs - state.lastTickAtMs) / 1000);
  const speed = effectiveSpeed(state, nowMs);
  // speed 单位是 progress/sec * 5（让赛道在 ~20 秒内可跑完一圈）
  state.trackProgress = Math.min(
    TRACK_LENGTH,
    state.trackProgress + speed * 5 * dt,
  );

  // 自动判过期门：如果赛车跑过门 + TAP_OPEN_PROGRESS 还没点 → missed
  while (state.upcomingGateIndex < state.gates.length) {
    const gate = state.gates[state.upcomingGateIndex];
    const overshoot = state.trackProgress - gate.perfectAtProgress;
    if (overshoot > TAP_OPEN_PROGRESS) {
      gate.resolved = "missed";
      state.hits.missed += 1;
      state.upcomingGateIndex += 1;
      state.speedPenaltyUntilMs = nowMs + PENALTY_DURATION_MS;
      pushLog(
        state,
        t(msg`错过加速门 ${gate.index + 1}，速度被拖慢。`),
        "warn",
        nowMs,
      );
      continue;
    }
    break;
  }

  // 时长 / 完成判定
  const elapsed = nowMs - (state.startedAtMs ?? nowMs);
  state.raceTimeMs = elapsed;
  if (state.trackProgress >= TRACK_LENGTH) {
    finishRace(state, "finished", nowMs);
  } else if (elapsed >= ROUND_DURATION_MS) {
    finishRace(state, "timeout", nowMs);
  }

  state.lastTickAtMs = nowMs;
  return state;
}

export function tapBoost(state: SkyRallyState, nowMs: number): SkyRallyState {
  if (state.status !== "racing") return state;
  if (state.upcomingGateIndex >= state.gates.length) return state;
  const gate = state.gates[state.upcomingGateIndex];
  const distance = gate.perfectAtProgress - state.trackProgress;
  // 距离 < -TAP_OPEN_PROGRESS 已经过期；> TAP_OPEN_PROGRESS 太早
  if (distance > TAP_OPEN_PROGRESS) {
    // 太早：当作 missed
    gate.resolved = "missed";
    gate.tappedAtMs = nowMs;
    state.hits.missed += 1;
    state.upcomingGateIndex += 1;
    state.speedPenaltyUntilMs = nowMs + PENALTY_DURATION_MS;
    pushLog(
      state,
      t(msg`点早了，加速门 ${gate.index + 1} 没踩中。`),
      "warn",
      nowMs,
    );
    return state;
  }
  if (distance < -TAP_OPEN_PROGRESS) {
    return state;
  }
  const absDist = Math.abs(distance);
  if (absDist <= PERFECT_WINDOW_PROGRESS) {
    gate.resolved = "perfect";
    state.hits.perfect += 1;
    state.speedMultiplier = PERFECT_BONUS_MULTIPLIER;
    state.speedBoostUntilMs = nowMs + BOOST_DURATION_MS;
    pushLog(
      state,
      t(msg`完美加速门 ${gate.index + 1} ×1.9 速度。`),
      "success",
      nowMs,
    );
  } else if (absDist <= GOOD_WINDOW_PROGRESS) {
    gate.resolved = "good";
    state.hits.good += 1;
    state.speedMultiplier = BOOST_MULTIPLIER;
    state.speedBoostUntilMs = nowMs + BOOST_DURATION_MS;
    pushLog(
      state,
      t(msg`稳稳点中加速门 ${gate.index + 1}。`),
      "success",
      nowMs,
    );
  } else {
    gate.resolved = "missed";
    state.hits.missed += 1;
    state.speedPenaltyUntilMs = nowMs + PENALTY_DURATION_MS;
    pushLog(
      state,
      t(msg`抢拍偏了，加速门 ${gate.index + 1} 没踩中。`),
      "warn",
      nowMs,
    );
  }
  gate.tappedAtMs = nowMs;
  state.upcomingGateIndex += 1;
  return state;
}

function finishRace(
  state: SkyRallyState,
  outcome: "finished" | "timeout",
  nowMs: number,
) {
  // 把剩下的门标 missed
  for (let i = state.upcomingGateIndex; i < state.gates.length; i++) {
    if (state.gates[i].resolved === null) {
      state.gates[i].resolved = "missed";
      state.hits.missed += 1;
    }
  }
  state.upcomingGateIndex = state.gates.length;
  state.status = "ended";
  state.endedAtMs = nowMs;
  state.outcome = outcome;
  state.raceTimeMs = nowMs - (state.startedAtMs ?? nowMs);
  const track = getTrack(state.currentTrackId);
  let shards = 0;
  let paint = 0;
  if (outcome === "finished" && track) {
    // 完成时间越短星章越多
    const timeRatio = state.raceTimeMs / ROUND_DURATION_MS;
    if (timeRatio < 0.65) shards = 3;
    else if (timeRatio < 0.8) shards = 2;
    else shards = 1;
    if (state.hits.perfect >= track.totalGates - 1) shards += 1;
    if (track.isLimited) paint += 1;
    const prevBest = state.bestLapByTrack[track.id] ?? Infinity;
    if (state.raceTimeMs < prevBest) {
      state.bestLapByTrack[track.id] = state.raceTimeMs;
      pushLog(
        state,
        t(msg`刷新 ${track.name} 最佳圈速。`),
        "success",
        nowMs,
      );
    }
    pushLog(
      state,
      t(
        msg`完赛 ${track.name}：${(state.raceTimeMs / 1000).toFixed(1)} 秒 / +${shards} 星章。`,
      ),
      "success",
      nowMs,
    );
  } else if (track) {
    // 超时：按完成度给一点星章
    const pct = Math.round(state.trackProgress);
    if (pct >= 80) shards = 1;
    pushLog(
      state,
      t(msg`时间到，本圈完成度 ${pct}%。`),
      "info",
      nowMs,
    );
  }
  state.starShards += shards;
  state.paintTokens += paint;
}

export function abandonRace(state: SkyRallyState, nowMs: number): SkyRallyState {
  if (state.status !== "racing") return state;
  state.status = "ended";
  state.endedAtMs = nowMs;
  state.outcome = "abandoned";
  state.raceTimeMs = nowMs - (state.startedAtMs ?? nowMs);
  pushLog(state, t(msg`放弃本圈，下次再来。`), "info", nowMs);
  return state;
}

export function backToIdle(state: SkyRallyState): SkyRallyState {
  state.status = "idle";
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.outcome = null;
  state.trackProgress = 0;
  state.upcomingGateIndex = 0;
  state.speedBoostUntilMs = 0;
  state.speedPenaltyUntilMs = 0;
  const track = getTrack(state.currentTrackId);
  if (track) state.gates = buildGates(track.totalGates);
  return state;
}
