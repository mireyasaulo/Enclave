import { useCallback, useEffect, useState } from "react";

export type AdminDensity = "compact" | "standard" | "spacious";

const STORAGE_KEY = "adminDensity";
const DEFAULT_DENSITY: AdminDensity = "standard";

function readStoredDensity(): AdminDensity {
  if (typeof window === "undefined") return DEFAULT_DENSITY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "compact" || raw === "standard" || raw === "spacious") {
      return raw;
    }
  } catch {
    /* ignore storage errors (private mode) */
  }
  return DEFAULT_DENSITY;
}

function applyDensity(density: AdminDensity) {
  if (typeof document === "undefined") return;
  if (density === "standard") {
    document.documentElement.removeAttribute("data-density");
  } else {
    document.documentElement.setAttribute("data-density", density);
  }
}

export function initAdminDensity() {
  applyDensity(readStoredDensity());
}

export function useAdminDensity() {
  const [density, setDensityState] = useState<AdminDensity>(readStoredDensity);

  useEffect(() => {
    applyDensity(density);
    try {
      window.localStorage.setItem(STORAGE_KEY, density);
    } catch {
      /* ignore */
    }
  }, [density]);

  const setDensity = useCallback((next: AdminDensity) => {
    setDensityState(next);
  }, []);

  return { density, setDensity };
}
