// i18n-ignore-start: internal config — not user-facing UI.
import { createHash } from "node:crypto";

// MiniMax token plan key 池：按 worldId 稳定 hash 分配。
// 同一 world 永远命中同一 key（重启 cloud-api 不变），加 key 时只有少数 world 的 mod 余数变化。
// 池为空时返回 null，spawn 端不注入，child 自己读 api/.env 的单 key 兜底。

// 2026-05-16 手动 rebalance：第一把 key (idx=0) 额度紧张，
// 把 8 个 DB 体量最大的 world 强制改到第二把 key (idx=1) 上分担。
// key 是 CloudWorldEntity.id（UUID），不是 phone；spawnChild 里调
// pickMinimaxKey(world.id, ...) 传的是 UUID。注释里附 phone 便于排查。
// 当池 size 不足以容纳目标 idx 时自动 fallback 回 hash mod。
const MANUAL_KEY_OVERRIDES: Record<string, number> = {
  "efc038ae-c113-44c4-b063-03cec5d0e647": 1, // phone 91767509138145
  "032da13c-c45f-4b32-bfcf-017c543deed8": 1, // phone 91720686495493
  "f4e87b83-f598-442d-a98e-a3aa37840afa": 1, // phone 91509897209009
  "c4b82819-fa15-4401-8537-3abfb19c9e1d": 1, // phone 92488614062767
  "3923b1f3-6671-455c-b625-2e766fad1088": 1, // phone 99207503636222
  "7fa6d9ff-2b02-45db-8de1-4f0ccbe85b53": 1, // phone 91242138461111
  "8315e051-cd7c-4c42-a4f0-df39a1458d7d": 1, // phone 91044211191329
  "211c2798-c51f-4567-b092-6a8748713f56": 1, // phone 91525351614483
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
