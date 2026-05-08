import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppError } from '../../common/app-error.exception';

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('ADMIN_SECRET');
    if (!secret) {
      throw new AppError('ADMIN_ACCESS_NOT_CONFIGURED', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: 'Admin access is not configured on this server.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-admin-secret'];

    if (provided !== secret) {
      throw new AppError('ADMIN_INVALID_SECRET', {
        status: HttpStatus.UNAUTHORIZED,
        legacyMessage: 'Invalid admin secret.',
      });
    }

    return true;
  }
}
// i18n-ignore-end
