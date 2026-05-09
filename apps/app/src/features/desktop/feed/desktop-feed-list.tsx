import { msg } from "@lingui/macro";
import {
  type FeedComment,
  type FeedPostListItem,
  type FeedPostWithComments,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, LoadingBlock } from "@yinjie/ui";
import { EmptyState } from "../../../components/empty-state";
import { DesktopFeedRow } from "./desktop-feed-row";
import { type FeedCommentReplyTarget } from "./feed-types";

type DesktopFeedListProps = {
  commentDrafts: Record<string, string>;
  commentPendingPostId: string | null;
  commentReplyTarget?: FeedCommentReplyTarget | null;
  detailErrorMessage?: string | null;
  detailLoading: boolean;
  detailPost?: FeedPostWithComments | null;
  expandedPostId: string | null;
  isLoading: boolean;
  likePendingPostId: string | null;
  posts: FeedPostListItem[];
  isPostFavorite: (postId: string) => boolean;
  onCancelCommentReply?: () => void;
  onCollapse: () => void;
  onCommentChange: (postId: string, value: string) => void;
  onCommentSubmit: (postId: string) => void;
  onExpand: (postId: string) => void;
  onLike: (postId: string) => void;
  onOpenCompose: () => void;
  /** 可选 — 触发"分享图卡"上抛 postId。 */
  onShare?: (postId: string) => void;
  onStartCommentReply?: (comment: FeedComment) => void;
  onToggleFavorite: (postId: string) => void;
};

export function DesktopFeedList({
  commentDrafts,
  commentPendingPostId,
  commentReplyTarget = null,
  detailErrorMessage = null,
  detailLoading,
  detailPost = null,
  expandedPostId,
  isLoading,
  likePendingPostId,
  posts,
  isPostFavorite,
  onCancelCommentReply,
  onCollapse,
  onCommentChange,
  onCommentSubmit,
  onExpand,
  onLike,
  onOpenCompose,
  onShare,
  onStartCommentReply,
  onToggleFavorite,
}: DesktopFeedListProps) {
  const t = useRuntimeTranslator();
  return (
    <>
      {isLoading ? (
        <LoadingBlock
          label={t(msg`正在读取广场动态...`)}
          className="rounded-[20px] border-[color:var(--border-faint)] bg-white py-10 shadow-[var(--shadow-section)]"
        />
      ) : null}

      {!isLoading && posts.length > 0 ? (
        <div className="space-y-4 pb-6">
          {posts.map((post) => {
            const expanded = post.id === expandedPostId;
            return (
              <DesktopFeedRow
                key={post.id}
                commentDraft={commentDrafts[post.id] ?? ""}
                commentLoading={commentPendingPostId === post.id}
                commentReplyTarget={
                  expanded ? commentReplyTarget : null
                }
                detailErrorMessage={expanded ? detailErrorMessage : null}
                detailLoading={expanded ? detailLoading : false}
                detailPost={
                  expanded && detailPost?.id === post.id ? detailPost : null
                }
                expanded={expanded}
                favorite={isPostFavorite(post.id)}
                likeLoading={likePendingPostId === post.id}
                post={post}
                onCancelCommentReply={onCancelCommentReply}
                onCollapse={onCollapse}
                onCommentChange={(value) => onCommentChange(post.id, value)}
                onCommentSubmit={() => onCommentSubmit(post.id)}
                onExpand={() => onExpand(post.id)}
                onLike={() => onLike(post.id)}
                onShare={onShare ? () => onShare(post.id) : undefined}
                onStartCommentReply={onStartCommentReply}
                onToggleFavorite={() => onToggleFavorite(post.id)}
              />
            );
          })}
        </div>
      ) : null}

      {!isLoading && !posts.length ? (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[560px] items-center justify-center py-10">
          <EmptyState
            title={t(msg`广场还没有新动态`)}
            description={t(msg`你先发一条居民公开可见的动态，或者等世界里的居民先开口。`)}
            action={
              <Button variant="primary" onClick={onOpenCompose}>
                {t(msg`发广场动态`)}
              </Button>
            }
          />
        </div>
      ) : null}
    </>
  );
}
