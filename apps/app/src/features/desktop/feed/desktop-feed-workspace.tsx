import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFeedPost,
  type FeedComment,
  type FeedPostListItem,
} from "@yinjie/contracts";
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
  imageDrafts: MomentImageDraft[];
  isLoading: boolean;
  likeErrorMessage?: string | null;
  likePendingPostId: string | null;
  ownerAvatar?: string | null;
  ownerUsername?: string | null;
  posts: FeedPostListItem[];
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
  onImageFilesSelected: (files: FileList | null) => void;
  onLike: (postId: string) => void;
  onRemoveImage: (id: string) => void;
  onRemoveVideo: () => void;
  onRefresh: () => void;
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
  imageDrafts,
  isLoading,
  likeErrorMessage,
  likePendingPostId,
  ownerAvatar,
  ownerUsername,
  posts,
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
  onLike,
  onRemoveImage,
  onRemoveVideo,
  onRefresh,
  onTextChange,
  onToggleFavorite,
  onVideoFileSelected,
}: DesktopFeedWorkspaceProps) {
  const [expandedPostId, setExpandedPostId] = useState<string | null>(
    routeSelectedPostId,
  );
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setExpandedPostId((current) =>
      current === routeSelectedPostId ? current : routeSelectedPostId,
    );
  }, [routeSelectedPostId]);

  const detailQuery = useQuery({
    queryKey: ["app-feed-post", baseUrl, expandedPostId],
    queryFn: async () => {
      if (!expandedPostId) {
        return null;
      }

      return (await getFeedPost(expandedPostId, baseUrl)) ?? null;
    },
    enabled: Boolean(expandedPostId),
  });

  useEffect(() => {
    if (!expandedPostId) {
      return;
    }

    if (!posts.some((post) => post.id === expandedPostId)) {
      setExpandedPostId(null);
    }
  }, [posts, expandedPostId]);

  useEffect(() => {
    onSelectedPostChange?.(expandedPostId);
  }, [onSelectedPostChange, expandedPostId]);

  useEffect(() => {
    if (!expandedPostId || typeof document === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`desktop-feed-post-${expandedPostId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedPostId]);

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
                expandedPostId={expandedPostId}
                isLoading={isLoading}
                likePendingPostId={likePendingPostId}
                posts={posts}
                isPostFavorite={isPostFavorite}
                onCancelCommentReply={onCancelCommentReply}
                onCollapse={() => setExpandedPostId(null)}
                onCommentChange={onCommentChange}
                onCommentSubmit={onCommentSubmit}
                onExpand={(postId) => setExpandedPostId(postId)}
                onLike={onLike}
                onOpenCompose={() => setShowCompose(true)}
                onStartCommentReply={onStartCommentReply}
                onToggleFavorite={onToggleFavorite}
              />
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
