import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { WikiRateLimitGuard } from './wiki-rate-limit.guard';

function makeCtx(user: { id: string; role: string } | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('WikiRateLimitGuard', () => {
  it('rejects unauthenticated requests with 401', () => {
    const guard = new WikiRateLimitGuard();
    expect(() => guard.canActivate(makeCtx(null))).toThrow(HttpException);
    try {
      guard.canActivate(makeCtx(null));
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('allows newcomer up to 5 writes per hour, then 429', () => {
    const guard = new WikiRateLimitGuard();
    const ctx = makeCtx({ id: 'u_newcomer_1', role: 'newcomer' });
    for (let i = 0; i < 5; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
    try {
      guard.canActivate(ctx);
      fail('should throw');
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('allows autoconfirmed up to 30 writes per hour', () => {
    const guard = new WikiRateLimitGuard();
    const ctx = makeCtx({ id: 'u_autoconfirmed_1', role: 'autoconfirmed' });
    for (let i = 0; i < 30; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('does not rate-limit patroller or admin', () => {
    const guard = new WikiRateLimitGuard();
    const patrol = makeCtx({ id: 'u_pat_1', role: 'patroller' });
    const adm = makeCtx({ id: 'u_adm_1', role: 'admin' });
    for (let i = 0; i < 100; i++) {
      expect(guard.canActivate(patrol)).toBe(true);
      expect(guard.canActivate(adm)).toBe(true);
    }
  });

  it('isolates buckets per user', () => {
    const guard = new WikiRateLimitGuard();
    const a = makeCtx({ id: 'u_a', role: 'newcomer' });
    const b = makeCtx({ id: 'u_b', role: 'newcomer' });
    for (let i = 0; i < 5; i++) {
      guard.canActivate(a);
      guard.canActivate(b);
    }
    expect(() => guard.canActivate(a)).toThrow(HttpException);
    expect(() => guard.canActivate(b)).toThrow(HttpException);
  });
});
