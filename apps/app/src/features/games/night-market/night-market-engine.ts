import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  HOUR_END,
  HOUR_START,
  LOG_LIMIT,
  MAX_LEVEL,
  PEAK_INCOME_BONUS,
  ROUND_DURATION_MS,
  STALL_KIND_LABEL,
  STALL_KIND_ORDER,
  WAVE_LIFETIME_MS,
  WAVE_MAX_GAP_MS,
  WAVE_MIN_GAP_MS,
  WEEKEND_INCOME_BONUS,
  attractAtLevel,
  getStallSpec,
  incomePerCustomerAtLevel,
  upgradeCost,
} from "./night-market-data";
import type {
  CustomerWave,
  NightMarketLogTone,
  NightMarketState,
  Stall,
  StallKind,
  WeeklyOrder,
  WeeklyOrderKind,
} from "./night-market-types";

const t = translateRuntimeMessage;

let counter = 0;

function nextId(prefix: string, nowMs: number) {
  counter += 1;
  return `${prefix}-${nowMs.toString(36)}-${counter.toString(36)}`;
}

function rng(seed: number) {
  let value = seed | 0;
  return () => {
    value = (value * 1664525 + 1013904223) | 0;
    return ((value >>> 0) % 1_000_000) / 1_000_000;
  };
}

function bumpSeed(state: NightMarketState) {
  state.rngSeed = (state.rngSeed * 1103515245 + 12345) | 0;
}

export function cloneState(state: NightMarketState): NightMarketState {
  return JSON.parse(JSON.stringify(state)) as NightMarketState;
}

function makeStall(kind: StallKind, level = 1): Stall {
  return {
    id: `stall-${kind}`,
    kind,
    level,
    pendingCustomers: 0,
    pendingIncome: 0,
    totalCustomersThisRound: 0,
    totalIncomeThisRound: 0,
  };
}

function isWeekend(nowMs: number) {
  const day = new Date(nowMs).getDay();
  return day === 0 || day === 6;
}

