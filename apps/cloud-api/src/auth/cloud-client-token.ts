import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import {
  parseJwtDurationToMs,
  resolveCloudAuthTokenTtl,
  resolveCloudClientJwtAudience,
  resolveCloudJwtIssuer,
} from "../config/cloud-runtime-config";
import { CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE } from "./cloud-jwt.constants";

export type IssueCloudClientAccessTokenInput = {
  jwtService: JwtService;
  configService: ConfigService;
  sessionId: string;
  synthPhone: string;
  email: string | null;
  purpose?: string;
};

export type IssueCloudClientAccessTokenResult = {
  accessToken: string;
  expiresAt: string;
};

export async function issueCloudClientAccessToken(
  input: IssueCloudClientAccessTokenInput,
): Promise<IssueCloudClientAccessTokenResult> {
  const { jwtService, configService, sessionId, synthPhone, email } = input;
  const purpose = input.purpose ?? CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE;

  const accessToken = await jwtService.signAsync(
    {
      sid: sessionId,
      phone: synthPhone,
      ...(email ? { email } : {}),
      purpose,
    },
    {
      expiresIn: resolveCloudAuthTokenTtl(configService) as never,
      issuer: resolveCloudJwtIssuer(configService),
      audience: resolveCloudClientJwtAudience(configService),
      subject: synthPhone,
    },
  );

  const expiresAt = new Date(
    Date.now() + getCloudClientTokenTtlMs(configService),
  ).toISOString();

  return { accessToken, expiresAt };
}

export function getCloudClientTokenTtlMs(configService: ConfigService): number {
  const configured = configService.get<string>("CLOUD_AUTH_TOKEN_TTL_MS");
  const asNumber = configured ? Number(configured) : Number.NaN;
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }
  const parsedTtl = parseJwtDurationToMs(resolveCloudAuthTokenTtl(configService));
  if (parsedTtl && parsedTtl > 0) return parsedTtl;
  return 7 * 24 * 60 * 60 * 1000;
}
