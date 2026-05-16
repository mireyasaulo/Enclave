// i18n-ignore-start: internal config — not user-facing UI.

// MiniMax token plan key 池：按 worldId 稳定 hash 分配。
// 同一 world 永远命中同一 key（重启 cloud-api 不变），加 key 时只有少数 world 的 mod 余数变化。
// 池为空时返回 null，spawn 端不注入，child 自己读 api/.env 的单 key 兜底。

// 2026-05-16 第二次 rebalance：第一把 key (idx=0) 周限额也快满了，
// 现在只留 yuanzui0728 自己（开发/测试账号）继续走 idx=0，其他所有 world 全部强制 idx=1。
// 池 size < 2 时所有 world 自动 fallback 回 idx=0（单 key 兜底）。
// key 是 CloudWorldEntity.id（UUID），不是 phone；spawnChild 里调
// pickMinimaxKey(world.id, ...) 传的是 UUID。
const PRIMARY_KEY_WORLDS = new Set<string>([
  "bc77b484-1064-4b13-9eb4-7edd9ddc87ac", // phone 91173587559732 / yuanzui0728
]);

export type MinimaxKeyAllocation = {
  key: string;
  index: number; // 1-based，便于日志
  total: number;
  fingerprint: string; // 末 4 位
};

export function parseMinimaxKeyPool(
  rawKeys: string | undefined,
  rawSingleKey: string | undefined,
): string[] {
  const fromCsv = (rawKeys ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (fromCsv.length > 0) return fromCsv;
  const single = (rawSingleKey ?? "").trim();
  return single ? [single] : [];
}

export function pickMinimaxKey(
  worldId: string,
  pool: string[],
): MinimaxKeyAllocation | null {
  if (pool.length === 0) return null;
  let idx: number;
  if (PRIMARY_KEY_WORLDS.has(worldId)) {
    idx = 0;
  } else if (pool.length >= 2) {
    idx = 1;
  } else {
    idx = 0;
  }
  // 池太小放不下目标 idx 时回落到末位，避免越界。
  if (idx >= pool.length) idx = pool.length - 1;
  const key = pool[idx];
  return { key, index: idx + 1, total: pool.length, fingerprint: key.slice(-4) };
}
// i18n-ignore-end
