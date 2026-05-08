import { io, type Socket } from "socket.io-client";
import {
  CHAT_EVENTS,
  CHAT_NAMESPACE,
  type ChatErrorPayload,
  type ConversationUpdatedPayload,
  type JoinConversationPayload,
  type RealtimeChatMessage,
  type SendMessagePayload,
  type TypingPayload,
} from "@yinjie/contracts";
import { resolveAppSocketBaseUrl } from "./runtime-config";
import { APP_RUNTIME_SOCKET_CONFIG_CHANGE_EVENT } from "../runtime/runtime-config-events";
import { isCloudSessionExpired, useCloudSessionStore } from "../store/cloud-session-store";

let socket: Socket | null = null;
let activeSocketBaseUrl: string | null = null;
let runtimeConfigListenerAttached = false;

function socketBaseUrl() {
  return resolveAppSocketBaseUrl();
}

// baseUrl 形如 http://host/cloud/world-api 时（多租户公网反代），engine 路径
// 必须在前缀下接 /socket.io 才能被 nginx + cloud-api ws upgrade 识别；本地直连
// (无路径) 保持默认 /socket.io。
function buildSocketConnectArgs(baseUrl: string) {
  let origin = baseUrl;
  let pathname = "";
  try {
    const url = new URL(baseUrl);
    origin = url.origin;
    pathname = url.pathname.replace(/\/+$/, "");
  } catch {
    // baseUrl 不合法时退化为整段当 origin
  }
  const enginePath = pathname ? `${pathname}/socket.io` : "/socket.io";
  return { namespaceUrl: `${origin}${CHAT_NAMESPACE}`, enginePath };
}

// 多租户场景把 cloud token 通过 query 透给反代层，让 ws 'upgrade' handler
// 在尚未握手时就拿到 phone 路由到对应 child；本地直连不需要带 token。
function resolveSocketAuthToken(baseUrl: string): string | null {
  if (!baseUrl.includes("/cloud/world-api")) {
    return null;
  }
  const session = useCloudSessionStore.getState();
  if (!session.accessToken || isCloudSessionExpired(session.expiresAt)) {
    return null;
  }
  return session.accessToken;
}

function ensureRuntimeConfigListener() {
  if (runtimeConfigListenerAttached || typeof window === "undefined") {
    return;
  }

  window.addEventListener(
    APP_RUNTIME_SOCKET_CONFIG_CHANGE_EVENT,
    disconnectChatSocket,
  );
  runtimeConfigListenerAttached = true;
}

export function getChatSocket() {
  const nextSocketBaseUrl = socketBaseUrl();
  ensureRuntimeConfigListener();

  if (socket && activeSocketBaseUrl === nextSocketBaseUrl) {
    return socket;
  }

  disconnectChatSocket();
  activeSocketBaseUrl = nextSocketBaseUrl;
  const { namespaceUrl, enginePath } = buildSocketConnectArgs(nextSocketBaseUrl);
  const token = resolveSocketAuthToken(nextSocketBaseUrl);
  socket = io(namespaceUrl, {
    path: enginePath,
    transports: ["websocket", "polling"],
    ...(token ? { auth: { token }, query: { token } } : {}),
  });

  return socket;
}

export function disconnectChatSocket() {
  if (!socket) {
    activeSocketBaseUrl = null;
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeSocketBaseUrl = null;
}

export function joinConversationRoom(payload: JoinConversationPayload) {
  getChatSocket().emit(CHAT_EVENTS.joinConversation, payload);
}

export function emitChatMessage(payload: SendMessagePayload) {
  getChatSocket().emit(CHAT_EVENTS.sendMessage, payload);
}

export function onChatMessage(handler: (payload: RealtimeChatMessage) => void) {
  const active = getChatSocket();
  active.on(CHAT_EVENTS.newMessage, handler);
  return () => active.off(CHAT_EVENTS.newMessage, handler);
}

export function onTypingStart(handler: (payload: TypingPayload) => void) {
  const active = getChatSocket();
  active.on(CHAT_EVENTS.typingStart, handler);
  return () => active.off(CHAT_EVENTS.typingStart, handler);
}

export function onTypingStop(handler: (payload: TypingPayload) => void) {
  const active = getChatSocket();
  active.on(CHAT_EVENTS.typingStop, handler);
  return () => active.off(CHAT_EVENTS.typingStop, handler);
}

export function onConversationUpdated(handler: (payload: ConversationUpdatedPayload) => void) {
  const active = getChatSocket();
  active.on(CHAT_EVENTS.conversationUpdated, handler);
  return () => active.off(CHAT_EVENTS.conversationUpdated, handler);
}

export function onChatError(handler: (payload: ChatErrorPayload) => void) {
  const active = getChatSocket();
  const listener = (payload: ChatErrorPayload | string) => {
    if (typeof payload === "string") {
      handler({ message: payload });
      return;
    }

    handler(payload);
  };

  active.on(CHAT_EVENTS.error, listener);
  return () => active.off(CHAT_EVENTS.error, listener);
}
