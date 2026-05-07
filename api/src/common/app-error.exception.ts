import { HttpException, HttpStatus } from "@nestjs/common";
import type { AppErrorCode, AppErrorParams } from "@yinjie/contracts";

export interface AppErrorOptions {
  status?: HttpStatus;
  legacyMessage?: string;
  params?: AppErrorParams;
}

/**
 * 业务异常基类。和现有 BadRequestException / NotFoundException 等不同，AppError 把
 * 错误码 (`code`) 与参数 (`params`) 写进响应体，前端可据此本地化文案。`legacyMessage`
 * 用于兜底（旧前端或兜底场景）。
 *
 * 使用：
 *   throw new AppError("FARM_LEVEL_TOO_LOW", {
 *     status: HttpStatus.FORBIDDEN,
 *     params: { level: 5, cropName: "小麦" },
 *     legacyMessage: `等级不足：需 5 级才能种 小麦`,
 *   });
 */
export class AppError extends HttpException {
  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    const body: Record<string, unknown> = { code };
    if (options.params) {
      body.params = options.params;
    }
    if (options.legacyMessage) {
      body.legacyMessage = options.legacyMessage;
      body.message = options.legacyMessage;
    }
    super(body, options.status ?? HttpStatus.BAD_REQUEST);
  }
}
