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
    // polling 在前 + websocket 升级：花生壳 / 部分公网隧道不转发 WS upgrade(101)，
    // 直接 transports:["websocket","polling"] 会让 socket.io-client 先尝试 ws，
    // upgrade 失败后陷入死循环不发任何 emit。改成 polling-first 让初始握手用
    // long-polling 拿到 sid，能升级就升级，不能升级也保持工作。
    transports: ["polling", "websocket"],
    ...(token ? { auth: { token }, query: { token } } : {}),
  });

  // 服务端 buildId 仅记录在 localStorage 中供调试；自动 reload 已下线，
  // dev 环境 nest watch 频繁热重启会让客户端死循环 reload，
  // 现在改为用户手动刷新。
  socket.on("system.hello", (payload: { buildId?: string }) => {
    if (typeof window === "undefined") return;
    const nextId = payload?.buildId;
    if (!nextId) return;
    try {
      window.localStorage.setItem("yinjie:server-build-id", nextId);
    } catch {
      // ignore
    }
  });

  // socket.io-client 重连用初始 query；cloud token 续期或重登后 query 会过期
  // → upgrade 401 死循环。每次重连前重抓最新 token 写回 query/auth，让反代层
  // 重新校验通过。
  if (token) {
    const baseUrlForReconnect = nextSocketBaseUrl;
    socket.io.on("reconnect_attempt", () => {
      const latest = resolveSocketAuthToken(baseUrlForReconnect);
      if (!latest) return;
      const opts = socket?.io.opts as { query?: Record<string, string>; auth?: Record<string, unknown> } | undefined;
      if (opts) {
        opts.query = { ...(opts.query ?? {}), token: latest };
        opts.auth = { ...(opts.auth ?? {}), token: latest };
      }
    });
  }

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

// socket.io-client 重连时 server 不知道该 socket 之前 join 了哪些 room
// （server 端 Socket 实例每次都是新的）；调用方需要在 connect 事件里重新
// emit join_conversation 才能继续收到 newMessage / typing / conversation_updated。
// fire 时机：socket 从断开变成连上时（包括 reconnect）；如果 socket 已经
// 连上时挂 listener，本次不会触发，下次重连才触发——这正是我们想要的。
export function onChatSocketConnect(handler: () => void) {
  const active = getChatSocket();
  active.on('connect', handler);
  return () => active.off('connect', handler);
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
