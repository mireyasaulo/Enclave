import { Body, Controller, Post, Req } from "@nestjs/common";
import {
  SendCodeDto,
  SendEmailCodeDto,
  VerifyCodeDto,
  VerifyEmailCodeDto,
} from "../http-dto/cloud-api.dto";
import { EmailAuthService } from "./email-auth.service";
import { PhoneAuthService } from "./phone-auth.service";

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
  ) {}

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
}