function weekKey(nowMs: number) {
  const d = new Date(nowMs);
  const year = d.getFullYear();
  // ISO week-ish but cheap：取一年第几周（按 7 天分桶）
  const start = new Date(year, 0, 1).getTime();
  const week = Math.floor((nowMs - start) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-w${week}`;
}

function makeWeeklyOrders(): WeeklyOrder[] {
  return [
    {
      id: "wk-food",
      label: t(msg`卤味摊招待 30 位顾客`),
      kind: "food",
      targetCount: 30,
      doneCount: 0,
      rewardCoupon: 200,
      rewardPermit: 0,
      completed: false,
    },
    {
      id: "wk-craft",
      label: t(msg`文创摊招待 18 位顾客`),
      kind: "craft",
      targetCount: 18,
      doneCount: 0,
      rewardCoupon: 240,
      rewardPermit: 1,
      completed: false,
    },
    {
      id: "wk-any",
      label: t(msg`周内本场总顾客达 80 位`),
      kind: "any",
      targetCount: 80,
      doneCount: 0,
      rewardCoupon: 0,
      rewardPermit: 1,
      completed: false,
    },
  ];
}

export function createInitialState(nowMs: number): NightMarketState {
  return {
    schemaVersion: 1,
    status: "idle",
    startedAtMs: null,
    endedAtMs: null,
    remainingMs: ROUND_DURATION_MS,
    stalls: STALL_KIND_ORDER.map((kind) => makeStall(kind)),
    waves: [],
    hour: HOUR_START,
    isWeekendBoost: isWeekend(nowMs),
    coupon: 80,
    permitTickets: 0,
    weeklyOrders: makeWeeklyOrders(),
    weeklyOrderEpochKey: weekKey(nowMs),
    totalCustomersThisRound: 0,
    totalIncomeThisRound: 0,
    log: [],
    lastTickAtMs: nowMs,
    nextWaveAtMs: nowMs,
    rngSeed: (nowMs ^ 0xa3779b97) | 1,
  };
}

function pushLog(
  state: NightMarketState,
  text: string,
  tone: NightMarketLogTone,
  nowMs: number,
) {
  state.log.unshift({ id: nextId("log", nowMs), atMs: nowMs, text, tone });
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

function ensureWeeklyOrders(state: NightMarketState, nowMs: number) {
  const cur = weekKey(nowMs);
  if (cur !== state.weeklyOrderEpochKey) {
    state.weeklyOrderEpochKey = cur;
    state.weeklyOrders = makeWeeklyOrders();
  }
}

export function startRound(
  state: NightMarketState,
  nowMs: number,
): NightMarketState {
  ensureWeeklyOrders(state, nowMs);
  state.status = "running";
  state.startedAtMs = nowMs;
  state.endedAtMs = null;
  state.remainingMs = ROUND_DURATION_MS;
  state.hour = HOUR_START;
  state.isWeekendBoost = isWeekend(nowMs);
  state.waves = [];
  state.totalCustomersThisRound = 0;
  state.totalIncomeThisRound = 0;
  state.lastTickAtMs = nowMs;
  state.nextWaveAtMs = nowMs + 1500;
  for (const stall of state.stalls) {
    stall.pendingCustomers = 0;
    stall.pendingIncome = 0;
    stall.totalCustomersThisRound = 0;
    stall.totalIncomeThisRound = 0;
  }
  pushLog(
    state,
    state.isWeekendBoost
      ? t(msg`周末夜市开张，客流双倍。`)
      : t(msg`夜市开张，今晚加油。`),
    "info",
    nowMs,
  );
  return state;
}

function pickWaveKind(state: NightMarketState): StallKind {
  const random = rng(state.rngSeed);
  bumpSeed(state);
  // 高峰时段对应摊位概率提升
  const weights = STALL_KIND_ORDER.map((kind) => {
    const spec = getStallSpec(kind);
    const peak = spec.peakHours.includes(Math.floor(state.hour));
    return peak ? 2 : 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = random() * total;
  for (let i = 0; i < STALL_KIND_ORDER.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return STALL_KIND_ORDER[i];
  }
  return STALL_KIND_ORDER[0];
}

function spawnWave(state: NightMarketState, nowMs: number) {
  const kind = pickWaveKind(state);
  const spec = getStallSpec(kind);
  const stall = state.stalls.find((s) => s.kind === kind);
  if (!stall) return;
  const random = rng(state.rngSeed);
  bumpSeed(state);
  const attractCap = attractAtLevel(spec, stall.level);
  const minAttract = Math.max(1, Math.floor(attractCap * 0.4));
  const customers = Math.max(
    1,
    Math.round(minAttract + random() * (attractCap - minAttract)),
  );
  const peak = spec.peakHours.includes(Math.floor(state.hour));
  const peakBonus = peak ? PEAK_INCOME_BONUS : 1;
  const weekendBonus = state.isWeekendBoost ? WEEKEND_INCOME_BONUS : 1;
  const perCustomer = incomePerCustomerAtLevel(spec, stall.level);
  const income = Math.round(customers * perCustomer * peakBonus * weekendBonus);
  const wave: CustomerWave = {
    id: nextId("wave", nowMs),
    kind,
    spawnedAtMs: nowMs,
    expiresAtMs: nowMs + WAVE_LIFETIME_MS,
    customers,
    income,
    collected: false,
  };
  state.waves.push(wave);
  // 直接累加到摊位 pending（顾客已经到场）
  stall.pendingCustomers += customers;
  stall.pendingIncome += income;
  pushLog(
    state,
    t(msg`${spec.name} 涌来 ${customers} 位顾客（待收银 ${income} 券）。`),
    "info",
    nowMs,
  );
}

function planNextWave(state: NightMarketState, nowMs: number) {
  const random = rng(state.rngSeed ^ 0x5a17);
  bumpSeed(state);
  const gap = WAVE_MIN_GAP_MS + random() * (WAVE_MAX_GAP_MS - WAVE_MIN_GAP_MS);
  // 越靠近凌晨客流稀疏（gap 翻倍）
  const lateNightFactor = state.hour >= 24 ? 1.6 : 1;
  state.nextWaveAtMs = nowMs + gap * lateNightFactor;
}

function expireOldWaves(state: NightMarketState, nowMs: number) {
  const survivors: CustomerWave[] = [];
  for (const wave of state.waves) {
    if (nowMs >= wave.expiresAtMs && !wave.collected) {
      // 顾客等到走人：从对应摊位扣 pending
      const stall = state.stalls.find((s) => s.kind === wave.kind);
      if (stall) {
        stall.pendingCustomers = Math.max(0, stall.pendingCustomers - wave.customers);
        stall.pendingIncome = Math.max(0, stall.pendingIncome - wave.income);
      }
      pushLog(
        state,
        t(msg`${getStallSpec(wave.kind).name} 顾客等不及走了 ${wave.customers} 位。`),
        "warn",
        nowMs,
      );
    } else {
      survivors.push(wave);
    }
  }
  state.waves = survivors;
}

export function tick(state: NightMarketState, nowMs: number): NightMarketState {
  if (state.status !== "running") {
    state.lastTickAtMs = nowMs;
    return state;
  }
  const elapsed = nowMs - (state.startedAtMs ?? nowMs);
  state.remainingMs = Math.max(0, ROUND_DURATION_MS - elapsed);
  // 8 分钟映射到 18:00 → 26:00（共 8 小时）：1 分钟 = 1 小时
  state.hour =
    HOUR_START + ((HOUR_END - HOUR_START) * elapsed) / ROUND_DURATION_MS;

  expireOldWaves(state, nowMs);

  if (nowMs >= state.nextWaveAtMs && state.waves.length < 6) {
    spawnWave(state, nowMs);
    planNextWave(state, nowMs);
  }

  if (state.remainingMs <= 0) {
    finishRound(state, nowMs);
  }
  state.lastTickAtMs = nowMs;
  return state;
}

function finishRound(state: NightMarketState, nowMs: number) {
  state.status = "ended";
  state.endedAtMs = nowMs;
  // 把没收的 pending 也按 60% 折扣自动收掉
  for (const stall of state.stalls) {
    if (stall.pendingIncome <= 0) continue;
    const collected = Math.round(stall.pendingIncome * 0.6);
    state.coupon += collected;
    state.totalIncomeThisRound += collected;
    state.totalCustomersThisRound += stall.pendingCustomers;
    stall.totalCustomersThisRound += stall.pendingCustomers;
    stall.totalIncomeThisRound += collected;
    bumpWeekly(state, stall.kind, stall.pendingCustomers, nowMs);
    stall.pendingCustomers = 0;
    stall.pendingIncome = 0;
  }
  // 高收益奖励：本轮收益 ≥ 阈值送一张许可
  if (state.totalIncomeThisRound >= 600) {
    state.permitTickets += 1;
    pushLog(state, t(msg`本轮高收益，送一张摊位许可。`), "success", nowMs);
  }
  pushLog(
    state,
    t(
      msg`今夜营业结束：${state.totalCustomersThisRound} 位顾客 / +${state.totalIncomeThisRound} 夜市券。`,
    ),
    "success",
    nowMs,
  );
}

function bumpWeekly(
  state: NightMarketState,
  kind: StallKind,
  customers: number,
  nowMs: number,
) {
  for (const order of state.weeklyOrders) {
    if (order.completed) continue;
    const matchKind: WeeklyOrderKind = order.kind;
    if (matchKind !== "any" && matchKind !== kind) continue;
    order.doneCount += customers;
    if (order.doneCount >= order.targetCount) {
      order.doneCount = order.targetCount;
      order.completed = true;
      state.coupon += order.rewardCoupon;
      state.permitTickets += order.rewardPermit;
      pushLog(
        state,
        t(
          msg`周任务完成：${order.label}（+${order.rewardCoupon} 券 / +${order.rewardPermit} 许可）。`,
        ),
        "success",
        nowMs,
      );
    }
  }
}

export function collectStall(
  state: NightMarketState,
  kind: StallKind,
  nowMs: number,
): NightMarketState {
  if (state.status !== "running") return state;
  const stall = state.stalls.find((s) => s.kind === kind);
  if (!stall || stall.pendingCustomers === 0) return state;
  const customers = stall.pendingCustomers;
  const income = stall.pendingIncome;
  state.coupon += income;
  state.totalCustomersThisRound += customers;
  state.totalIncomeThisRound += income;
  stall.totalCustomersThisRound += customers;
  stall.totalIncomeThisRound += income;
  stall.pendingCustomers = 0;
  stall.pendingIncome = 0;
  // 同时把这些顾客对应的 wave 标为已收
  for (const wave of state.waves) {
    if (wave.kind === kind && !wave.collected) wave.collected = true;
  }
  bumpWeekly(state, kind, customers, nowMs);
  pushLog(
    state,
    t(msg`${getStallSpec(kind).name} 收银：${customers} 位顾客 / +${income} 券。`),
    "success",
    nowMs,
  );
  return state;
}

export function collectAll(
  state: NightMarketState,
  nowMs: number,
): NightMarketState {
  if (state.status !== "running") return state;
  for (const stall of state.stalls) {
    if (stall.pendingCustomers > 0) collectStall(state, stall.kind, nowMs);
  }
  return state;
}

export function upgradeStall(
  state: NightMarketState,
  kind: StallKind,
  nowMs: number,
): NightMarketState {
  const stall = state.stalls.find((s) => s.kind === kind);
  if (!stall) return state;
  if (stall.level >= MAX_LEVEL) return state;
  const cost = upgradeCost(getStallSpec(kind), stall.level);
  if (state.coupon < cost) {
    pushLog(state, t(msg`夜市券不够，攒一会儿再升级。`), "warn", nowMs);
    return state;
  }
  state.coupon -= cost;
  stall.level += 1;
  pushLog(
    state,
    t(msg`${getStallSpec(kind).name} 升到 ${stall.level} 级（-${cost} 券）。`),
    "success",
    nowMs,
  );
  return state;
}

export function visitFriendStall(
  state: NightMarketState,
  nowMs: number,
): NightMarketState {
  // 互访：直接给最近一个未完成周任务推进 1/3 进度
  const target = state.weeklyOrders.find((o) => !o.completed);
  if (!target) {
    pushLog(state, t(msg`本周任务都做完了。`), "info", nowMs);
    return state;
  }
  const bump = Math.max(1, Math.round(target.targetCount * 0.34));
  target.doneCount = Math.min(target.targetCount, target.doneCount + bump);
  if (target.doneCount >= target.targetCount && !target.completed) {
    target.completed = true;
    state.coupon += target.rewardCoupon;
    state.permitTickets += target.rewardPermit;
  }
  pushLog(
    state,
    t(msg`互访好友夜市，"${target.label}" 推进 +${bump}。`),
    "success",
    nowMs,
  );
  return state;
}

export function endRoundEarly(
  state: NightMarketState,
  nowMs: number,
): NightMarketState {
  if (state.status !== "running") return state;
  finishRound(state, nowMs);
  return state;
}

export function backToIdle(state: NightMarketState): NightMarketState {
  state.status = "idle";
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.remainingMs = ROUND_DURATION_MS;
  state.waves = [];
  return state;
}

export function consumePermit(
  state: NightMarketState,
  nowMs: number,
): NightMarketState {
  if (state.permitTickets <= 0) return state;
  // 用一张许可：把任意一个未升满的摊位免费 +1 级
  const candidate = state.stalls.find((s) => s.level < MAX_LEVEL);
  if (!candidate) {
    pushLog(state, t(msg`所有摊位已满级，许可留着下次。`), "info", nowMs);
    return state;
  }
  state.permitTickets -= 1;
  candidate.level += 1;
  pushLog(
    state,
    t(
      msg`使用许可，${getStallSpec(candidate.kind).name} 升到 ${candidate.level} 级。`,
    ),
    "success",
    nowMs,
  );
  return state;
}
