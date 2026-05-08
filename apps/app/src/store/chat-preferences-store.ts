import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionStateStorage } from "../runtime/session-storage";

export type ChatSendShortcut = "enter" | "mod_enter";

type ChatPreferencesState = {
  sendMessageShortcut: ChatSendShortcut;
  setSendMessageShortcut: (shortcut: ChatSendShortcut) => void;
};

export function formatChatSendShortcutLabel(shortcut: ChatSendShortcut) {
  return shortcut === "enter" ? "Enter" : "Ctrl/Cmd + Enter";
}

export const useChatPreferencesStore = create<ChatPreferencesState>()(
  persist(
    (set) => ({
      sendMessageShortcut: "enter",
      setSendMessageShortcut: (shortcut) =>
        set({
          sendMessageShortcut: shortcut,
        }),
    }),
    {
      // i18n-ignore-next-line: zustand storage key, not user-visible
      name: "yinjie-app-chat-preferences",
      storage: createSessionStateStorage(),
    },
  ),
);
