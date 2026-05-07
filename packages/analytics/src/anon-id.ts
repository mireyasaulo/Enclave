const ANON_KEY = "yinjie_anon_id";

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `anon-${Date.now().toString(36)}-${rand}`;
}

export function ensureAnonId(): string {
  if (typeof localStorage === "undefined") return generateUuid();
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing && existing.length > 0) return existing;
    const fresh = generateUuid();
    localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    return generateUuid();
  }
}
