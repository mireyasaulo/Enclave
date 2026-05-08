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
  | "FARM_BUY_LEVEL_TOO_LOW"
  | "FARM_INSUFFICIENT_COINS"
  | "FARM_PLOT_NOT_FOUND"
  | "FARM_PLOT_NOT_PLANTABLE"
  | "FARM_PLOT_EMPTY"
  | "FARM_CROP_NOT_RIPE"
  | "FARM_NPC_OPERATION_NOT_OPEN"
  | "FARM_QUANTITY_INVALID"
  | "FARM_WAREHOUSE_INSUFFICIENT"
  | "FARM_NPC_NO_FARM"
  | "FARM_ALREADY_STOLEN"
  | "FARM_ALREADY_WATERED"
  | "FARM_NO_WEEDS"
  | "FARM_NO_BUGS"
  | "FARM_DAILY_STEAL_LIMIT"
  | "MOMENTS_MEDIA_REQUIRED"
  | "MOMENTS_INVALID_MEDIA_TYPE"
  | "MOMENTS_MEDIA_NOT_FOUND"
  | "MOMENTS_NOT_FOUND"
  | "MOMENTS_NOT_FRIEND"
  | "MOMENTS_EMPTY"
  | "MOMENTS_TEXT_NO_MEDIA"
  | "MOMENTS_VIDEO_SINGLE"
  | "MOMENTS_VIDEO_TOO_LONG"
  | "MOMENTS_IMAGES_MAX"
  | "MOMENTS_IMAGES_TYPE_ONLY"
  | "REMINDER_LIMIT_INVALID"
  | "REMINDER_ONLY_ACTIVE_COMPLETE"
  | "REMINDER_ONLY_ACTIVE_DEFER"
  | "REMINDER_NOT_FOUND"
  | "REMINDER_UNTIL_INVALID"
  | "REMINDER_DEFER_INVALID";

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
