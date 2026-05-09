// i18n-ignore-start: provider adapter — internal constants only.

export const TOKEN_PLAN_DAILY_LIMITS: Record<string, number> = {
  'MiniMax-Hailuo-02-Fast': 2,
  'MiniMax-Hailuo-02': 2,
  'music-2.6': 100,
  'music-2.5': 4,
  'image-01': 120,
  'lyrics': 100,
};

export function getDailyLimit(model: string): number {
  return TOKEN_PLAN_DAILY_LIMITS[model] ?? 0;
}

// i18n-ignore-end
