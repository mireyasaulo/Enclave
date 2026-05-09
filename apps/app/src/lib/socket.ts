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

  // 服务端版本变更自动升级：每次 API 进程启动都换一个 buildId，握手时下发。
  // 客户端比较 localStorage 上次记的 buildId，不同就清 PWA SW + 缓存 + reload。
  // 让用户完全无感知地拿到新代码 + 新数据，无需手动 unregister。
  socket.on("system.hello", (payload: { buildId?: string }) => {
    if (typeof window === "undefined") return;
    const nextId = payload?.buildId;
    if (!nextId) return;
    const STORAGE_KEY = "yinjie:server-build-id";
    let prevId: string | null = null;
    try {
      prevId = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      prevId = null;
    }
    if (prevId && prevId !== nextId) {
      // 服务器换版本了 → 清 SW + 缓存 + 硬刷
      void (async () => {
        try {
          if (
            typeof navigator !== "undefined" &&
            navigator.serviceWorker?.getRegistrations
          ) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if (typeof caches !== "undefined") {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          // 清理失败不阻塞 reload，浏览器自身缓存策略也能拿到大部分新内容
        }
        try {
          window.localStorage.setItem(STORAGE_KEY, nextId);
        } catch {
          // ignore
        }
        window.location.reload();
      })();
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, nextId);
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
