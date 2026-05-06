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
    const token =
      typeof authorization === "string" &&
      authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : null;

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
