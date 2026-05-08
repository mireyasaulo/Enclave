// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AppErrorBody } from './app-error.types';

/**
 * 全局异常过滤器：保证所有错误响应都符合 AppErrorBody 形状。
 *
 * - AppError 子类直接透传 `code` / `params` / `legacyMessage`。
 * - 旧的 `throw new BadRequestException("中文")` 仍可工作：filter 会在保留 statusCode /
 *   message / error 字段（NestJS 默认形状）的基础上，附加 `code: "LEGACY_ERROR"` 与
 *   `legacyMessage`，让前端 resolver 能识别并兜底为原始 zh 字符串。
 * - 未知错误（非 HttpException）转 500，写日志并返回 INTERNAL_ERROR。
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = this.normalizeHttpException(exception, status);
      response.status(status).json(body);
      return;
    }

    this.logger.error(
      `Unhandled error on ${request?.method ?? "?"} ${request?.url ?? "?"}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const fallback: AppErrorBody = {
      code: "INTERNAL_ERROR",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      legacyMessage:
        exception instanceof Error
          ? exception.message
          : "Internal server error",
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fallback);
  }

  private normalizeHttpException(
    exception: HttpException,
    status: number,
  ): AppErrorBody {
    const raw = exception.getResponse();

    if (typeof raw === "string") {
      return {
        code: "LEGACY_ERROR",
        statusCode: status,
        message: raw,
        legacyMessage: raw,
      };
    }

    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const message = obj.message;
      const legacyMessage =
        typeof message === "string"
          ? message
          : Array.isArray(message)
            ? message.filter((value) => typeof value === "string").join("；")
            : undefined;
      const hasCode = typeof obj.code === "string";

      return {
        statusCode: typeof obj.statusCode === "number" ? obj.statusCode : status,
        ...obj,
        code: hasCode ? (obj.code as string) : "LEGACY_ERROR",
        ...(legacyMessage && !obj.legacyMessage
          ? { legacyMessage }
          : {}),
      } as AppErrorBody;
    }

    return {
      code: "LEGACY_ERROR",
      statusCode: status,
      message: exception.message,
      legacyMessage: exception.message,
    };
  }
}
// i18n-ignore-end
