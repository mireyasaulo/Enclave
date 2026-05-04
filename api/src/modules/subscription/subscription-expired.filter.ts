import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionExpiredException } from './subscription-expired.exception';

@Catch(SubscriptionExpiredException)
export class SubscriptionExpiredFilter implements ExceptionFilter {
  catch(exception: SubscriptionExpiredException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status?: (code: number) => unknown;
      json?: (body: unknown) => unknown;
    } | null>();
    const body = exception.getResponse();

    if (response && typeof response.status === 'function') {
      response.status(HttpStatus.PAYMENT_REQUIRED);
      if (typeof response.json === 'function') {
        response.json(body);
      }
      return;
    }

    // WS 等无 HTTP response 的场景，由 gateway 自行捕获并下发事件，这里直接抛回
    throw exception;
  }
}
