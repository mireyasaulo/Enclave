import type { ParkingWarState } from "./parking-war-types";

const STORAGE_KEY = "yinjie.parking-war.v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadParkingWarState(): ParkingWarState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParkingWarState;
    if (!parsed || parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveParkingWarState(state: ParkingWarState) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / serialization errors
  }
}

export function resetParkingWarState() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
