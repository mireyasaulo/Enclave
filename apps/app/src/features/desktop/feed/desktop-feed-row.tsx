import { useMemo } from "react";
import { msg } from "@lingui/macro";
import {
  type FeedComment,
  type FeedPostListItem,
  type FeedPostWithComments,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, ErrorBlock, LoadingBlock, TextField, cn } from "@yinjie/ui";
import {
  Bot,
  Heart,
  MessageCircle,
  Share2,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { AvatarChip } from "../../../components/avatar-chip";
import { MomentMediaGallery } from "../../../components/moment-media-gallery";
import {
  getFeedSummaryText,
  resolveFeedMomentContentType,
} from "../../feed/feed-media";
import { formatTimestamp } from "../../../lib/format";
import { type FeedCommentReplyTarget } from "./feed-types";

type DesktopFeedRowProps = {
  commentDraft: string;
  commentLoading: boolean;
  commentReplyTarget?: FeedCommentReplyTarget | null;
  detailErrorMessage?: string | null;
  detailLoading?: boolean;
  detailPost?: FeedPostWithComments | null;
  expanded: boolean;
  favorite: boolean;
  likeLoading: boolean;
  post: FeedPostListItem;
  onCancelCommentReply?: () => void;
  onCollapse: () => void;
  onCommentChange: (value: string) => void;
  onCommentSubmit: () => void;
  onExpand: () => void;
  onLike: () => void;
  /** 可选 — 触发"分享图卡"。 */
  onShare?: () => void;
  onStartCommentReply?: (comment: FeedComment) => void;
  onToggleFavorite: () => void;
};

export function DesktopFeedRow({
  commentDraft,
  commentLoading,
  commentReplyTarget = null,
  detailErrorMessage = null,
  detailLoading = false,
  detailPost = null,
  expanded,
  favorite,
  likeLoading,
  post,
  onCancelCommentReply,
  onCollapse,
  onCommentChange,
  onCommentSubmit,
  onExpand,
  onLike,
  onShare,
  onStartCommentReply,
  onToggleFavorite,
}: DesktopFeedRowProps) {
  const t = useRuntimeTranslator();
  const hasText = Boolean(post.text.trim());
  const hasMedia = post.media.length > 0;
  const mediaSummaryText = hasText ? "" : getFeedSummaryText(post);
  const previewCount = post.commentsPreview.length;
  const hasMore = post.commentCount > previewCount;

  const commentThreads = useMemo(() => {
    if (!detailPost) {
      return [] as Array<{ root: FeedComment; replies: FeedComment[] }>;
    }
    const rootComments = detailPost.comments.filter(
      (comment) => !comment.parentCommentId,
    );
    return rootComments.map((root) => ({
      root,
      replies: detailPost.comments.filter(
        (comment) => comment.parentCommentId === root.id,
      ),
    }));
  }, [detailPost]);

  return (
    <article
      id={`desktop-feed-post-${post.id}`}
      className="rounded-[16px] border border-[color:var(--border-faint)] bg-white px-4 py-4 shadow-[var(--shadow-section)]"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-[18px]">
          <AvatarChip
            name={post.authorName}
            src={post.authorAvatar}
            size="wechat"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-[15px] font-semibold text-[color:var(--text-primary)]">
                {post.authorName}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium",
                  post.authorType === "character"
                    ? "border-[rgba(7,193,96,0.12)] bg-[rgba(7,193,96,0.06)] text-[color:var(--brand-primary)]"
                    : "border-[color:var(--border-faint)] bg-[color:var(--surface-console)] text-[color:var(--text-secondary)]",
                )}
              >
                {post.authorType === "character" ? (
                  <Bot size={11} />
                ) : (
                  <UserRound size={11} />
                )}
                {post.authorType === "character"
                  ? t(msg`居民`)
                  : t(msg`世界主人`)}
              </span>
              {post.aiReacted ? (
                <span className="rounded-md border border-[rgba(7,193,96,0.12)] bg-white px-2 py-1 text-[10px] font-medium text-[color:var(--text-primary)] shadow-[inset_0_-2px_0_0_var(--brand-primary)]">
                  {t(msg`AI 已回应`)}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--text-muted)]">
              <span>{formatTimestamp(post.createdAt)}</span>
              <span>{t(msg`居民公开可见`)}</span>
            </div>
          </div>

          {hasText ? (
            <div className="mt-3 text-[15px] leading-7 text-[color:var(--text-primary)]">
              {post.text}
            </div>
          ) : null}

          {hasMedia ? (
            <div className={hasText ? "mt-3" : "mt-4"}>
              <MomentMediaGallery
                contentType={resolveFeedMomentContentType(post.media)}
                media={post.media}
              />
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="text-[12px] text-[color:var(--text-muted)]">
              {post.likeCount > 0 || post.commentCount > 0
                ? t(msg`${post.likeCount} 赞 · ${post.commentCount} 评论`)
                : mediaSummaryText || t(msg`还没有互动`)}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={likeLoading}
                onClick={onLike}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--border-faint)] px-2.5 text-[12px] text-[color:var(--text-secondary)] transition-[background-color,color,border-color] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)] disabled:opacity-55"
              >
                <Heart size={14} />
                {likeLoading ? t(msg`处理中...`) : t(msg`点赞`)}
              </button>
              <button
                type="button"
                onClick={onToggleFavorite}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] transition-[background-color,color,border-color]",
                  favorite
                    ? "border-[#ead9a6] bg-[#fbf7e8] text-amber-700"
                    : "border-[color:var(--border-faint)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]",
                )}
              >
                <Star size={14} className={favorite ? "fill-current" : ""} />
                {favorite ? t(msg`已收藏`) : t(msg`收藏`)}
              </button>
              {onShare ? (
                <button
                  type="button"
                  onClick={onShare}
                  aria-label={t(msg`生成分享图卡`)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--border-faint)] px-2.5 text-[12px] text-[color:var(--text-secondary)] transition-[background-color,color,border-color] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]"
                >
                  <Share2 size={14} />
                  {t(msg`分享图卡`)}
                </button>
              ) : null}
            </div>
          </div>

          {!expanded && previewCount > 0 ? (
            <div className="mt-3 rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-4 py-3">
              <div className="space-y-2 text-[13px] leading-6 text-[color:var(--text-secondary)]">
                {post.commentsPreview.map((comment) => (
                  <div key={comment.id}>
                    <span className="font-medium text-[color:var(--text-primary)]">
                      {comment.authorName}
                    </span>
                    <span className="text-[color:var(--text-dim)]">
                      {t(msg`：`)}
                    </span>
                    <span>{comment.text}</span>
                  </div>
                ))}
              </div>
              {hasMore ? (
                <button
                  type="button"
                  onClick={onExpand}
                  className="mt-3 text-[12px] font-medium text-[color:var(--brand-primary)]"
                >
                  {t(msg`查看全部 ${post.commentCount} 条评论`)}
                </button>
              ) : null}
            </div>
          ) : null}

          {!expanded && previewCount === 0 && hasMore ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={onExpand}
                className="text-[12px] font-medium text-[color:var(--brand-primary)]"
              >
                {t(msg`查看全部 ${post.commentCount} 条评论`)}
              </button>
            </div>
          ) : null}

          {expanded ? (
            <div className="mt-3 rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--text-primary)]">
                  <MessageCircle size={13} />
                  {t(msg`评论区`)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[color:var(--text-muted)]">
                    {t(msg`${post.commentCount} 条`)}
                  </span>
                  <button
                    type="button"
                    onClick={onCollapse}
                    aria-label={t(msg`收起评论`)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--border-faint)] bg-white text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-console)]"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {detailLoading ? (
                <div className="mt-3">
                  <LoadingBlock label={t(msg`正在读取完整评论...`)} />
                </div>
              ) : null}

              {detailErrorMessage ? (
                <div className="mt-3">
                  <ErrorBlock message={detailErrorMessage} />
                </div>
              ) : null}

              {!detailLoading && detailPost ? (
                commentThreads.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {commentThreads.map(({ root, replies }) => (
                      <div
                        key={root.id}
                        className="rounded-[12px] border border-[color:var(--border-faint)] bg-white px-3.5 py-3"
                      >
                        <CommentRow
                          comment={root}
                          replyToName={null}
                          canReply={Boolean(onStartCommentReply)}
                          active={commentReplyTarget?.commentId === root.id}
                          onStartReply={
                            onStartCommentReply
                              ? () => onStartCommentReply(root)
                              : undefined
                          }
                        />
                        {replies.length > 0 ? (
                          <div className="mt-3 space-y-2 border-l border-[color:var(--border-faint)] pl-3">
                            {replies.map((reply) => {
                              const replyToName =
                                reply.replyToCommentId &&
                                reply.replyToCommentId !== root.id
                                  ? (replies.find(
                                      (item) =>
                                        item.id === reply.replyToCommentId,
                                    )?.authorName ?? null)
                                  : null;
                              return (
                                <CommentRow
                                  key={reply.id}
                                  comment={reply}
                                  replyToName={replyToName}
                                  canReply={Boolean(onStartCommentReply)}
                                  active={
                                    commentReplyTarget?.commentId === reply.id
                                  }
                                  onStartReply={
                                    onStartCommentReply
                                      ? () => onStartCommentReply(reply)
                                      : undefined
                                  }
                                />
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[12px] border border-dashed border-[color:var(--border-faint)] bg-white px-3.5 py-3 text-[12px] text-[color:var(--text-muted)]">
                    {t(msg`暂时还没有评论，你可以先说一句。`)}
                  </div>
                )
              ) : null}

              {commentReplyTarget ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-[12px] border border-[rgba(7,193,96,0.18)] bg-[rgba(7,193,96,0.06)] px-3 py-2 text-[12px] text-[color:var(--text-secondary)]">
                  <div className="truncate">
                    {t(msg`正在回复 ${commentReplyTarget.authorName}`)}
                  </div>
                  {onCancelCommentReply ? (
                    <button
                      type="button"
                      onClick={onCancelCommentReply}
                      aria-label={t(msg`取消回复`)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] hover:bg-white"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2 border-t border-[color:var(--border-faint)] pt-3">
                <TextField
                  value={commentDraft}
                  onChange={(event) => onCommentChange(event.target.value)}
                  placeholder={
                    commentReplyTarget
                      ? t(msg`回复 ${commentReplyTarget.authorName}...`)
                      : t(msg`写评论...`)
                  }
                  className="min-w-0 flex-1 rounded-xl border-[color:var(--border-faint)] bg-white px-4 py-2 text-[13px] shadow-none hover:bg-white focus:border-[rgba(7,193,96,0.18)] focus:shadow-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!commentDraft.trim() || commentLoading}
                  onClick={onCommentSubmit}
                  className="bg-[color:var(--brand-primary)] text-white shadow-none hover:opacity-95"
                >
                  {commentLoading ? t(msg`发送中...`) : t(msg`发送`)}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <TextField
                value={commentDraft}
                onChange={(event) => onCommentChange(event.target.value)}
                placeholder={t(msg`写评论...`)}
                className="min-w-0 flex-1 rounded-xl border-[color:var(--border-faint)] bg-white px-4 py-2 text-[13px] shadow-none hover:bg-white focus:border-[rgba(7,193,96,0.18)] focus:shadow-none"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!commentDraft.trim() || commentLoading}
                onClick={onCommentSubmit}
                className="bg-[color:var(--brand-primary)] text-white shadow-none hover:opacity-95"
              >
                {commentLoading ? t(msg`发送中...`) : t(msg`发送`)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CommentRow({
  active,
  canReply,
  comment,
  onStartReply,
  replyToName,
}: {
  active: boolean;
  canReply: boolean;
  comment: FeedComment;
  onStartReply?: () => void;
  replyToName: string | null;
}) {
  const t = useRuntimeTranslator();
  return (
    <div
      className={cn(
        "rounded-[10px]",
        active ? "bg-[rgba(7,193,96,0.06)] px-2 py-1.5" : null,
      )}
    >
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-medium text-[#07c160]">
          {comment.authorName}
        </span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium",
            comment.authorType === "character"
              ? "border-[rgba(7,193,96,0.12)] bg-[rgba(7,193,96,0.06)] text-[color:var(--brand-primary)]"
              : "border-[color:var(--border-faint)] bg-white text-[color:var(--text-secondary)]",
          )}
        >
          {comment.authorType === "character"
            ? t(msg`居民`)
            : t(msg`世界主人`)}
        </span>
        <span className="text-[color:var(--text-dim)]">
          {formatTimestamp(comment.createdAt)}
        </span>
      </div>
      <div className="mt-1.5 text-[13px] leading-6 text-[color:var(--text-secondary)]">
        {replyToName ? (
          <>
            <span className="text-[color:var(--text-secondary)]">
              {t(msg`回复 `)}
            </span>
            <span className="font-medium text-[#07c160]">{replyToName}</span>
            <span className="text-[color:var(--text-secondary)]">
              {t(msg`：`)}
            </span>
          </>
        ) : null}
        <span className="text-[color:var(--text-primary)]">{comment.text}</span>
      </div>
      {canReply ? (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={onStartReply}
            className="rounded-full border border-[color:var(--border-faint)] bg-white px-2.5 py-0.5 text-[11px] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-console)]"
          >
            {t(msg`回复`)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
