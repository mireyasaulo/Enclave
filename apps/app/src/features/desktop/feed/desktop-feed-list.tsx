import { type MouseEvent as ReactMouseEvent } from "react";
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
  /** Round 4：并发评论时单个 string|null 不够 — 改 Set 让每条 row 各查自己。 */
  commentPendingPostIds: ReadonlySet<string>;
  commentReplyTarget?: FeedCommentReplyTarget | null;
  detailErrorMessage?: string | null;
  detailLoading: boolean;
  detailPost?: FeedPostWithComments | null;
  selectedPostId: string | null;
  isLoading: boolean;
  /** 后端已返回但全部被屏蔽过滤吃掉时，区分「真空」vs「全被屏蔽 + 还在自动翻页」
   *  用：true = 至少有一页 raw 数据回来过但 visiblePosts 仍是空。 */
  hasFilteredOutPosts?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  /** feedQuery 首屏失败时的错误信息；空 = 没失败。posts.length===0 时优先
   *  渲染「广场动态暂时不可用 + 重试读取」而不是误导性的「发广场动态」CTA。 */
  feedErrorMessage?: string | null;
  onRetryFeed?: () => void;
  /** Round 5：跨 row 并发追踪，Set 让每条 row 各查 .has(post.id)。 */
  likePendingPostIds: ReadonlySet<string>;
  posts: FeedPostListItem[];
  isPostFavorite: (postId: string) => boolean;
  onCancelCommentReply?: () => void;
  // 这一组 callback 全部按 (postId, ...) 维度往下传 — 不再在 map 里包一层
  // `() => onLike(post.id)` 闭包；row 内部用 useCallback 绑 post.id。
  // 这样配 row 的 React.memo 才能起效：commentDrafts 变只让那条 row 重渲。
  onCommentChange: (postId: string, value: string) => void;
  // text 入参：row 把 commentDraft 顺手传上来，page 不用闭包到 commentDrafts。
  onCommentSubmit: (postId: string, text: string) => void;
  onLoadFullComments: (postId: string) => void;
  onLike: (postId: string) => void;
  onOpenCompose: () => void;
  /** 可选 — 触发"分享图卡"上抛 postId。 */
  onShare?: (postId: string) => void;
  onStartCommentReply?: (comment: FeedComment) => void;
  onSelectCommentAuthor?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    comment: FeedComment,
  ) => void;
  onSelectPostAuthor?: (input: {
    anchorElement: HTMLButtonElement;
    post: FeedPostListItem;
  }) => void;
  onToggleFavorite: (postId: string) => void;
};

export function DesktopFeedList({
  commentDrafts,
  commentPendingPostIds,
  commentReplyTarget = null,
  detailErrorMessage = null,
  detailLoading,
  detailPost = null,
  selectedPostId,
  isLoading,
  hasFilteredOutPosts = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  feedErrorMessage = null,
  onRetryFeed,
  likePendingPostIds,
  posts,
  isPostFavorite,
  onCancelCommentReply,
  onCommentChange,
  onCommentSubmit,
  onLoadFullComments,
  onLike,
  onOpenCompose,
  onShare,
  onStartCommentReply,
  onSelectCommentAuthor,
  onSelectPostAuthor,
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
            const isDetailLoaded = post.id === selectedPostId;
            return (
              <DesktopFeedRow
                key={post.id}
                commentDraft={commentDrafts[post.id] ?? ""}
                commentLoading={commentPendingPostIds.has(post.id)}
                commentReplyTarget={
                  commentReplyTarget?.postId === post.id
                    ? commentReplyTarget
                    : null
                }
                detailErrorMessage={
                  isDetailLoaded ? detailErrorMessage : null
                }
                detailLoading={isDetailLoaded ? detailLoading : false}
                detailPost={
                  isDetailLoaded && detailPost?.id === post.id
                    ? detailPost
                    : null
                }
                favorite={isPostFavorite(post.id)}
                likeLoading={likePendingPostIds.has(post.id)}
                post={post}
                onCancelCommentReply={onCancelCommentReply}
                onCommentChange={onCommentChange}
                onCommentSubmit={onCommentSubmit}
                onLoadFullComments={onLoadFullComments}
                onLike={onLike}
                onShare={onShare}
                onStartCommentReply={onStartCommentReply}
                onSelectCommentAuthor={onSelectCommentAuthor}
                onSelectPostAuthor={onSelectPostAuthor}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })}
        </div>
      ) : null}

      {!isLoading && !posts.length ? (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[560px] items-center justify-center py-10">
          {feedErrorMessage ? (
            // 新 Round 2：feedQuery 首屏失败且没有任何缓存 post 时，旧版仍渲
            // 「广场还没有新动态 / 发广场动态」CTA，把"服务端读取失败"包装成
            // "广场是空的，你去发一条"，用户被引导去发动态填补"空 feed"——
            // 但其实再发也填不进来。这里跟移动端 MobileFeedStatusCard
            // tone=danger 对齐，把「重试读取」按钮直接放在空态中央。
            <EmptyState
              title={t(msg`广场动态暂时不可用`)}
              description={feedErrorMessage}
              action={
                onRetryFeed ? (
                  <Button variant="primary" onClick={onRetryFeed}>
                    {t(msg`重试读取`)}
                  </Button>
                ) : undefined
              }
            />
          ) : hasFilteredOutPosts && (isFetchingNextPage || hasNextPage) ? (
            <EmptyState
              title={t(msg`正在寻找未屏蔽的动态`)}
              description={t(
                msg`当前页的动态作者都在你的屏蔽名单里，正在自动翻下一页找未屏蔽的居民动态。`,
              )}
            />
          ) : hasFilteredOutPosts ? (
            <EmptyState
              title={t(msg`广场动态都被你屏蔽了`)}
              description={t(
                msg`当前所有动态作者都在你的屏蔽名单里。去通讯录里解除屏蔽，或者等其他居民发布新动态。`,
              )}
              action={
                <Button variant="primary" onClick={onOpenCompose}>
                  {t(msg`发广场动态`)}
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={t(msg`广场还没有新动态`)}
              description={t(msg`你先发一条居民公开可见的动态，或者等世界里的居民先开口。`)}
              action={
                <Button variant="primary" onClick={onOpenCompose}>
                  {t(msg`发广场动态`)}
                </Button>
              }
            />
          )}
        </div>
      ) : null}
    </>
  );
}
