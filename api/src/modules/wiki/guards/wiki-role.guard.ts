// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../../common/app-error.exception';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';

export const WIKI_ROLE_KEY = 'wiki_required_role';

export const WIKI_ROLE_RANK: Record<string, number> = {
  newcomer: 0,
  autoconfirmed: 1,
  patroller: 2,
  admin: 3,
};

export function rankOf(role: string | undefined): number {
  if (!role) return -1;
  return WIKI_ROLE_RANK[role] ?? -1;
}

@Injectable()
export class WikiRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(WIKI_ROLE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = req.user?.role;
    if (rankOf(role) < rankOf(required)) {
      throw new AppError('WIKI_FORBIDDEN', {
        status: HttpStatus.FORBIDDEN,
        params: { reason: `需要 ${required} 及以上权限` },
        legacyMessage: `需要 ${required} 及以上权限`,
      });
    }
    return true;
  }
}
// i18n-ignore-end
