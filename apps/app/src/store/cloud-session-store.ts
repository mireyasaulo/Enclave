import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CloudProfileResponse } from "@yinjie/contracts";
import { createSessionStateStorage } from "../runtime/session-storage";

export type CloudSessionSnapshot = {
  accessToken: string | null;
  expiresAt: string | null;
  phone: string | null;
  profile: CloudProfileResponse | null;
};

type CloudSessionState = CloudSessionSnapshot & {
  hydrated: boolean;
  setSession: (input: CloudSessionSnapshot) => void;
  setProfile: (profile: CloudProfileResponse | null) => void;
  clearSession: () => void;
  markHydrated: () => void;
};

const emptySnapshot: CloudSessionSnapshot = {
  accessToken: null,
  expiresAt: null,
  phone: null,
  profile: null,
};

export function isCloudSessionExpired(expiresAt?: string | null) {
  if (!expiresAt) {
    return true;
  }

  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

export const useCloudSessionStore = create<CloudSessionState>()(
  persist(
    (set) => ({
      ...emptySnapshot,
      hydrated: false,
      setSession: (input) =>
        set({
          accessToken: input.accessToken?.trim() || null,
          expiresAt: input.expiresAt?.trim() || null,
          phone: input.phone?.trim() || null,
          profile: input.profile ?? null,
        }),
      setProfile: (profile) => set({ profile }),
      clearSession: () =>
        set({
          ...emptySnapshot,
        }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "yinjie-app-cloud-session", // i18n-ignore-line
      storage: createSessionStateStorage(),
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
        phone: state.phone,
        profile: state.profile,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

export async function hydrateCloudSessionStore() {
  await useCloudSessionStore.persist.rehydrate();
  if (!useCloudSessionStore.getState().hydrated) {
    useCloudSessionStore.getState().markHydrated();
  }
  return useCloudSessionStore.getState();
}
