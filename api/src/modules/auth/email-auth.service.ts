import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { MoreThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import type { AuthSession, AuthUserPayload } from './auth.service';
import { EmailVerificationSessionEntity } from './email-verification-session.entity';
import { UserEntity } from './user.entity';
import { WelcomeMessageService } from './welcome-message.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SendEmailCodeResult = {
  email: string;
  expiresAt: string;
  debugCode: string | null;
};

@Injectable()
export class EmailAuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(EmailVerificationSessionEntity)
    private readonly sessionRepo: Repository<EmailVerificationSessionEntity>,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly welcomeMessageService: WelcomeMessageService,
  ) {}

  async sendCode(email: string): Promise<SendEmailCodeResult> {
    const normalized = this.normalizeEmail(email);
    await this.enforceSendCodeRateLimit(normalized);

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.getCodeTtlSeconds() * 1000);
    const session = this.sessionRepo.create({
      email: normalized,
      code,
      purpose: 'login',
      expiresAt,
      verifiedAt: null,
    });
    await this.sessionRepo.save(session);

    let result: Awaited<ReturnType<MailService['sendVerificationCode']>>;
    try {
      result = await this.mail.sendVerificationCode(normalized, code);
    } catch (error) {
      await this.sessionRepo.delete({ id: session.id });
      throw error;
    }

    return {
      email: normalized,
      expiresAt: expiresAt.toISOString(),
      debugCode: result.debugCode,
    };
  }

  async verifyCode(email: string, code: string): Promise<AuthSession> {
    const normalized = this.normalizeEmail(email);
    const trimmedCode = (code ?? '').trim();
    if (!trimmedCode) {
      throw new BadRequestException('验证码不能为空。');
    }

    const session = await this.sessionRepo.findOne({
      where: { email: normalized, code: trimmedCode },
      order: { createdAt: 'DESC' },
    });
    if (!session) {
      throw new UnauthorizedException('验证码错误。');
    }
    if (session.verifiedAt) {
      throw new UnauthorizedException('该验证码已使用。');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('验证码已过期。');
    }

    session.verifiedAt = new Date();
    await this.sessionRepo.save(session);

    const user = await this.findOrCreateUserByEmail(normalized);
    return this.buildSession(user);
  }

  private async findOrCreateUserByEmail(email: string): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      if (!existing.emailVerifiedAt) {
        existing.emailVerifiedAt = new Date();
        await this.userRepo.save(existing);
      }
      return existing;
    }

    const username = await this.generateUniqueUsernameFromEmail(email);
    const adminCount = await this.userRepo.count({ where: { role: 'admin' } });
    const bootstrapAsAdmin = adminCount === 0;

    const user = this.userRepo.create({
      username,
      email,
      emailVerifiedAt: new Date(),
      passwordHash: null,
      onboardingCompleted: false,
      avatar: '',
      signature: '',
      customApiKey: null,
      customApiBase: null,
      defaultChatBackgroundPayload: null,
      userType: 'wiki_member',
      role: bootstrapAsAdmin ? 'admin' : 'newcomer',
      roleGrantedAt: bootstrapAsAdmin ? new Date() : null,
      roleGrantedBy: bootstrapAsAdmin ? 'first_wiki_member_bootstrap' : null,
    });
    const saved = await this.userRepo.save(user);
    await this.welcomeMessageService.sendWelcomeMessage();
    return saved;
  }

  private async generateUniqueUsernameFromEmail(email: string): Promise<string> {
    const base = (email.split('@')[0] ?? 'user')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 24) || 'user';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomBytes(2).toString('hex');
      const candidate = `${base}_${suffix}`;
      const collision = await this.userRepo.findOne({
        where: { username: candidate },
      });
      if (!collision) return candidate;
    }
    return `${base}_${randomBytes(4).toString('hex')}`;
  }

  private buildSession(user: UserEntity): Promise<AuthSession> {
    const payload: AuthUserPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      userType: user.userType,
    };
    return this.jwt
      .signAsync(payload, {
        secret: this.resolveJwtSecret(),
        expiresIn: '30d',
      })
      .then((token) => ({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          userType: user.userType,
          avatar: user.avatar,
        },
      }));
  }

  private resolveJwtSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('服务器未配置 JWT_SECRET');
    }
    return secret;
  }

  private async enforceSendCodeRateLimit(email: string): Promise<void> {
    const cooldown = this.parsePositiveInteger(
      this.config.get<string>('EMAIL_CODE_RESEND_COOLDOWN_SECONDS'),
      60,
    );
    const window = this.parsePositiveInteger(
      this.config.get<string>('EMAIL_CODE_RATE_LIMIT_WINDOW_SECONDS'),
      3600,
    );
    const max = this.parsePositiveInteger(
      this.config.get<string>('EMAIL_CODE_MAX_PER_WINDOW'),
      5,
    );

    const latest = await this.sessionRepo.findOne({
      where: { email },
      order: { createdAt: 'DESC' },
    });
    if (latest) {
      const retryAfter =
        cooldown - Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
      if (retryAfter > 0) {
        throw new HttpException(
          `验证码发送过于频繁，请在 ${retryAfter} 秒后重试。`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const since = new Date(Date.now() - window * 1000);
    const count = await this.sessionRepo.count({
      where: { email, createdAt: MoreThan(since) },
    });
    if (count >= max) {
      throw new HttpException(
        '该邮箱验证码请求次数过多，请稍后再试。',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getCodeTtlSeconds(): number {
    return this.parsePositiveInteger(
      this.config.get<string>('EMAIL_CODE_TTL_SECONDS'),
      600,
    );
  }

  private generateCode(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private normalizeEmail(raw: string): string {
    const trimmed = (raw ?? '').trim().toLowerCase();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed) || trimmed.length > 254) {
      throw new BadRequestException('邮箱格式不正确。');
    }
    return trimmed;
  }

  private parsePositiveInteger(raw: string | undefined, fallback: number) {
    const parsed = Number(raw ?? '');
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }
}
