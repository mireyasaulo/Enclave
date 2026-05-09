// NPC 社交互动门控参数与乘子（朋友圈 / 广场 / 视频号 共用）
//
// 三档抑制：
//   - 帖子年龄：≥7d 直接置 0（硬截断），从 0d→7d 线性衰减；
//   - 关系冷却：两个角色 ≥7d 没互动则置 0，5d→7d 线性衰减，<5d 不影响；
//   - 亲密度：0 → 0.2x、50 → 1.0x、100 → 1.4x（强惩罚低亲密度档）。
//
// 用户帖（authorType !== 'character'）没有 character-to-character intimacy，
// 视作中性 25 → 乘子 ≈ 0.6（中等抑制），保留少量互动但显著低于熟人。

const NPC_POST_HARD_SKIP_MS = 7 * 24 * 60 * 60 * 1000;
const NPC_POST_DECAY_FULL_MS = 7 * 24 * 60 * 60 * 1000;
const NPC_COOLING_START_MS = 5 * 24 * 60 * 60 * 1000;
const NPC_COOLING_FULL_MS = 7 * 24 * 60 * 60 * 1000;

export const NPC_USER_POST_NEUTRAL_INTIMACY = 25;

export function npcPostRecencyMultiplier(nowMs: number, postMs: number): number {
  const age = nowMs - postMs;
  if (age >= NPC_POST_HARD_SKIP_MS) return 0;
  return Math.max(0, 1 - age / NPC_POST_DECAY_FULL_MS);
}

export function npcRelationCoolingFactor(
  nowMs: number,
  lastInteractedAt: Date | null | undefined,
): number {
  if (!lastInteractedAt) return 1;
  const dt = nowMs - lastInteractedAt.getTime();
  if (dt >= NPC_COOLING_FULL_MS) return 0;
  if (dt <= NPC_COOLING_START_MS) return 1;
  return (
    1 -
    (dt - NPC_COOLING_START_MS) /
      (NPC_COOLING_FULL_MS - NPC_COOLING_START_MS)
  );
}

export function npcIntimacyMultiplier(effectiveIntimacy: number): number {
  return Math.max(0.2, Math.min(1.4, 0.2 + 0.8 * (effectiveIntimacy / 50)));
}
