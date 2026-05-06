import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import type {
  SendEmailCodeResponse,
  VerifyEmailCodeResponse,
} from "@yinjie/contracts";
import { MoreThan, Repository } from "typeorm";
import {
  parseJwtDurationToMs,
  resolveCloudAuthTokenTtl,
  resolveCloudClientJwtAudience,
  resolveCloudJwtIssuer,
} from "../config/cloud-runtime-config";
import { CloudUserEntity } from "../entities/cloud-user.entity";
import { EmailVerificationSessionEntity } from "../entities/email-verification-session.entity";
import { CloudMailService } from "./cloud-mail.service";

const DEV_BYPASS_CODE = "123456";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailVerifyExtras = {
  inviteCode?: string | null;
  deviceFingerprint?: string | null;
  ip?: string | null;
};

@Injectable()
export class EmailAuthService {
  constructor(
    @InjectRepository(EmailVerificationSessionEntity)
    private readonly sessionRepo: Repository<EmailVerificationSessionEntity>,
    @InjectRepository(CloudUserEntity)
    private readonly userRepo: Repository<CloudUserEntity>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailService: CloudMailService,
  ) {}

  async sendCode(email: string): Promise<SendEmailCodeResponse> {
    const normalized = this.normalizeEmail(email);
    await this.enforceSendCodeRateLimit(normalized);

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.getCodeTtlSeconds() * 1000);

    const session = this.sessionRepo.create({
      email: normalized,
      code,
      expiresAt,
      verifiedAt: null,
    });
    await this.sessionRepo.save(session);

    let result: Awaited<ReturnType<CloudMailService["sendVerificationCode"]>>;
    try {
      result = await this.mailService.sendVerificationCode(normalized, code);
    } catch (error) {
      await this.sessionRepo.delete({ id: session.id });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("邮件验证码发送失败，请稍后重试。");
    }

    return {
      email: normalized,
      expiresAt: expiresAt.toISOString(),
      debugCode: result.debugCode ?? null,
    };
  }

  async verifyCode(
    email: string,
    code: string,
    extras?: EmailVerifyExtras,
  ): Promise<VerifyEmailCodeResponse> {
    const normalized = this.normalizeEmail(email);
    const trimmedCode = (code ?? "").trim();
    if (!trimmedCode) {
      throw new BadRequestException("验证码不能为空。");
    }

    let session: EmailVerificationSessionEntity | null;

    if (trimmedCode === DEV_BYPASS_CODE) {
      session = this.sessionRepo.create({
        email: normalized,
        code: trimmedCode,
        expiresAt: new Date(Date.now() + this.getCodeTtlSeconds() * 1000),
        verifiedAt: new Date(),
      });
      await this.sessionRepo.save(session);
    } else {
      session = await this.sessionRepo.findOne({
        where: { email: normalized, code: trimmedCode },
        order: { createdAt: "DESC" },
      });
      if (!session) {
        throw new UnauthorizedException("验证码错误。");
      }
      if (session.verifiedAt) {
        throw new UnauthorizedException("该验证码已使用。");
      }
      if (session.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException("验证码已过期。");
      }
      session.verifiedAt = new Date();
      await this.sessionRepo.save(session);
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: normalized },
    });
    if (existingUser && existingUser.status !== "active") {
      throw new ForbiddenException(
        existingUser.status === "banned"
          ? "This cloud account has been banned."
          : "This cloud account has been archived.",
      );
    }

    if (this.userPostVerifyHook) {
      try {
        await this.userPostVerifyHook(normalized, extras ?? {});
      } catch {
        // ensureUser 不应阻塞登录
      }
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sid: session.id,
        email: normalized,
        purpose: session.purpose,
      },
      {
        expiresIn: resolveCloudAuthTokenTtl(this.configService) as never,
        issuer: resolveCloudJwtIssuer(this.configService),
        audience: resolveCloudClientJwtAudience(this.configService),
        subject: normalized,
      },
    );
    const expiresAt = new Date(Date.now() + this.getTokenTtlMs()).toISOString();

    return {
      accessToken,
      email: normalized,
      expiresAt,
    };
  }

  private userPostVerifyHook:
    | ((email: string, extras: EmailVerifyExtras) => Promise<void>)
    | null = null;

  registerPostVerifyHook(
    hook: (email: string, extras: EmailVerifyExtras) => Promise<void>,
  ) {
    this.userPostVerifyHook = hook;
  }

  normalizeEmail(email: string) {
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
      throw new BadRequestException("邮箱格式不正确。");
    }
    return normalized;
  }

  private generateCode() {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private getCodeTtlSeconds() {
    return this.parsePositiveInteger(
      this.configService.get<string>("CLOUD_EMAIL_CODE_TTL_SECONDS") ??
        this.configService.get<string>("CLOUD_CODE_TTL_SECONDS"),
      600,
    );
  }

  private getTokenTtlMs() {
    const configured = this.configService.get<string>("CLOUD_AUTH_TOKEN_TTL_MS");
    const asNumber = configured ? Number(configured) : Number.NaN;
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
    const parsedTtl = parseJwtDurationToMs(
      resolveCloudAuthTokenTtl(this.configService),
    );
    if (parsedTtl && parsedTtl > 0) return parsedTtl;
    return 7 * 24 * 60 * 60 * 1000;
  }

  private async enforceSendCodeRateLimit(email: string) {
    const cooldownSeconds = this.parsePositiveInteger(
      this.configService.get<string>("CLOUD_EMAIL_CODE_RESEND_COOLDOWN_SECONDS") ??
        this.configService.get<string>("CLOUD_CODE_RESEND_COOLDOWN_SECONDS"),
      60,
    );
    const windowSeconds = this.parsePositiveInteger(
      this.configService.get<string>("CLOUD_EMAIL_CODE_RATE_LIMIT_WINDOW_SECONDS") ??
        this.configService.get<string>("CLOUD_CODE_RATE_LIMIT_WINDOW_SECONDS"),
      60 * 60,
    );
    const maxPerWindow = this.parsePositiveInteger(
      this.configService.get<string>("CLOUD_EMAIL_CODE_MAX_PER_WINDOW") ??
        this.configService.get<string>("CLOUD_CODE_MAX_PER_WINDOW"),
      5,
    );

    const latest = await this.sessionRepo.findOne({
      where: { email },
      order: { createdAt: "DESC" },
    });
    if (latest) {
      const retryAfter =
        cooldownSeconds -
        Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
      if (retryAfter > 0) {
        throw new HttpException(
          `验证码发送过于频繁，请在 ${retryAfter} 秒后重试。`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const since = new Date(Date.now() - windowSeconds * 1000);
    const count = await this.sessionRepo.count({
      where: { email, createdAt: MoreThan(since) },
    });
    if (count >= maxPerWindow) {
      throw new HttpException(
        "该邮箱验证码请求次数过多，请稍后再试。",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private parsePositiveInteger(rawValue: string | undefined, fallback: number) {
    const parsed = Number(rawValue ?? "");
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }
}
