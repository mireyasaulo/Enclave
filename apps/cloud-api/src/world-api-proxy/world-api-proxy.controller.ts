import { All, Controller, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { CloudClientAuthGuard } from "../auth/cloud-client-auth.guard";
import { WorldApiProxyService } from "./world-api-proxy.service";

const PROXY_PATH_PREFIX = "/cloud/world-api";

type CloudRequest = Request & { cloudPhone?: string };

@Controller("cloud/world-api")
@UseGuards(CloudClientAuthGuard)
export class WorldApiProxyController {
  constructor(private readonly proxyService: WorldApiProxyService) {}

  // 反代所有 /cloud/world-api/* 子路径，包括 /api/world/owner、/socket.io 升级前的握手等。
  // 实际 WS upgrade 由 main.ts 装的 'upgrade' listener 拦截，进不到这里。
  @All("*")
  async forward(@Req() req: CloudRequest, @Res() res: Response) {
    const phone = req.cloudPhone ?? "";
    const target = await this.proxyService.resolveTarget(phone);
    if (!target) {
      res.status(503).json({
        statusCode: 503,
        errorCode: "WORLD_INSTANCE_NOT_READY",
        message: "World instance is not ready for this account.",
      });
      return;
    }

    const originalUrl = req.originalUrl ?? req.url ?? "";
    const subPath = originalUrl.startsWith(PROXY_PATH_PREFIX)
      ? originalUrl.slice(PROXY_PATH_PREFIX.length) || "/"
      : originalUrl || "/";

    this.proxyService.proxyHttp(req, res, target, subPath);
  }
}
