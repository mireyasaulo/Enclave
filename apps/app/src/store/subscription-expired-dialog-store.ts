import { create } from "zustand";
import type { SubscriptionExpiredErrorBody } from "@yinjie/contracts";

export type SubscriptionExpiredDialogMeta =
  SubscriptionExpiredErrorBody["meta"];

type SubscriptionExpiredDialogState = {
  open: boolean;
  message: string;
  meta: SubscriptionExpiredDialogMeta | null;
  openDialog: (input: {
    message: string;
    meta?: SubscriptionExpiredDialogMeta | null;
  }) => void;
  closeDialog: () => void;
};

export const useSubscriptionExpiredDialogStore =
  create<SubscriptionExpiredDialogState>((set) => ({
    open: false,
    message: "",
    meta: null,
    openDialog: (input) =>
      set({
        open: true,
        message: input.message,
        meta: input.meta ?? null,
      }),
    closeDialog: () =>
      set({
        open: false,
        message: "",
        meta: null,
      }),
  }));
