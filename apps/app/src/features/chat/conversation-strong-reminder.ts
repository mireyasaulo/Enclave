import { msg } from "@lingui/macro";
import type { Message } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { parseTimestamp } from "../../lib/format";
import { resolveMessageSemanticPreview } from "../../lib/message-attachment-semantic";

const t = translateRuntimeMessage;

export const CONVERSATION_STRONG_REMINDER_DURATION_HOURS = 3;

export function isConversationStrongReminderActive(
  strongReminderUntil?: string | null,
  nowTimestamp = Date.now(),
) {
  const strongReminderTimestamp = parseTimestamp(strongReminderUntil);
  if (!strongReminderTimestamp) {
    return false;
  }

  return strongReminderTimestamp > nowTimestamp;
}

export function formatConversationStrongReminderRemaining(
  strongReminderUntil?: string | null,
  nowTimestamp = Date.now(),
) {
  const strongReminderTimestamp = parseTimestamp(strongReminderUntil);
  if (!strongReminderTimestamp || strongReminderTimestamp <= nowTimestamp) {
    return undefined;
  }

  const remainingMinutes = Math.max(
    1,
    Math.ceil((strongReminderTimestamp - nowTimestamp) / 60_000),
  );
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return t(msg`剩余 ${hours}小时${minutes}分`);
  }

  if (hours > 0) {
    return t(msg`剩余 ${hours}小时`);
  }

  return t(msg`剩余 ${remainingMinutes}分`);
}

export function describeStrongReminderMessage(message: Message) {
  return (
    resolveMessageSemanticPreview(message, {
      maxChars: 120,
      bracketedFallback: true,
    }) || t(msg`发来了一条新消息`)
  );
}
