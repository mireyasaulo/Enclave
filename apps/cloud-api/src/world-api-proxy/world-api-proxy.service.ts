import * as http from "node:http";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CloudInstanceEntity } from "../entities/cloud-instance.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";

export type WorldApiTarget = {
  host: string;
  port: number;
  worldId: string;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

@Injectable()
export class WorldApiProxyService {
  private readonly logger = new Logger(WorldApiProxyService.name);

  constructor(
    @InjectRepository(CloudWorldEntity)
    private readonly worldRepo: Repository<CloudWorldEntity>,
    @InjectRepository(CloudInstanceEntity)
    private readonly instanceRepo: Repository<CloudInstanceEntity>,
  ) {}

  async resolveTarget(phone: string): Promise<WorldApiTarget | null> {
    if (!phone) {
      return null;
    }

    const world = await this.worldRepo.findOne({ where: { phone } });
    if (!world) {
      return null;
    }

    if (world.status !== "ready" && world.status !== "active") {
      return null;
    }

    const instance = await this.instanceRepo.findOne({
      where: { worldId: world.id },
    });
    if (!instance || instance.powerState !== "running") {
      return null;
    }

    const launchConfig =
      typeof instance.launchConfig === "object" && instance.launchConfig
        ? (instance.launchConfig as Record<string, unknown>)
        : null;
    const portRaw = launchConfig?.port;
    const port = typeof portRaw === "string" ? Number(portRaw) : Number(portRaw ?? 0);
    if (!Number.isFinite(port) || port <= 0) {
      return null;
    }

    return { host: "127.0.0.1", port, worldId: world.id };
  }

  proxyHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: WorldApiTarget,
    subPath: string,
  ) {
    const filteredHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const lower = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lower)) continue;
      // 不把 cloud access token 透给 child world-api，避免它在日志里看到。
      if (lower === "authorization") continue;
      if (lower === "host") continue;
      filteredHeaders[key] = value;
    }
    filteredHeaders["host"] = `${target.host}:${target.port}`;

    const upstream = http.request(
      {
        host: target.host,
        port: target.port,
        method: req.method,
        path: subPath,
        headers: filteredHeaders,
      },
      (upstreamRes) => {
        res.statusCode = upstreamRes.statusCode ?? 502;
        for (const [key, value] of Object.entries(upstreamRes.headers)) {
          if (value === undefined) continue;
          const lower = key.toLowerCase();
          if (HOP_BY_HOP_HEADERS.has(lower)) continue;
          res.setHeader(key, value);
        }
        upstreamRes.pipe(res);
      },
    );

    upstream.on("error", (error) => {
      this.logger.warn(
        `world-api proxy upstream error world=${target.worldId} ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            statusCode: 502,
            errorCode: "WORLD_UPSTREAM_UNAVAILABLE",
            message: "World instance upstream is currently unavailable.",
          }),
        );
      } else {
        res.destroy();
      }
    });

    req.on("aborted", () => {
      upstream.destroy();
    });
    req.pipe(upstream);
  }
}
