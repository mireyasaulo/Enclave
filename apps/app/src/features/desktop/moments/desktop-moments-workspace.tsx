import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import {
  type Moment,
  type MomentComment,
  type MomentLike,
} from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { MomentShareCardModal } from "../../../components/moment-share-card-modal";
import { DesktopMomentComposePanel } from "./desktop-moment-compose-panel";
import { DesktopMomentsFeed } from "./desktop-moments-feed";
import { type MomentCommentReplyTarget } from "./desktop-moment-row";
import {
  type MomentImageDraft,
  type MomentVideoDraft,
} from "../../moments/moment-compose-media";
import { DesktopMomentsToolbar } from "./desktop-moments-toolbar";

const t = translateRuntimeMessage;

type DesktopMomentsWorkspaceProps = {
  commentDrafts: Record<string, string>;
  commentErrorMessage?: string | null;
  commentPendingMomentId: string | null;
  commentReplyTarget?: MomentCommentReplyTarget | null;
  composeErrorMessage?: string | null;
  createPending: boolean;
  deletePendingMomentId?: string | null;
  deleteErrorMessage?: string | null;
  errors?: string[];
  imageDrafts: MomentImageDraft[];
  isLoading: boolean;
  likeErrorMessage?: string | null;
  likePendingMomentId: string | null;
  moments: Moment[];
  ownerAvatar?: string | null;
  ownerId?: string | null;
  ownerUsername?: string | null;
  scrollToMomentId?: string | null;
  showCompose: boolean;
  successNotice?: string;
  text: string;
  videoDraft: MomentVideoDraft | null;
  isMomentFavorite: (momentId: string) => boolean;
  setShowCompose: (nextValue: boolean) => void;
  onCancelCommentReply?: () => void;
  onCommentChange: (momentId: string, value: string) => void;
  onCommentSubmit: (momentId: string) => void;
  onCreate: () => void;
  onDeleteMoment?: (momentId: string) => void;
  onImageFilesSelected: (files: FileList | null) => void;
  onLike: (momentId: string) => void;
  onOpenAuthorPopover?: (input: {
    anchorElement: HTMLButtonElement;
    moment: Moment;
  }) => void;
  onOpenLikerPopover?: (input: {
    anchorElement: HTMLButtonElement;
    moment: Moment;
    like: MomentLike;
  }) => void;
  onRemoveImage: (id: string) => void;
  onRemoveVideo: () => void;
  onStartCommentReply?: (input: {
    momentId: string;
    comment: MomentComment;
  }) => void;
  onToggleFavorite: (momentId: string) => void;
  onRefresh: () => void;
  onTextChange: (value: string) => void;
  onVideoFileSelected: (file: File | null) => void;
};

export function DesktopMomentsWorkspace({
  commentDrafts,
  commentErrorMessage,
  commentPendingMomentId,
  commentReplyTarget = null,
  composeErrorMessage,
  createPending,
  deletePendingMomentId = null,
  deleteErrorMessage,
  errors = [],
  imageDrafts,
  isLoading,
  likeErrorMessage,
  likePendingMomentId,
  moments,
  ownerAvatar,
  ownerId,
  ownerUsername,
  scrollToMomentId = null,
  showCompose,
  successNotice,
  text,
  videoDraft,
  isMomentFavorite,
  setShowCompose,
  onCancelCommentReply,
  onCommentChange,
  onCommentSubmit,
  onCreate,
  onDeleteMoment,
  onImageFilesSelected,
  onLike,
  onOpenAuthorPopover,
  onOpenLikerPopover,
  onRemoveImage,
  onRemoveVideo,
  onStartCommentReply,
  onToggleFavorite,
  onRefresh,
  onTextChange,
  onVideoFileSelected,
}: DesktopMomentsWorkspaceProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // 「分享图卡」目标 — 只存 id，moments 后续刷新时预览图也跟着新。
  const [shareMomentId, setShareMomentId] = useState<string | null>(null);
  const shareMoment = shareMomentId
    ? moments.find((moment) => moment.id === shareMomentId) ?? null
    : null;
  const shareLiked = Boolean(
    ownerId && shareMoment?.likes.some((like) => like.authorId === ownerId),
  );
  const shareOwnerName = ownerUsername?.trim() || t(msg`世界主人`);

  // 每个 scrollToMomentId 只滚一次：之前依赖 [moments, scrollToMomentId]，
  // 用户每点一次赞/发一条评论 → optimistic 让 moments 数组换新 → effect 重跑
  // smooth-scroll 把用户拉回到该 moment，体感像"被吸住"。改成 ref 记录已滚过
  // 的 id，moments 后续变更不再触发滚动；用户切换到另一个 momentId（hash 变）
  // 时再滚一次。
  const lastScrolledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scrollToMomentId || typeof document === "undefined") {
      return;
    }
    if (lastScrolledIdRef.current === scrollToMomentId) {
      return;
    }
    if (!moments.some((moment) => moment.id === scrollToMomentId)) {
      // 目标还没出现在已加载分页里，等 moments 更新再尝试。
      return;
    }
    lastScrolledIdRef.current = scrollToMomentId;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`desktop-moment-post-${scrollToMomentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [moments, scrollToMomentId]);
  useEffect(() => {
    if (!scrollToMomentId) {
      lastScrolledIdRef.current = null;
    }
  }, [scrollToMomentId]);

  return (
    <div className="relative flex h-full min-h-0 bg-[rgba(244,247,246,0.98)]">
      <section className="min-w-0 flex-1 bg-[rgba(245,248,247,0.96)]">
        <div className="flex h-full min-h-0 flex-col">
          <DesktopMomentsToolbar
            commentErrorMessage={commentErrorMessage}
            deleteErrorMessage={deleteErrorMessage}
            errors={errors}
            likeErrorMessage={likeErrorMessage}
            successNotice={successNotice}
            totalCount={moments.length}
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
              <DesktopMomentsFeed
                commentDrafts={commentDrafts}
                commentPendingMomentId={commentPendingMomentId}
                commentReplyTarget={commentReplyTarget}
                deletePendingMomentId={deletePendingMomentId}
                isLoading={isLoading}
                likePendingMomentId={likePendingMomentId}
                moments={moments}
                ownerId={ownerId}
                isMomentFavorite={isMomentFavorite}
                onCancelCommentReply={onCancelCommentReply}
                onCommentChange={onCommentChange}
                onCommentSubmit={onCommentSubmit}
                onDeleteMoment={onDeleteMoment}
                onLike={onLike}
                onShare={(momentId) => setShareMomentId(momentId)}
                onStartCommentReply={
                  onStartCommentReply
                    ? (comment) =>
                        onStartCommentReply({
                          momentId: comment.postId,
                          comment,
                        })
                    : undefined
                }
                onToggleFavorite={onToggleFavorite}
                onOpenCompose={() => setShowCompose(true)}
                onSelectAuthor={onOpenAuthorPopover}
                onSelectLiker={onOpenLikerPopover}
              />
            </div>
          </div>
        </div>
      </section>

      {showCompose ? (
        <DesktopMomentComposePanel
          createPending={createPending}
          canAddImages={imageDrafts.length < 9 && !videoDraft}
          canAddVideo={!imageDrafts.length}
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

      <MomentShareCardModal
        moment={shareMoment}
        liked={shareLiked}
        ownerId={ownerId ?? null}
        ownerDisplayName={shareOwnerName}
        onClose={() => setShareMomentId(null)}
      />
    </div>
  );
}
