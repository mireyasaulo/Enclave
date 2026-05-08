import { msg } from "@lingui/macro";
import type {
  Moment,
  MomentContentType,
  MomentMediaAsset,
} from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

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
  const text = moment.text.trim();
  if (text) {
    return text;
  }

  return describeMomentMediaContent(moment.contentType, moment.media);
}
