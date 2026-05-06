const INVITE_CODE_STORAGE_KEY = "yinjie-app-invite-code";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredInviteCode() {
  return getStorage()?.getItem(INVITE_CODE_STORAGE_KEY)?.trim().toUpperCase() || "";
}

export function persistInviteCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const storage = getStorage();
  if (!storage) {
    return normalizedCode;
  }

  if (normalizedCode) {
    storage.setItem(INVITE_CODE_STORAGE_KEY, normalizedCode);
  } else {
    storage.removeItem(INVITE_CODE_STORAGE_KEY);
  }

  return normalizedCode;
}
