import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.exception';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { EmailAuthService } from './email-auth.service';
import { UserEntity } from './user.entity';
import { WelcomeMessageService } from './welcome-message.service';

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export type AuthUserPayload = {
  sub: string;
  username: string;
  role: string;
  userType: string;
};

export type AuthSession = {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    userType: string;
    avatar?: string;
  };
};

export type AuthProfile = {
  id: string;
  username: string;
  role: string;
  userType: string;
  avatar?: string;
  email: string | null;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
};

const MIN_PASSWORD_LENGTH = 6;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly welcomeMessageService: WelcomeMessageService,
    private readonly emailAuth: EmailAuthService,
  ) {}

  async register(username: string, password: string): Promise<AuthSession> {
    const trimmed = username.trim();
    if (!trimmed || !password) {
      throw new AppError('AUTH_USERNAME_PASSWORD_REQUIRED', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '用户名与密码不能为空',
      });
    }
    const exists = await this.userRepo.findOne({ where: { username: trimmed } });
    if (exists) {
      throw new AppError('AUTH_USERNAME_TAKEN', {
        status: HttpStatus.CONFLICT,
        legacyMessage: '用户名已被占用',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminCount = await this.userRepo.count({ where: { role: 'admin' } });
    const bootstrapAsAdmin = adminCount === 0;
    const user = this.userRepo.create({
      username: trimmed,
      passwordHash,
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
    await this.welcomeMessageService.sendWelcomeMessage(saved.id);
    return this.buildSession(saved);
  }

  async login(username: string, password: string): Promise<AuthSession> {
    const trimmed = username.trim();
    const user = await this.userRepo.findOne({ where: { username: trimmed } });
    if (!user) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '账号或密码错误',
      });
    }
    if (!user.passwordHash) {
      throw new AppError('AUTH_EMAIL_LOGIN_ONLY', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '该账号通过邮箱验证码注册，请使用邮箱验证码登录。',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '账号或密码错误',
      });
    }
    return this.buildSession(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async getProfile(userId: string): Promise<AuthProfile> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError('AUTH_USER_NOT_FOUND', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '用户不存在',
      });
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      userType: user.userType,
      avatar: user.avatar,
      email: user.email ?? null,
      emailVerifiedAt: user.emailVerifiedAt
        ? user.emailVerifiedAt.toISOString()
        : null,
      hasPassword: Boolean(user.passwordHash),
    };
  }

  async sendChangePasswordCode(userId: string) {
    const user = await this.requireUserWithEmail(userId);
    return this.emailAuth.sendCode(user.email!, 'change_password');
  }

  async changePassword(
    userId: string,
    code: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const user = await this.requireUserWithEmail(userId);
    // 不 trim：前导/尾随空白本身就是合法密码字符，trim 会让 "abc " 和 "abc" 在登录时
    // 表现一致但落库不一致——用户下次输 "abc " 反而登不上去。
    const password = newPassword ?? '';
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError('AUTH_PASSWORD_TOO_SHORT', {
        status: HttpStatus.BAD_REQUEST,
        params: { min: MIN_PASSWORD_LENGTH },
        legacyMessage: `新密码至少 ${MIN_PASSWORD_LENGTH} 位。`,
      });
    }

    const session = await this.emailAuth.verifyCodeForPurpose(
      user.email!,
      code,
      'change_password',
    );

    user.passwordHash = await bcrypt.hash(password, 10);
    await this.userRepo.save(user);
    await this.emailAuth.markCodeUsed(session.id);
    return { ok: true };
  }

  async verifyToken(token: string): Promise<AuthUserPayload> {
    return this.jwt.verifyAsync<AuthUserPayload>(token, {
      secret: this.resolveSecret(),
    });
  }

  resolveSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new AppError('AUTH_JWT_SECRET_MISSING', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '服务器未配置 JWT_SECRET',
      });
    }
    return secret;
  }

  private async requireUserWithEmail(userId: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError('AUTH_USER_NOT_FOUND', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: '用户不存在',
      });
    }
    if (!user.email) {
      throw new AppError('AUTH_NO_EMAIL_BOUND', {
        status: HttpStatus.BAD_REQUEST,
        legacyMessage: '当前账号尚未绑定邮箱，无法通过邮箱验证码修改密码。',
      });
    }
    return user;
  }

  private async buildSession(user: UserEntity): Promise<AuthSession> {
    const payload: AuthUserPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      userType: user.userType,
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.resolveSecret(),
      expiresIn: '30d',
    });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        userType: user.userType,
        avatar: user.avatar,
      },
    };
  }
}
// i18n-ignore-end
