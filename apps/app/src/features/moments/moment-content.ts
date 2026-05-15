import { msg } from "@lingui/macro";
import type {
  Moment,
  MomentContentType,
  MomentMediaAsset,
} from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

// 偶尔 LLM 会把本该走 tool-call 通道的 web_search/code_interpreter 等调用
// 当成普通正文发出来，下游把它原样存成 moment.text / comment.text。
// 后端目前没有兜底过滤，于是 UI 上会看到 `[TOOL_CALL] {tool => web_search ...`
// 或 `<tool_call><tool name=...><args>...</args></tool></tool_call>` 这种内部语法。
// 这里在展示层把这些片段清掉——只是兜底，真正的 fix 应该在生成端。
export function stripToolCallSyntax(input: string): string {
  if (!input) return input;
  let out = input;
  // <tool_call>...</tool_call> 多行 XML（含未闭合情况：吃到字符串末尾）
  out = out.replace(/<tool_call\b[\s\S]*?(?:<\/tool_call>|$)/gi, "");
  // <tool ...>...</tool> 同样的 XML 风格
  out = out.replace(/<tool\b[\s\S]*?(?:<\/tool>|$)/gi, "");
  // [TOOL_CALL] {...} 风格：通常会被截断不闭合，直接吃到结尾
  out = out.replace(/\[TOOL_CALL\][\s\S]*$/i, "");
  // 孤立闭合标签（前面已经被吃掉了开头的）
  out = out.replace(/<\/tool_call>/gi, "").replace(/<\/tool>/gi, "");
  return out.trim();
}

export function describeMomentMediaContent(
  contentType: MomentContentType,
  media: MomentMediaAsset[],
) {
  if (!media.length) {
    return t(msg`朋友圈动态`);
  }

  if (contentType === "video") {
    return t(msg`一条视频`);
  }

  const imageCount = media.filter((asset) => asset.kind === "image").length;
  if (contentType === "live_photo") {
    return imageCount > 0 ? t(msg`${imageCount} 张实况照片`) : t(msg`实况照片`);
  }

  return imageCount > 0 ? t(msg`${imageCount} 张图片`) : t(msg`朋友圈动态`);
}

export function getMomentSummaryText(
  moment: Pick<Moment, "text" | "contentType" | "media">,
) {
  const text = stripToolCallSyntax(moment.text);
  if (text) {
    return text;
  }

  return describeMomentMediaContent(moment.contentType, moment.media);
}
