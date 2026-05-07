import type {
  AppErrorCode,
  AppErrorParams,
  KnownAppErrorCode,
} from "@yinjie/contracts";
import { translateCloudConsoleTextForActiveLocale } from "./cloud-console-i18n";

/**
 * 与 ApiRequestError / 直接拿到的 AppErrorBody 结构都兼容的最小契约。
 */
export interface AppErrorLike {
  errorCode?: string | null;
  code?: string | null;
  params?: AppErrorParams | null;
  legacyMessage?: string | null;
  message?: string | string[];
}

function applyTemplate(template: string, params: Record<string, unknown>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
}

/**
 * 把后端返回的 AppError code / params 翻译为 cloud-console 当前 locale 的文案。
 *
 * 命中已知 code → 返回当前 locale 文案；
 * 命中 LEGACY_ERROR / 未知 code → 返回 null，由调用方回退到 legacyMessage 或通用错误提示。
 *
 * cloud-console 主要面向 farm 之外的运维场景，常见 code 比较有限；新增 case 时同步在
 * `cloud-console-i18n.ts` 的 runtime dictionary 里把对应 zh-CN/ja-JP/ko-KR 译文写进去。
 */
export function translateAppErrorCode(
  error: AppErrorLike | null | undefined,
): string | null {
  if (!error) {
    return null;
  }
  const rawCode = (error.errorCode ?? error.code) as
    | AppErrorCode
    | undefined
    | null;
  if (!rawCode) {
    return null;
  }
  const params = (error.params ?? {}) as Record<
    string,
    string | number | boolean | null
  >;

  switch (rawCode as KnownAppErrorCode) {
    case "VALIDATION_FAILED":
      return translateCloudConsoleTextForActiveLocale(
        "The submitted data is invalid.",
      );
    case "INTERNAL_ERROR":
      return translateCloudConsoleTextForActiveLocale(
        "Service is temporarily unavailable. Please try again.",
      );
    case "FARM_LEVEL_TOO_LOW":
      return applyTemplate(
        translateCloudConsoleTextForActiveLocale(
          "Level too low: need level {unlockLevel} to plant {cropName}.",
        ),
        params,
      );
    case "LEGACY_ERROR":
      return null;
    default:
      return null;
  }
}
