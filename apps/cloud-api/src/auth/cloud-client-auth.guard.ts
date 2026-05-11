// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  resolveCloudClientJwtAudience,
  resolveCloudJwtIssuer,
} from "../config/cloud-runtime-config";
import { CloudUserEntity } from "../entities/cloud-user.entity";
import { CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE } from "./cloud-jwt.constants";

type CloudRequest = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  cloudPhone?: string;
};

type CloudClientJwtPayload = {
  phone?: string;
  purpose?: string;
  sub?: string;
};

@Injectable()
export class CloudClientAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(CloudUserEntity)
    private readonly userRepo: Repository<CloudUserEntity>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CloudRequest>();
    const authorization = request.headers["authorization"];
    // 优先用 Authorization header；fallback 用 ?token= / ?auth_token= 查询串，
    // 给 <video src>/<audio src>/<img src> 这类无法设置 header 的媒体请求兜底
    // （与 world-api-ws-proxy 里 extractToken 的策略一致）。
    const headerToken =
      typeof authorization === "string" &&
      authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim() || null
        : null;
    const queryToken = headerToken ? null : extractQueryToken(request.query);
    const token = headerToken ?? queryToken;

    if (!token) {
      throw new UnauthorizedException("Missing cloud access token.");
    }

    let payload: CloudClientJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<CloudClientJwtPayload>(token, {
        issuer: resolveCloudJwtIssuer(this.configService),
        audience: resolveCloudClientJwtAudience(this.configService),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired cloud access token.");
    }

    if (
      !payload.phone ||
      payload.purpose !== CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE ||
      payload.sub !== payload.phone
    ) {
      throw new UnauthorizedException("Invalid cloud access token.");
    }

    const user = await this.userRepo.findOne({
      where: { phone: payload.phone },
    });
    if (user && user.status !== "active") {
      throw new ForbiddenException(
        user.status === "banned"
          ? "This cloud account has been banned."
          : "This cloud account has been archived.",
      );
    }

    request.cloudPhone = payload.phone;
    return true;
  }
}

function extractQueryToken(
  query?: Record<string, string | string[] | undefined>,
): string | null {
  if (!query) return null;
  const candidates = [query["token"], query["auth_token"]];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    } else if (Array.isArray(candidate) && candidate.length > 0) {
      const first = typeof candidate[0] === "string" ? candidate[0].trim() : "";
      if (first) return first;
    }
  }
  return null;
}
// i18n-ignore-end
