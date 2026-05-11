import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  SendCodeDto,
  SendEmailCodeDto,
  VerifyCodeDto,
  VerifyEmailCodeDto,
  VerifyGoogleIdTokenDto,
} from "../http-dto/cloud-api.dto";
import {
  resolveCloudAuthTokenTtl,
  resolveCloudClientJwtAudience,
  resolveCloudJwtIssuer,
} from "../config/cloud-runtime-config";
import { CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE } from "./cloud-jwt.constants";
import { CloudClientAuthGuard } from "./cloud-client-auth.guard";
import { EmailAuthService } from "./email-auth.service";
import { GoogleAuthService } from "./google-auth.service";
import { PhoneAuthService } from "./phone-auth.service";

function parseTtlMs(ttl: string): number {
  // 接受 "7d" / "12h" / "30m" / "60s" / 纯秒数；mirror @nestjs/jwt 的 expiresIn。
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  switch (match[2]) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default: return n * 1000;
  }
}

function extractIp(request: { headers: Record<string, string | string[] | undefined> }) {
  const forwarded = request.headers["x-forwarded-for"];
  const real = request.headers["x-real-ip"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0].split(",")[0]?.trim();
    if (first) return first;
  }
  if (typeof real === "string") return real.trim();
  return null;
}

@Controller("cloud/auth")
export class CloudAuthController {
  constructor(
    private readonly phoneAuthService: PhoneAuthService,
    private readonly emailAuthService: EmailAuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Sliding TTL：客户端在 token 临到期前（剩余 < 1d）调用这个端点续命，
  // 不需要 refresh token 体系也不需要重新跑邮件验证码。鉴权仍走
  // CloudClientAuthGuard，所以过期 token 会被 401，必须重发验证码。
  @Post("refresh-access")
  @UseGuards(CloudClientAuthGuard)
  async refreshAccessToken(@Req() request: { cloudPhone?: string }) {
    const phone = request.cloudPhone ?? "";
    const ttl = resolveCloudAuthTokenTtl(this.configService);
    const accessToken = await this.jwtService.signAsync(
      {
        phone,
        purpose: CLOUD_CLIENT_ACCESS_TOKEN_PURPOSE,
      },
      {
        expiresIn: ttl as never,
        issuer: resolveCloudJwtIssuer(this.configService),
        audience: resolveCloudClientJwtAudience(this.configService),
        subject: phone,
      },
    );
    const expiresAt = new Date(
      Date.now() + parseTtlMs(typeof ttl === "string" ? ttl : String(ttl)),
    ).toISOString();
    return { accessToken, expiresAt };
  }

  @Post("send-code")
  sendCode(@Body() body: SendCodeDto) {
    return this.phoneAuthService.sendCode(body.phone);
  }

  @Post("verify-code")
  verifyCode(
    @Body() body: VerifyCodeDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ) {
    return this.phoneAuthService.verifyCode(body.phone, body.code, {
      inviteCode: body.inviteCode ?? null,
      deviceFingerprint: body.deviceFingerprint ?? null,
      ip: extractIp(request),
    });
  }

  @Post("email/send-code")
  sendEmailCode(@Body() body: SendEmailCodeDto) {
    return this.emailAuthService.sendCode(body.email);
  }

  @Post("email/verify-code")
  verifyEmailCode(
    @Body() body: VerifyEmailCodeDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ) {
    return this.emailAuthService.verifyCode(body.email, body.code, {
      inviteCode: body.inviteCode ?? null,
      deviceFingerprint: body.deviceFingerprint ?? null,
      ip: extractIp(request),
    });
  }

  @Post("google/verify-id-token")
  verifyGoogleIdToken(
    @Body() body: VerifyGoogleIdTokenDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ) {
    return this.googleAuthService.verifyIdToken(body.idToken, {
      inviteCode: body.inviteCode ?? null,
      deviceFingerprint: body.deviceFingerprint ?? null,
      ip: extractIp(request),
    });
  }
}
