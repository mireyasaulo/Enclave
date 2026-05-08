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
    case "CHARACTER_NOT_FOUND":
      return translateRuntimeMessage(
        msg`角色不存在：${String(params.id ?? params.characterId ?? "")}`,
      );
    case "CHARACTER_ALREADY_EXISTS":
      return translateRuntimeMessage(
        msg`角色已存在：${String(params.id ?? "")}`,
      );
    case "CHARACTER_DEFAULT_NOT_DELETABLE":
      return translateRuntimeMessage(msg`默认保底角色不可删除。`);
    case "PRESET_NOT_FOUND":
      return translateRuntimeMessage(
        msg`预设角色不存在：${String(params.presetKey ?? "")}`,
      );
    case "PRESET_AT_LEAST_ONE":
      return translateRuntimeMessage(msg`至少选择一个预设角色。`);
    case "BLUEPRINT_CHAT_SAMPLE_REQUIRED":
      return translateRuntimeMessage(msg`需要提供聊天样本。`);
    case "BLUEPRINT_REVISION_NOT_FOUND":
      return translateRuntimeMessage(
        msg`角色蓝图版本不存在：${String(params.revisionId ?? "")}`,
      );
    case "SHAKE_DISABLED":
      return translateRuntimeMessage(msg`摇一摇当前已在后台停用。`);
    case "SHAKE_COOLDOWN":
      return translateRuntimeMessage(
        msg`请至少间隔 ${String(params.cooldownMinutes ?? "?")} 分钟再摇一次。`,
      );
    case "SHAKE_DAILY_LIMIT":
      return translateRuntimeMessage(msg`今日摇一摇次数已达到上限。`);
    case "SHAKE_CYBER_AVATAR_NO_SIGNAL":
      return translateRuntimeMessage(
        msg`当前赛博分身信号不足，暂时还不能生成新的摇一摇角色。`,
      );
    case "SHAKE_SESSION_NOT_FOUND":
      return translateRuntimeMessage(
        msg`摇一摇会话不存在：${String(params.sessionId ?? "")}`,
      );
    case "SHAKE_NOT_DISCARDABLE":
      return translateRuntimeMessage(msg`当前摇一摇结果已经不可再放弃。`);
    case "SHAKE_KEPT_CHARACTER_MISSING":
      return translateRuntimeMessage(
        msg`当前摇一摇结果已保留，但角色记录不存在。`,
      );
    case "SHAKE_NOT_KEEPABLE":
      return translateRuntimeMessage(msg`当前摇一摇结果已经不能再保留。`);
    case "SHAKE_DRAFT_MISSING":
      return translateRuntimeMessage(msg`当前摇一摇结果缺少角色草稿。`);
    case "SHAKE_CHARACTER_CREATE_FAILED":
      return translateRuntimeMessage(msg`当前摇一摇结果无法创建对应角色。`);
    case "SHAKE_NO_DIRECTIONS":
      return translateRuntimeMessage(msg`没有可用的摇一摇方向。`);
    case "AUTH_USERNAME_PASSWORD_REQUIRED":
      return translateRuntimeMessage(msg`用户名与密码不能为空。`);
    case "AUTH_USERNAME_TAKEN":
      return translateRuntimeMessage(msg`用户名已被占用。`);
    case "AUTH_INVALID_CREDENTIALS":
      return translateRuntimeMessage(msg`账号或密码错误。`);
    case "AUTH_EMAIL_LOGIN_ONLY":
      return translateRuntimeMessage(
        msg`该账号通过邮箱验证码注册，请使用邮箱验证码登录。`,
      );
    case "AUTH_JWT_SECRET_MISSING":
      return translateRuntimeMessage(msg`服务器未配置 JWT_SECRET。`);
    case "AUTH_CODE_REQUIRED":
      return translateRuntimeMessage(msg`验证码不能为空。`);
    case "AUTH_CODE_INVALID":
      return translateRuntimeMessage(msg`验证码错误。`);
    case "AUTH_CODE_USED":
      return translateRuntimeMessage(msg`该验证码已使用。`);
    case "AUTH_CODE_EXPIRED":
      return translateRuntimeMessage(msg`验证码已过期。`);
    case "AUTH_EMAIL_INVALID":
      return translateRuntimeMessage(msg`邮箱格式不正确。`);
    case "AUTH_TOKEN_MISSING":
      return translateRuntimeMessage(msg`缺少访问令牌。`);
    case "AUTH_TOKEN_INVALID":
      return translateRuntimeMessage(msg`访问令牌无效或已过期。`);
    case "AUTH_USER_NOT_FOUND":
      return translateRuntimeMessage(msg`用户不存在。`);
    case "AUTH_EMAIL_BIND_FAILED":
      return translateRuntimeMessage(msg`邮箱绑定失败，请稍后重试。`);
    case "AUTH_EMAIL_SEND_FAILED":
      return translateRuntimeMessage(msg`验证码发送失败，请稍后重试。`);
    case "AUTH_CODE_RESEND_TOO_FAST":
      return translateRuntimeMessage(
        msg`验证码发送过于频繁，请在 ${String(params.retryAfter ?? "?")} 秒后重试。`,
      );
    case "AUTH_CODE_TOO_MANY":
      return translateRuntimeMessage(msg`该邮箱验证码请求次数过多，请稍后再试。`);
    case "AI_AUDIO_REQUIRED":
      return translateRuntimeMessage(msg`请先录一段语音再试。`);
    case "AI_AUDIO_MODE_UNSUPPORTED":
      return translateRuntimeMessage(msg`当前语音模式暂不支持。`);
    case "AI_TTS_TEXT_REQUIRED":
      return translateRuntimeMessage(msg`请先提供要播报的文本。`);
    case "AI_TTS_EMPTY":
      return translateRuntimeMessage(msg`语音生成结果为空，请稍后再试。`);
    case "AI_AUDIO_RETRY_FAILED":
      return translateRuntimeMessage(msg`语音请求重试失败。`);
    case "AI_RATE_LIMIT":
      return translateRuntimeMessage(
        typeof params.message === "string"
          ? msg`请求过于频繁：${String(params.message)}`
          : msg`请求过于频繁，请稍后再试。`,
      );
    case "AI_PROVIDER_UNAVAILABLE":
      return translateRuntimeMessage(msg`当前 AI 服务不可用，请稍后再试。`);
    case "AI_IMAGE_PROMPT_REQUIRED":
      return translateRuntimeMessage(msg`请先提供图片生成描述。`);
    case "AI_IMAGE_EMPTY":
      return translateRuntimeMessage(msg`图片生成结果为空，请稍后再试。`);
    case "AI_IMAGE_PROVIDER_UNAVAILABLE":
      return translateRuntimeMessage(msg`图片生成服务不可用，请稍后再试。`);
    case "AI_TRANSCRIBE_AUDIO_REQUIRED":
      return translateRuntimeMessage(msg`没有收到可转写的音频内容。`);
    case "AI_TRANSCRIBE_TOO_LARGE":
      return translateRuntimeMessage(msg`录音文件过大，请缩短单次语音输入时长。`);
    case "AI_TRANSCRIBE_FORMAT_INVALID":
      return translateRuntimeMessage(msg`录音文件格式不受支持，请重试。`);
    case "AI_TRANSCRIBE_PROVIDER_UNAVAILABLE":
      return translateRuntimeMessage(msg`语音转写服务不可用，请稍后再试。`);
    case "AI_TRANSCRIBE_GATEWAY_FAILED":
      return translateRuntimeMessage(msg`语音转写失败，请稍后再试。`);
    case "AI_SPEECH_ASSET_NOT_FOUND":
      return translateRuntimeMessage(msg`语音资源不存在。`);
    case "PROVIDER_ACCOUNT_NAME_REQUIRED":
      return translateRuntimeMessage(msg`Provider 账户名称不能为空。`);
    case "PROVIDER_ACCOUNT_ENDPOINT_REQUIRED":
      return translateRuntimeMessage(msg`Provider 接口地址不能为空。`);
    case "PROVIDER_ACCOUNT_NOT_FOUND":
      return translateRuntimeMessage(
        msg`Provider 账户不存在：${String(params.id ?? params.providerAccountId ?? "")}`,
      );
    case "PROVIDER_ACCOUNT_DISABLED_FOR_DEFAULT":
      return translateRuntimeMessage(msg`请先启用该 Provider 账户，再设为默认。`);
    case "PROVIDER_ACCOUNT_DISABLED_FOR_REBIND":
      return translateRuntimeMessage(
        msg`请先启用目标 Provider 账户，再批量换绑模型人格角色。`,
      );
    case "PROVIDER_ACCOUNT_MODEL_REQUIRED":
      return translateRuntimeMessage(msg`请先填写默认模型 ID。`);
    case "PROVIDER_ACCOUNT_DEFAULT_NOT_FOUND":
      return translateRuntimeMessage(msg`默认 Provider 账户不存在。`);
    case "PROVIDER_CATALOG_AT_LEAST_ONE_INSTALLABLE":
      return translateRuntimeMessage(msg`至少选择一个可安装的模型目录项。`);
    case "PROVIDER_CATALOG_AT_LEAST_ONE_REGISTERED":
      return translateRuntimeMessage(msg`至少选择一个已登记的模型目录项。`);
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
