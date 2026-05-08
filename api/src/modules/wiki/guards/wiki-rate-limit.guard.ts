// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { rankOf } from './wiki-role.guard';

/**
 * 角色对应的"每小时最多写入次数"硬上限。
 * 与 AbuseFilter 的频率规则区分：rate-limit 是 429 硬阻断，AbuseFilter 是软启发。
 *
 * 注意：内存令牌桶仅在单进程内有效。多进程部署后续应换 Redis。
 */
const HOURLY_QUOTA: Record<string, number> = {
  newcomer: 5,
  autoconfirmed: 30,
  patroller: Number.POSITIVE_INFINITY,
  admin: Number.POSITIVE_INFINITY,
};

const WINDOW_MS = 60 * 60 * 1000;

type Bucket = { count: number; windowStart: number };

@Injectable()
export class WikiRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(WikiRateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user?.id) {
      throw new HttpException('未登录用户禁止写入', HttpStatus.UNAUTHORIZED);
    }
    const role = user.role ?? 'newcomer';
    const quota = HOURLY_QUOTA[role] ?? HOURLY_QUOTA.newcomer;
    if (!Number.isFinite(quota)) return true;

    const now = Date.now();
    let bucket = this.buckets.get(user.id);
    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
      this.buckets.set(user.id, bucket);
    }
    bucket.count += 1;
    if (bucket.count > quota) {
      this.logger.warn(
        `wiki rate limit hit user=${user.id} role=${role} count=${bucket.count} quota=${quota}`,
      );
      const retryAfterSec = Math.ceil(
        (bucket.windowStart + WINDOW_MS - now) / 1000,
      );
      throw new HttpException(
        {
          message: `编辑频率超限：${role} 每小时最多 ${quota} 次写入`,
          retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
// i18n-ignore-end
