// i18n-ignore-start: server-side proxy plumbing, not user-facing UI.
import * as http from "node:http";
import * as net from "node:net";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE } from "../auth/cloud-jwt.constants";
import {
  resolveCloudClientJwtAudience,
  resolveCloudJwtIssuer,
} from "../config/cloud-runtime-config";
import { WorldApiProxyService } from "./world-api-proxy.service";

const PROXY_PATH_PREFIX = "/cloud/world-api";
const logger = new Logger("WorldApiWsProxy");

type CloudClientJwtPayload = {
  phone?: string;
  purpose?: string;
  sub?: string;
};

function writeHandshakeError(socket: net.Socket, status: number, reason: string) {
  try {
    socket.write(
      `HTTP/1.1 ${status} ${reason}\r\n` +
        `Connection: close\r\n` +
        `Content-Length: 0\r\n\r\n`,
    );
  } catch {
    // already closed; nothing to do
  } finally {
    socket.destroy();
  }
}

function extractToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const queryToken = url.searchParams.get("token") || url.searchParams.get("auth_token");
    return queryToken?.trim() || null;
  } catch {
    return null;
  }
}

function buildUpstreamRequestHead(
  req: http.IncomingMessage,
  subPath: string,
  upstreamHostHeader: string,
) {
  const requestLine = `${req.method ?? "GET"} ${subPath} HTTP/${req.httpVersion ?? "1.1"}`;
  const headerLines: string[] = [requestLine];
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (lower === "host") continue;
    if (lower === "authorization") continue;
    if (Array.isArray(value)) {
      for (const item of value) headerLines.push(`${key}: ${item}`);
    } else {
      headerLines.push(`${key}: ${value}`);
    }
  }
  headerLines.push(`host: ${upstreamHostHeader}`);
  return `${headerLines.join("\r\n")}\r\n\r\n`;
}

export function setupWorldApiWsProxy(
  httpServer: http.Server,
  jwtService: JwtService,
  configService: ConfigService,
  proxyService: WorldApiProxyService,
) {
  const issuer = resolveCloudJwtIssuer(configService);
  const audience = resolveCloudClientJwtAudience(configService);

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith(`${PROXY_PATH_PREFIX}/`)) {
      // 只接管 /cloud/world-api/* 路径下的升级请求；其他 ws handler 自行处理。
      return;
    }

    void (async () => {
      const clientSocket = socket as net.Socket;
      const token = extractToken(req);
      if (!token) {
        return writeHandshakeError(clientSocket, 401, "Unauthorized");
      }

      let phone: string;
      try {
        const payload = await jwtService.verifyAsync<CloudClientJwtPayload>(token, {
          issuer,
          audience,
        });
        if (
          !payload.phone ||
          payload.purpose !== CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE ||
          payload.sub !== payload.phone
        ) {
          return writeHandshakeError(clientSocket, 401, "Unauthorized");
        }
        phone = payload.phone;
      } catch {
        return writeHandshakeError(clientSocket, 401, "Unauthorized");
      }

      const target = await proxyService.resolveTarget(phone);
      if (!target) {
        return writeHandshakeError(clientSocket, 503, "Service Unavailable");
      }

      const subPath = req.url!.slice(PROXY_PATH_PREFIX.length) || "/";
      const upstream = net.createConnection(
        { host: target.host, port: target.port },
        () => {
          try {
            upstream.write(
              buildUpstreamRequestHead(req, subPath, `${target.host}:${target.port}`),
            );
            if (head && head.length > 0) {
              upstream.write(head);
            }
            // 双向裸 socket pipe；socket.io 的 ws 帧由 child 端 socket.io server
            // 解析，cloud-api 这层完全透明。
            clientSocket.pipe(upstream);
            upstream.pipe(clientSocket);
          } catch (err) {
            logger.warn(
              `failed to wire ws tunnel world=${target.worldId}: ${err instanceof Error ? err.message : String(err)}`,
            );
            clientSocket.destroy();
            upstream.destroy();
          }
        },
      );

      const cleanup = () => {
        clientSocket.destroy();
        upstream.destroy();
      };
      upstream.on("error", (err) => {
        logger.warn(
          `ws upstream error world=${target.worldId} ${err instanceof Error ? err.message : String(err)}`,
        );
        cleanup();
      });
      clientSocket.on("error", () => {
        upstream.destroy();
      });
      clientSocket.on("close", () => upstream.destroy());
      upstream.on("close", () => clientSocket.destroy());
    })().catch((err) => {
      logger.error(
        `unexpected ws upgrade handler error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
      );
      try {
        (socket as net.Socket).destroy();
      } catch {
        // ignore
      }
    });
  });

  logger.log(`world-api ws proxy attached at ${PROXY_PATH_PREFIX}/*`);
}
// i18n-ignore-end
