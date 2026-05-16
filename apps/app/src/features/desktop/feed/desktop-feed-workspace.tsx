import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { msg } from "@lingui/macro";
import {
  getFeedPost,
  type FeedComment,
  type FeedPostListItem,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { DesktopFeedComposePanel } from "./desktop-feed-compose-panel";
import { DesktopFeedList } from "./desktop-feed-list";
import { DesktopFeedToolbar } from "./desktop-feed-toolbar";
import { type FeedCommentReplyTarget } from "./feed-types";
import {
  type MomentImageDraft,
  type MomentVideoDraft,
} from "../../moments/moment-compose-media";

type DesktopFeedWorkspaceProps = {
  canAddImages: boolean;
  canAddVideo: boolean;
  baseUrl?: string;
  commentDrafts: Record<string, string>;
  commentErrorMessage?: string | null;
  commentPendingPostId: string | null;
  composeErrorMessage?: string | null;
  createPending: boolean;
  errors?: string[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  imageDrafts: MomentImageDraft[];
  isLoading: boolean;
  likeErrorMessage?: string | null;
  likePendingPostId: string | null;
  ownerAvatar?: string | null;
  ownerUsername?: string | null;
  posts: FeedPostListItem[];
  onRequestMore?: () => void;
  onSelectedPostChange?: (postId: string | null) => void;
  routeSelectedPostId?: string | null;
  showCompose: boolean;
  successNotice?: string;
  text: string;
  videoDraft: MomentVideoDraft | null;
  commentReplyTarget?: FeedCommentReplyTarget | null;
  isPostFavorite: (postId: string) => boolean;
  setShowCompose: (nextValue: boolean) => void;
  onCancelCommentReply?: () => void;
  onCommentChange: (postId: string, value: string) => void;
  onCommentSubmit: (postId: string) => void;
  onCreate: () => void;
  onStartCommentReply?: (comment: FeedComment) => void;
  onSelectCommentAuthor?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    comment: FeedComment,
  ) => void;
  onSelectPostAuthor?: (input: {
    anchorElement: HTMLButtonElement;
    post: FeedPostListItem;
  }) => void;
  onImageFilesSelected: (files: FileList | null) => void;
  onLike: (postId: string) => void;
  onRemoveImage: (id: string) => void;
  onRemoveVideo: () => void;
  onRefresh: () => void;
  /** 可选 — 点击行内「分享图卡」时上抛 postId，由 page 弹出 modal。 */
  onShare?: (postId: string) => void;
  onTextChange: (value: string) => void;
  onToggleFavorite: (postId: string) => void;
  onVideoFileSelected: (file: File | null) => void;
};

export function DesktopFeedWorkspace({
  canAddImages,
  canAddVideo,
  baseUrl,
  commentDrafts,
  commentErrorMessage,
  commentPendingPostId,
  composeErrorMessage,
  createPending,
  errors = [],
  hasNextPage = false,
  isFetchingNextPage = false,
  imageDrafts,
  isLoading,
  likeErrorMessage,
  likePendingPostId,
  ownerAvatar,
  ownerUsername,
  posts,
  onRequestMore,
  onSelectedPostChange,
  routeSelectedPostId = null,
  showCompose,
  successNotice,
  text,
  videoDraft,
  commentReplyTarget = null,
  isPostFavorite,
  setShowCompose,
  onCancelCommentReply,
  onCommentChange,
  onCommentSubmit,
  onCreate,
  onImageFilesSelected,
  onStartCommentReply,
  onSelectCommentAuthor,
  onSelectPostAuthor,
  onLike,
  onRemoveImage,
  onRemoveVideo,
  onRefresh,
  onShare,
  onTextChange,
  onToggleFavorite,
  onVideoFileSelected,
}: DesktopFeedWorkspaceProps) {
  const t = useRuntimeTranslator();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(
    routeSelectedPostId,
  );
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // 滚到接近底部时调用 onRequestMore（page 层 fetchNextFeedPage）。
  // root=scrollViewportRef 让观察器跟桌面滚动容器对齐而不是 window；rootMargin
  // 320px 提前触发避免触底空等。
  useEffect(() => {
    if (!onRequestMore) return;
    if (!hasNextPage || isFetchingNextPage) return;
    const sentinel = loadMoreSentinelRef.current;
    const root = scrollViewportRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onRequestMore();
        }
      },
      { root, rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onRequestMore]);

  useEffect(() => {
    setSelectedPostId((current) =>
      current === routeSelectedPostId ? current : routeSelectedPostId,
    );
  }, [routeSelectedPostId]);

  const detailQuery = useQuery({
    queryKey: ["app-feed-post", baseUrl, selectedPostId],
    queryFn: async () => {
      if (!selectedPostId) {
        return null;
      }

      return (await getFeedPost(selectedPostId, baseUrl)) ?? null;
    },
    enabled: Boolean(selectedPostId),
  });

  useEffect(() => {
    if (!selectedPostId) {
      return;
    }

    // posts 还没拉到时（首屏 query 在路上）别清 selectedPostId——清了 parent
    // 的 desktopSelectedPostId 会被同步抹掉，URL 上的 #post=<id> hash 跟着没，
    // 滚动定位失败。posts 有内容后还找不到才说明那条真的不在列表里。
    if (posts.length === 0) {
      return;
    }

    if (!posts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(null);
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    onSelectedPostChange?.(selectedPostId);
  }, [onSelectedPostChange, selectedPostId]);

  // 已经为当前 selectedPostId 滚过一次后就不再重滚——避免 posts 增量加载时
  // (infinite-scroll 又拼了一页) 还活在同一个 selectedPostId 上又被弹回顶部。
  const scrolledForPostIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPostId || typeof document === "undefined") {
      return;
    }
    if (scrolledForPostIdRef.current === selectedPostId) {
      return;
    }
    // posts 刚拉到第 1 帧时元素可能还没渲染，依赖 posts 让这个 effect 跟着
    // 列表增量重新触发，直到该 id 的节点真出现在 DOM 里再 scrollIntoView。
    const target = document.getElementById(
      `desktop-feed-post-${selectedPostId}`,
    );
    if (!target) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    scrolledForPostIdRef.current = selectedPostId;
    return () => window.cancelAnimationFrame(frame);
  }, [selectedPostId, posts]);

  useEffect(() => {
    // selectedPostId 一变就放开锁，下次进来同一个 id 也能再触发一次滚动
    // （比如先选 A 再切 B 再回 A）。
    if (scrolledForPostIdRef.current !== selectedPostId) {
      scrolledForPostIdRef.current = null;
    }
  }, [selectedPostId]);

  return (
    <div className="relative flex h-full min-h-0 bg-[rgba(244,247,246,0.98)]">
      <section className="min-w-0 flex-1 bg-[rgba(245,248,247,0.96)]">
        <div className="flex h-full min-h-0 flex-col">
          <DesktopFeedToolbar
            commentErrorMessage={commentErrorMessage}
            errors={errors}
            likeErrorMessage={likeErrorMessage}
            successNotice={successNotice}
            totalCount={posts.length}
            onBackToTop={() => {
              scrollViewportRef.current?.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            onOpenCompose={() => setShowCompose(true)}
            onRefresh={onRefresh}
          />

          <div
            ref={scrollViewportRef}
            className="min-h-0 flex-1 overflow-auto px-7 py-6"
          >
            <div className="mx-auto w-full max-w-[760px]">
              <DesktopFeedList
                commentDrafts={commentDrafts}
                commentPendingPostId={commentPendingPostId}
                commentReplyTarget={commentReplyTarget}
                detailErrorMessage={
                  detailQuery.isError && detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : null
                }
                detailLoading={detailQuery.isLoading}
                detailPost={detailQuery.data ?? null}
                selectedPostId={selectedPostId}
                isLoading={isLoading}
                likePendingPostId={likePendingPostId}
                posts={posts}
                isPostFavorite={isPostFavorite}
                onCancelCommentReply={onCancelCommentReply}
                onCommentChange={onCommentChange}
                onCommentSubmit={onCommentSubmit}
                onLoadFullComments={(postId) => setSelectedPostId(postId)}
                onLike={onLike}
                onOpenCompose={() => setShowCompose(true)}
                onShare={onShare}
                onStartCommentReply={onStartCommentReply}
                onSelectCommentAuthor={onSelectCommentAuthor}
                onSelectPostAuthor={onSelectPostAuthor}
                onToggleFavorite={onToggleFavorite}
              />
              {posts.length > 0 ? (
                <>
                  <div
                    ref={loadMoreSentinelRef}
                    className="h-1 w-full"
                    aria-hidden="true"
                  />
                  {isFetchingNextPage ? (
                    <div className="py-4 text-center text-[12px] text-[color:var(--text-muted)]">
                      {t(msg`正在加载更多…`)}
                    </div>
                  ) : !hasNextPage ? (
                    <div className="py-4 text-center text-[12px] text-[color:var(--text-muted)]">
                      {t(msg`已经到底了`)}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {showCompose ? (
        <DesktopFeedComposePanel
          canAddImages={canAddImages}
          canAddVideo={canAddVideo}
          createPending={createPending}
          errorMessage={composeErrorMessage}
          imageDrafts={imageDrafts}
          ownerAvatar={ownerAvatar}
          ownerUsername={ownerUsername}
          text={text}
          videoDraft={videoDraft}
          onClose={() => setShowCompose(false)}
          onCreate={onCreate}
          onImageFilesSelected={onImageFilesSelected}
          onRemoveImage={onRemoveImage}
          onRemoveVideo={onRemoveVideo}
          onTextChange={onTextChange}
          onVideoFileSelected={onVideoFileSelected}
        />
      ) : null}
    </div>
  );
}
