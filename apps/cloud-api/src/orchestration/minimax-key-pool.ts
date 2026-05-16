// i18n-ignore-start: internal config — not user-facing UI.
import { createHash } from "node:crypto";

// MiniMax token plan key 池：按 worldId 稳定 hash 分配。
// 同一 world 永远命中同一 key（重启 cloud-api 不变），加 key 时只有少数 world 的 mod 余数变化。
// 池为空时返回 null，spawn 端不注入，child 自己读 api/.env 的单 key 兜底。

// 2026-05-16 手动 rebalance：第一把 key (idx=0) 额度紧张，
// 把 8 个 DB 体量最大的 world 强制改到第二把 key (idx=1) 上分担。
// 当池 size 不足以容纳目标 idx 时自动 fallback 回 hash mod。
const MANUAL_KEY_OVERRIDES: Record<string, number> = {
  "91690266005048": 1,
  "91767509138145": 1,
  "91720686495493": 1,
  "91509897209009": 1,
  "91684591468990": 1,
  "92488614062767": 1,
  "91568403847878": 1,
  "91618162342073": 1,
};

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
  const override = MANUAL_KEY_OVERRIDES[worldId];
  let idx: number;
  if (typeof override === "number" && override >= 0 && override < pool.length) {
    idx = override;
  } else {
    const digest = createHash("sha1").update(worldId).digest();
    const h = digest.readUInt32BE(0);
    idx = h % pool.length;
  }
  const key = pool[idx];
  return { key, index: idx + 1, total: pool.length, fingerprint: key.slice(-4) };
}
// i18n-ignore-end
