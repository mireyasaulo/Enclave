export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

export function getSparkTier(days: number): number {
  if (!days || days < 3) return 0;
  if (days < 7) return 1;
  if (days < 30) return 2;
  if (days < 100) return 3;
  if (days < 365) return 4;
  return 5;
}
