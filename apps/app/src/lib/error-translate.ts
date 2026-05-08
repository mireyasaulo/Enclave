import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { AppErrorCode, AppErrorParams, KnownAppErrorCode } from "@yinjie/contracts";

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

/**
 * 把后端返回的 AppError code / params 翻译为本地化文案。
 *
 * 命中已知 code → 返回当前 locale 文案；
 * 命中 LEGACY_ERROR / 未知 code → 返回 null，由调用方回退到 legacyMessage 或通用错误提示。
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
    case "FARM_CHARACTER_REQUIRED":
      return translateRuntimeMessage(msg`需要先选择一个角色。`);
    case "FARM_INVALID_PLOT_INDEX":
      return translateRuntimeMessage(msg`地块编号无效。`);
    case "FARM_UNKNOWN_CROP":
      return translateRuntimeMessage(
        msg`未知作物：${String(params.cropId ?? "")}`,
      );
    case "FARM_CHARACTER_NOT_PARTICIPATING":
      return translateRuntimeMessage(msg`该角色不参与农场。`);
    case "FARM_CHARACTER_NOT_FOUND":
      return translateRuntimeMessage(
        msg`角色不存在：${String(params.characterId ?? "")}`,
      );
    case "FARM_CHARACTER_NOT_VISIBLE":
      return translateRuntimeMessage(msg`该角色当前不可见。`);
    case "FARM_LEVEL_TOO_LOW":
      return translateRuntimeMessage(
        msg`等级不足：需 ${String(params.unlockLevel ?? "?")} 级才能种 ${String(params.cropName ?? "")}`,
      );
    case "FARM_BUY_LEVEL_TOO_LOW":
      return translateRuntimeMessage(
        msg`等级不足：需 ${String(params.unlockLevel ?? "?")} 级才能购买 ${String(params.cropName ?? "")} 种子`,
      );
    case "FARM_INSUFFICIENT_COINS":
      return translateRuntimeMessage(
        msg`金币不足：需 ${String(params.required ?? "?")}`,
      );
    case "FARM_PLOT_NOT_FOUND":
      return translateRuntimeMessage(msg`田块不存在。`);
    case "FARM_PLOT_NOT_PLANTABLE":
      return translateRuntimeMessage(msg`这块地现在不能种植。`);
    case "FARM_PLOT_EMPTY":
      return translateRuntimeMessage(msg`地块上没有作物。`);
    case "FARM_CROP_NOT_RIPE":
      return translateRuntimeMessage(msg`作物还没成熟。`);
    case "FARM_NPC_OPERATION_NOT_OPEN":
      return translateRuntimeMessage(
        msg`对 NPC 的此操作将在邻居模块开放：${String(params.op ?? "")}`,
      );
    case "FARM_QUANTITY_INVALID":
      return translateRuntimeMessage(msg`数量必须为正整数。`);
    case "FARM_WAREHOUSE_INSUFFICIENT":
      return translateRuntimeMessage(
        msg`仓库中 ${String(params.cropName ?? "")} 不足。`,
      );
    case "FARM_NPC_NO_FARM":
      return translateRuntimeMessage(msg`该角色还没有农场。`);
    case "FARM_ALREADY_STOLEN":
      return translateRuntimeMessage(msg`你已经偷过这块田了。`);
    case "FARM_ALREADY_WATERED":
      return translateRuntimeMessage(msg`这块田今日已浇过水。`);
    case "FARM_NO_WEEDS":
      return translateRuntimeMessage(msg`这块田没有杂草。`);
    case "FARM_NO_BUGS":
      return translateRuntimeMessage(msg`这块田没有害虫。`);
    case "FARM_DAILY_STEAL_LIMIT":
      return translateRuntimeMessage(
        msg`今日偷菜次数已达上限（${String(params.limit ?? "?")}/天）。`,
      );
    case "MOMENTS_MEDIA_REQUIRED":
      return translateRuntimeMessage(msg`请先选择一个朋友圈媒体文件。`);
    case "MOMENTS_INVALID_MEDIA_TYPE":
      return translateRuntimeMessage(msg`朋友圈当前仅支持图片或视频。`);
    case "MOMENTS_MEDIA_NOT_FOUND":
      return translateRuntimeMessage(msg`朋友圈媒体不存在。`);
    case "MOMENTS_NOT_FOUND":
      return translateRuntimeMessage(msg`朋友圈不存在。`);
    case "MOMENTS_NOT_FRIEND":
      return translateRuntimeMessage(msg`需先加为好友才能互动。`);
    case "MOMENTS_EMPTY":
      return translateRuntimeMessage(msg`朋友圈内容和媒体不能同时为空。`);
    case "MOMENTS_TEXT_NO_MEDIA":
      return translateRuntimeMessage(msg`纯文本朋友圈不能附带图片或视频。`);
    case "MOMENTS_VIDEO_SINGLE":
      return translateRuntimeMessage(msg`视频朋友圈必须且只能包含 1 条视频。`);
    case "MOMENTS_VIDEO_TOO_LONG":
      return translateRuntimeMessage(msg`朋友圈视频时长不能超过 5 分钟。`);
    case "MOMENTS_IMAGES_MAX":
      return translateRuntimeMessage(
        msg`图片朋友圈最多支持 ${String(params.max ?? 9)} 张图片。`,
      );
    case "MOMENTS_IMAGES_TYPE_ONLY":
      return translateRuntimeMessage(msg`图片朋友圈当前只支持图片资源。`);
    case "REMINDER_LIMIT_INVALID":
      return translateRuntimeMessage(msg`limit 必须是正整数。`);
    case "REMINDER_ONLY_ACTIVE_COMPLETE":
      return translateRuntimeMessage(msg`只有激活中的提醒可以完成。`);
    case "REMINDER_ONLY_ACTIVE_DEFER":
      return translateRuntimeMessage(msg`只有激活中的提醒可以延后。`);
    case "REMINDER_NOT_FOUND":
      return translateRuntimeMessage(msg`提醒不存在。`);
    case "REMINDER_UNTIL_INVALID":
      return translateRuntimeMessage(msg`until 不是有效时间。`);
    case "REMINDER_DEFER_INVALID":
      return translateRuntimeMessage(msg`请提供有效的延后时间。`);
    case "VALIDATION_FAILED":
      return translateRuntimeMessage(msg`提交的数据无效，请检查后重试。`);
    case "INTERNAL_ERROR":
      return translateRuntimeMessage(msg`服务暂时不可用，请稍后再试。`);
    case "LEGACY_ERROR":
      return null;
    default:
      return null;
  }
}
