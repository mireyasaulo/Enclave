import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { parseDirectCallInviteMessage } from "./group-call-message";
import type { ResultCardFooterCopy } from "./result-card-footer";

const t = translateRuntimeMessage;

type DirectCallInvite = NonNullable<
  ReturnType<typeof parseDirectCallInviteMessage>
>;

export function resolveDirectCallStatusLabel(invite: DirectCallInvite) {
  if (invite.connectionStatus === "ended") {
    return t(msg`已结束`);
  }

  if (invite.connectionStatus === "connected") {
    return invite.kind === "video"
      ? t(msg`画面已接通`)
      : t(msg`已接通`);
  }

  return invite.kind === "video"
    ? t(msg`等待接入画面`)
    : t(msg`等待接听`);
}

export function resolveDirectCallFooterCopy(
  invite: DirectCallInvite,
  canReopenCall: boolean,
): ResultCardFooterCopy {
  if (invite.connectionStatus === "ended") {
    return canReopenCall
      ? {
          description:
            invite.kind === "video"
              ? t(msg`点击可重新发起当前单聊视频通话。`)
              : t(msg`点击可重新发起当前单聊语音通话。`),
          actionLabel: t(msg`重新发起`),
          tone: "info" as const,
          ariaLabel: t(msg`重新发起 ${invite.title} 的单聊通话`),
        }
      : {
          description:
            invite.kind === "video"
              ? t(msg`这轮单聊视频通话已经结束，当前保留为状态记录卡片。`)
              : t(msg`这轮单聊语音通话已经结束，当前保留为状态记录卡片。`),
          actionLabel: t(msg`查看记录`),
          tone: "muted" as const,
          ariaLabel: t(msg`查看 ${invite.title} 的单聊通话记录`),
        };
  }

  return canReopenCall
    ? {
        description:
          invite.kind === "video"
            ? t(msg`点击可回到当前单聊视频通话工作台。`)
            : t(msg`点击可回到当前单聊语音通话工作台。`),
        actionLabel:
          invite.kind === "voice" ? t(msg`回到语音`) : t(msg`回到视频`),
        tone: "info" as const,
        ariaLabel: t(msg`回到 ${invite.title} 的单聊通话工作台`),
      }
    : {
        description:
          invite.kind === "video"
            ? t(msg`当前消息已转成单聊视频通话卡片，方便快速识别状态。`)
            : t(msg`当前消息已转成单聊语音通话卡片，方便快速识别状态。`),
        actionLabel:
          invite.kind === "voice" ? t(msg`语音中`) : t(msg`视频中`),
        tone: "info" as const,
        ariaLabel: t(msg`查看 ${invite.title} 的单聊通话状态`),
      };
}
