import { msg } from "@lingui/macro";
import type { FeedChannelHomeSection } from "@yinjie/contracts";
import type { useRuntimeTranslator } from "@yinjie/i18n";

// 视频号每张 slide 左上角的胶囊标签——按当前 section 显示，对齐移动端 / 桌面端两套 UI。
export function getChannelsSectionBadge(
  section: FeedChannelHomeSection,
  t: ReturnType<typeof useRuntimeTranslator>,
) {
  switch (section) {
    case "friends":
      return t(msg`朋友视频号`);
    case "following":
      return t(msg`关注视频号`);
    case "live":
      return t(msg`视频号直播`);
    case "recommended":
    default:
      return t(msg`视频号推荐`);
  }
}
