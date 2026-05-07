/**
 * 后端 → 前端的错误信封契约。
 *
 * 与 client.ts 里 fetch 解析的 RequestErrorBody 保持兼容：后端可以在 HTTP 错误响应里返回
 * `{ code, params, legacyMessage }`（外加 NestJS 默认的 statusCode / message / error），
 * 前端 `ApiRequestError.errorCode` / `params` 会带入这些字段，再由 `translateAppErrorCode`
 * 翻译为本地化文案。
 *
 * 新模块迁移时往 `KnownAppErrorCode` 添新成员；前端 resolver 同步追加 case。
 * 旧字符串 throw 仍可用：filter 会用 `LEGACY_ERROR` + `legacyMessage` 兼容透传。
 */
export type KnownAppErrorCode =
  | "LEGACY_ERROR"
  | "INTERNAL_ERROR"
  | "VALIDATION_FAILED"
  | "FARM_CHARACTER_REQUIRED"
  | "FARM_INVALID_PLOT_INDEX"
  | "FARM_UNKNOWN_CROP"
  | "FARM_CHARACTER_NOT_PARTICIPATING"
  | "FARM_CHARACTER_NOT_FOUND"
  | "FARM_CHARACTER_NOT_VISIBLE"
  | "FARM_LEVEL_TOO_LOW"
  | "FARM_INSUFFICIENT_COINS"
  | "FARM_PLOT_NOT_PLANTABLE"
  | "FARM_PLOT_EMPTY"
  | "FARM_CROP_NOT_RIPE";

export type AppErrorCode = KnownAppErrorCode | (string & {});

export type AppErrorParams = Record<string, string | number | boolean | null>;

export interface AppErrorBody {
  code: AppErrorCode;
  params?: AppErrorParams;
  legacyMessage?: string;
  statusCode?: number;
  message?: string | string[];
  error?: string;
  requestId?: string | null;
  meta?: unknown;
}
