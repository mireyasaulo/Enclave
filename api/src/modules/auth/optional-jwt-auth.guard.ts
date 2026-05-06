import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { AuthService } from './auth.service';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return true;
    }

    const token = header.slice(7).trim();
    if (!token) {
      return true;
    }

    try {
      const payload = await this.auth.verifyToken(token);
      const user = await this.auth.findById(payload.sub);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          userType: user.userType,
        };
      }
    } catch {
      return true;
    }

    return true;
  }
}
