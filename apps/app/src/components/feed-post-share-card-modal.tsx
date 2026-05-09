import { msg } from "@lingui/macro";
import type { FeedPost } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { AvatarChip } from "./avatar-chip";
import { MomentMediaGallery } from "./moment-media-gallery";
import { ShareCardModal } from "./share-card-modal";

const t = translateRuntimeMessage;

type Props = {
  post: FeedPost | null;
  /** 当前世界主人显示名 — 水印里"X 分享自隐界广场"用 */
  ownerDisplayName: string;
  onClose: () => void;
};

/**
 * 广场动态分享图卡 — 离屏渲染一个 self-contained 卡片（头像/作者/标题/正文/
 * 标签/媒体），外加底部水印。FeedPost 没有 likes/comments 数组（不像 Moment），
 * 所以走自定义布局而不是复用 WeChatMomentCard。
 *
 * 颜色和字号都是内联，不依赖 tailwind 主题变量 — html-to-image 走 computedStyles
 * 但 CSS 变量在离屏 portal 里有时拿不到正确值，内联最稳。
 */
export function FeedPostShareCardModal({
  post,
  ownerDisplayName,
  onClose,
}: Props) {
  return (
    <ShareCardModal
      cardKey={post?.id ?? null}
      modalTitle={t(msg`分享这条动态`)}
      watermarkSubtitle={t(msg`${ownerDisplayName} 分享自隐界广场`)}
      bottomHint={t(
        msg`保存图片到相册，发到 X / 小红书 / 微博 引发更多人来看`,
      )}
      filenamePrefix="enclave-feed"
      onClose={onClose}
    >
      {post ? <FeedPostExportCard post={post} /> : null}
    </ShareCardModal>
  );
}

/**
 * 仅供"分享图卡"导出使用的展示卡，所有样式内联。
 * 不接受互动 props — 纯静态展示。
 */
function FeedPostExportCard({ post }: { post: FeedPost }) {
  const trimmedText = post.text.trim();
  const trimmedTitle = post.title?.trim() ?? "";
  const tags = (post.topicTags ?? []).filter((tag) => tag.trim());
  const isUserAuthor = post.authorType === "user";

  return (
    <div style={{ padding: "20px 20px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AvatarChip name={post.authorName} src={post.authorAvatar} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#1A1A1A",
              lineHeight: 1.3,
            }}
          >
            {post.authorName}
          </div>
          <div style={{ fontSize: 12, color: "#9A9A9A", marginTop: 2 }}>
            {isUserAuthor ? t(msg`世界主人`) : t(msg`居民动态`)}
          </div>
        </div>
      </div>

      {trimmedTitle ? (
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#1A1A1A",
            lineHeight: 1.4,
            marginTop: 14,
          }}
        >
          {trimmedTitle}
        </div>
      ) : null}

      {trimmedText ? (
        <div
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 15,
            lineHeight: 1.6,
            color: "#1A1A1A",
            marginTop: trimmedTitle ? 8 : 14,
          }}
        >
          {trimmedText}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                color: "#576B95",
                background: "rgba(87,107,149,0.08)",
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      {post.media.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <MomentMediaGallery
            contentType={resolveContentType(post)}
            media={post.media}
            variant="mobile"
          />
        </div>
      ) : null}

      {/* 互动数据 — 静态摘要，不显示按钮 */}
      {post.likeCount + post.commentCount + post.viewCount > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 12,
            color: "#9A9A9A",
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid #EDEDED",
          }}
        >
          {post.likeCount > 0 ? (
            <span>{t(msg`${post.likeCount} 赞`)}</span>
          ) : null}
          {post.commentCount > 0 ? (
            <span>{t(msg`${post.commentCount} 评论`)}</span>
          ) : null}
          {post.viewCount > 0 ? (
            <span>{t(msg`${post.viewCount} 次阅读`)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function resolveContentType(
  post: FeedPost,
): "text" | "image_album" | "video" {
  if (post.mediaType === "video") return "video";
  if (post.mediaType === "image") return "image_album";
  // mediaType=text 但有 media 时按媒体推断（生产数据偶有不一致）
  if (post.media.some((asset) => asset.kind === "video")) return "video";
  if (post.media.some((asset) => asset.kind === "image")) return "image_album";
  return "text";
}
