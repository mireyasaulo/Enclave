function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `s-${Date.now().toString(36)}-${rand}`;
}

export function newSessionId(): string {
  return generateUuid();
}
