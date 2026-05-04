const DEVICE_FINGERPRINT_STORAGE_KEY = "yinjie-device-fingerprint";

let cachedFingerprint: string | null = null;

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

function buildRuntimeSeed() {
  if (typeof navigator === "undefined") {
    return "runtime";
  }

  return [navigator.userAgent, navigator.language, navigator.platform]
    .filter(Boolean)
    .join("|");
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function randomToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceFingerprint() {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  const storage = getStorage();
  const persistedValue = storage?.getItem(DEVICE_FINGERPRINT_STORAGE_KEY)?.trim();
  if (persistedValue) {
    cachedFingerprint = persistedValue;
    return persistedValue;
  }

  const nextFingerprint = `${randomToken()}-${hashText(buildRuntimeSeed())}`;
  storage?.setItem(DEVICE_FINGERPRINT_STORAGE_KEY, nextFingerprint);
  cachedFingerprint = nextFingerprint;
  return nextFingerprint;
}
