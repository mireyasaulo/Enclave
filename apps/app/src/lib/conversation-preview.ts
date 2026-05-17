import type { ConversationListItem } from "@yinjie/contracts";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { LocalChatMessageActionState } from "../features/chat/local-chat-message-actions";
import { shouldHideSearchableChatMessage } from "../features/chat/local-chat-message-actions";
import { isServerRecalledSystemMessage } from "./chat-text";
import {
  getConversationThreadLabel,
  isPersistedGroupConversation,
} from "./conversation-route";
import { resolveMessageSemanticPreview } from "./message-attachment-semantic";

type ConversationPreviewOptions = {
  emptyText?: string;
};

// 2026-05-17 R1：服务端 normalizeLegacyConversationEntity 在 direct 会话
// title 全部 fallback 都失败时，写入字面量 '未知联系人' / 'Direct conversation'
// 并持久化到 ConversationEntity.title。客户端切到 en/ja/ko 时，这些字面量
// 不会被任何 i18n catalog 命中，UI 上仍然渲染原始中文，违反"语言偏好立即生效"
// 的契约。服务端不知道当前用户的 locale，只能写一个稳定占位；这里在客户端
// 渲染时统一把这两个 sentinel 翻译成当前 locale。
const LEGACY_UNKNOWN_CONTACT_TITLE = "未知联系人";
const LEGACY_DIRECT_CONVERSATION_TITLE = "Direct conversation";

export function getConversationDisplayTitle(title: string): string {
  if (title === LEGACY_UNKNOWN_CONTACT_TITLE) {
    return translateRuntimeMessage(msg`未知联系人`);
  }
  if (title === LEGACY_DIRECT_CONVERSATION_TITLE) {
    return translateRuntimeMessage(msg`私聊会话`);
  }
  return title;
}

export function getConversationVisibleLastMessage(
  conversation: ConversationListItem,
  localMessageActionState: LocalChatMessageActionState,
) {
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) {
    return null;
  }

  return shouldHideSearchableChatMessage(
    lastMessage.id,
    localMessageActionState,
  )
    ? null
    : lastMessage;
}

export function getConversationPreviewParts(
  conversation: ConversationListItem,
  localMessageActionState: LocalChatMessageActionState,
  options?: ConversationPreviewOptions,
) {
  const lastMessage = getConversationVisibleLastMessage(
    conversation,
    localMessageActionState,
  );

  if (!lastMessage) {
    if (
      conversation.lastMessage &&
      localMessageActionState.recalledMessageIds.includes(
        conversation.lastMessage.id,
      )
    ) {
      return {
        prefix: "",
        text: getConversationRecalledPreviewText(
          conversation,
          conversation.lastMessage,
        ),
      };
    }

    return {
      prefix: "",
      text: conversation.lastMessage
        ? getConversationOpenFallback(conversation)
        : (options?.emptyText ?? getConversationOpenFallback(conversation)),
    };
  }

  // 服务端 recall（chat.service.ts:506 / group.service.ts:579）把消息整段
  // 重写成 senderType=system + 中文 marker text。conversation 列表第二行
  // 直接走 resolveMessageSemanticPreview 会把中文原样返回；en/ja/ko locale
  // 看到的就是中文。先拦下来走 i18n 撤回提示。owner-only recall guard 保证
  // 这里能命中 marker 的就是 user 自己撤回的，所以构造一个 user 视角的
  // lastMessage 喂进 getConversationRecalledPreviewText。
  if (isServerRecalledSystemMessage(lastMessage)) {
    return {
      prefix: "",
      text: getConversationRecalledPreviewText(conversation, {
        ...lastMessage,
        senderType: "user",
      }),
    };
  }

  const senderLabel =
    lastMessage.senderType === "user"
      ? translateRuntimeMessage(msg`我`)
      : lastMessage.senderName || translateRuntimeMessage(msg`群成员`);
  const prefix =
    isPersistedGroupConversation(conversation) &&
    lastMessage.senderType !== "system"
      ? translateRuntimeMessage(msg`${senderLabel}：`)
      : "";
  return {
    prefix,
    text:
      resolveMessageSemanticPreview(lastMessage, {
        maxChars: 80,
        bracketedFallback: true,
      }) || getConversationOpenFallback(conversation),
  };
}

export function getConversationOpenFallback(
  conversation: Pick<ConversationListItem, "id" | "type" | "source">,
) {
  return isPersistedGroupConversation(conversation)
    ? translateRuntimeMessage(msg`打开群聊查看最近消息。`)
    : translateRuntimeMessage(
        msg`打开这个${getConversationThreadLabel(conversation)}查看最近聊天记录。`,
      );
}

function getConversationRecalledPreviewText(
  conversation: ConversationListItem,
  lastMessage: NonNullable<ConversationListItem["lastMessage"]>,
) {
  if (lastMessage.senderType === "user") {
    return translateRuntimeMessage(msg`你撤回了一条消息`);
  }

  if (isPersistedGroupConversation(conversation)) {
    return translateRuntimeMessage(
      msg`${lastMessage.senderName || translateRuntimeMessage(msg`群成员`)}撤回了一条消息`,
    );
  }

  return translateRuntimeMessage(msg`对方撤回了一条消息`);
}
