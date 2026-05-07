import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

export function promptForSafetyReason(actionLabel: string) {
  const value = window.prompt(
    `${actionLabel}\n${t(msg`请输入原因，便于后续追踪处理：`)}`,
    t(msg`骚扰或不适内容`),
  );
  const normalized = value?.trim();
  return normalized || null;
}
