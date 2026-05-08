import { useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { msg } from "@lingui/macro";
import { type Moment, type MomentComment } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, cn } from "@yinjie/ui";
import {
  Bot,
  Heart,
  MapPin,
  MessageCircle,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { AvatarChip } from "../../../components/avatar-chip";
import { MomentCommentComposer } from "../../../components/moment-comment-composer";
import { MomentMediaGallery } from "../../../components/moment-media-gallery";
import { formatTimestamp } from "../../../lib/format";

export type MomentCommentReplyTarget = {
  authorId: string;
  authorName: string;
  commentId: string;
  postId: string;
};

type DesktopMomentRowProps = {
  authorActionAriaLabel?: string;
  authorActionLabel?: string;
  commentDraft: string;
  commentLoading: boolean;
  commentReplyTarget?: MomentCommentReplyTarget | null;
  likeLoading: boolean;
  moment: Moment;
  ownerId?: string | null;
  favorite: boolean;
  onCancelCommentReply?: () => void;
  onCommentChange: (value: string) => void;
  onCommentSubmit: () => void;
  onLike: () => void;
  onStartCommentReply?: (comment: MomentComment) => void;
  onToggleFavorite: () => void;
  onAuthorAction?: () => void;
  onSelectAuthor?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function DesktopMomentRow({
  authorActionAriaLabel,
  authorActionLabel,
  commentDraft,
  commentLoading,
  commentReplyTarget = null,
  likeLoading,
  moment,
  ownerId,
  favorite,
  onCancelCommentReply,
  onCommentChange,
  onCommentSubmit,
  onLike,
  onStartCommentReply,
  onToggleFavorite,
  onAuthorAction,
  onSelectAuthor,
}: DesktopMomentRowProps) {
  const t = useRuntimeTranslator();
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const focusComposer = () => {
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };
  const likedByOwner = Boolean(
    ownerId && moment.likes.some((like) => like.authorId === ownerId),
  );
  const hasText = Boolean(moment.text.trim());
  const canSelectAuthor = Boolean(onSelectAuthor);
  const canReply = Boolean(onStartCommentReply);
  const activeReply =
    commentReplyTarget && commentReplyTarget.postId === moment.id
      ? commentReplyTarget
      : null;
  const activeActionClassName =
    "border-[rgba(7,193,96,0.12)] bg-white text-[color:var(--text-primary)] shadow-[inset_0_-2px_0_0_var(--brand-primary)]";

  const commentsById = useMemo(
    () =>
      new Map(moment.comments.map((comment) => [comment.id, comment] as const)),
    [moment.comments],
  );
  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const comment of moment.comments) {
      if (comment.authorId && comment.authorName) {
        map.set(comment.authorId, comment.authorName);
      }
    }
    return map;
  }, [moment.comments]);

  function lookupReplyToName(comment: MomentComment) {
    if (!comment.replyToAuthorId) {
      return null;
    }
    if (comment.replyToCommentId) {
      const target = commentsById.get(comment.replyToCommentId);
      if (target?.authorName) {
        return target.authorName;
      }
    }
    return authorNameById.get(comment.replyToAuthorId) ?? null;
  }

  return (
    <article
      id={`desktop-moment-post-${moment.id}`}
      className="rounded-[16px] border border-[color:var(--border-faint)] bg-white px-4 py-4 shadow-[var(--shadow-section)]"
    >
      <div className="flex items-start gap-3">
        {canSelectAuthor ? (
          <button
            type="button"
            onClick={(event) => onSelectAuthor?.(event)}
            className="shrink-0 rounded-[18px]"
            aria-label={
              authorActionAriaLabel ??
              t(msg`查看 ${moment.authorName} 的朋友圈`)
            }
          >
            <AvatarChip
              name={moment.authorName}
              src={moment.authorAvatar}
              size="wechat"
            />
          </button>
        ) : (
          <AvatarChip
            name={moment.authorName}
            src={moment.authorAvatar}
            size="wechat"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {canSelectAuthor ? (
                <button
                  type="button"
                  onClick={(event) => onSelectAuthor?.(event)}
                  className="truncate text-left text-[15px] font-semibold text-[color:var(--text-primary)]"
                >
                  {moment.authorName}
                </button>
              ) : (
                <div className="truncate text-[15px] font-semibold text-[color:var(--text-primary)]">
                  {moment.authorName}
                </div>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium tracking-[0.12em]",
                  moment.authorType === "character"
                    ? "border-[rgba(7,193,96,0.12)] bg-[rgba(7,193,96,0.06)] text-[color:var(--brand-primary)]"
                    : "border-[color:var(--border-faint)] bg-[color:var(--surface-console)] text-[color:var(--text-secondary)]",
                )}
              >
                {moment.authorType === "character" ? (
                  <Bot size={11} />
                ) : (
                  <UserRound size={11} />
                )}
                {moment.authorType === "character" ? t(msg`角色`) : t(msg`我`)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--text-muted)]">
              <span>{formatTimestamp(moment.postedAt)}</span>
              {moment.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} />
                  {moment.location}
                </span>
              ) : null}
            </div>
          </div>

          {hasText ? (
            <div className="mt-3 text-[15px] leading-7 text-[color:var(--text-primary)]">
              {moment.text}
            </div>
          ) : null}

          {moment.media.length > 0 ? (
            <div className={hasText ? "mt-3" : "mt-4"}>
              <MomentMediaGallery
                contentType={moment.contentType}
                media={moment.media}
              />
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="text-[12px] text-[color:var(--text-muted)]">
              {moment.likeCount > 0 || moment.commentCount > 0
                ? t(msg`${moment.likeCount} 赞 · ${moment.commentCount} 评论`)
                : t(msg`还没有互动`)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={likeLoading || !moment.canInteract}
                title={
                  !moment.canInteract
                    ? t(msg`加为好友后才能互动`)
                    : undefined
                }
                onClick={onLike}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-[background-color,border-color,color] disabled:opacity-55",
                  likedByOwner
                    ? activeActionClassName
                    : "border-[color:var(--border-faint)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]",
                )}
              >
                <Heart
                  size={14}
                  className={likedByOwner ? "fill-current" : ""}
                />
                {likeLoading
                  ? t(msg`处理中...`)
                  : likedByOwner
                    ? t(msg`已赞`)
                    : t(msg`赞`)}
              </button>
              <button
                type="button"
                onClick={onToggleFavorite}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-[background-color,border-color,color]",
                  favorite
                    ? "border-[#ead9a6] bg-[#fbf7e8] text-[#8a6b11]"
                    : "border-[color:var(--border-faint)] text-[color:var(--text-secondary)] hover:border-[#ead9a6] hover:bg-[#fffaf0] hover:text-[color:var(--text-primary)]",
                )}
              >
                <Star size={14} className={favorite ? "fill-current" : ""} />
                {favorite ? t(msg`已收藏`) : t(msg`收藏`)}
              </button>
              {onAuthorAction ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onAuthorAction}
                  className="border-[color:var(--border-faint)] bg-white text-[color:var(--text-secondary)] shadow-none hover:bg-[color:var(--surface-console)]"
                >
                  {authorActionLabel ?? t(msg`打开 TA 的朋友圈`)}
                </Button>
              ) : null}
            </div>
          </div>

          {moment.likes.length > 0 ? (
            <div className="mt-3 rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-6 text-[color:var(--text-secondary)]">
                <Heart
                  size={12}
                  className="text-[color:var(--brand-primary)]"
                />
                <span>
                  {moment.likes.map((like) => like.authorName).join("、")}
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--text-primary)]">
                <MessageCircle size={13} />
                {t(msg`评论`)}
              </div>
              <span className="text-[11px] text-[color:var(--text-muted)]">
                {t(msg`${moment.commentCount} 条`)}
              </span>
            </div>

            {moment.comments.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {moment.comments.map((comment) => {
                  const replyToName = lookupReplyToName(comment);
                  const isActiveReply =
                    activeReply?.commentId === comment.id;
                  if (!canReply) {
                    return (
                      <div
                        key={comment.id}
                        className="rounded-[10px] px-2 py-1.5 text-[13px] leading-6"
                      >
                        <CommentLine
                          authorName={comment.authorName}
                          replyToName={replyToName}
                          text={comment.text}
                        />
                      </div>
                    );
                  }
                  return (
                    <button
                      key={comment.id}
                      type="button"
                      onClick={() => {
                        onStartCommentReply?.(comment);
                        focusComposer();
                      }}
                      className={cn(
                        "block w-full rounded-[10px] px-2 py-1.5 text-left text-[13px] leading-6 transition-colors",
                        isActiveReply
                          ? "bg-[rgba(7,193,96,0.12)]"
                          : "hover:bg-white",
                      )}
                      title={t(msg`回复这条评论`)}
                    >
                      <CommentLine
                        authorName={comment.authorName}
                        replyToName={replyToName}
                        text={comment.text}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 text-[12px] text-[color:var(--text-muted)]">
                {t(msg`还没有评论，你可以成为第一个回应的人。`)}
              </div>
            )}

            {activeReply ? (
              (() => {
                const replyTargetComment = commentsById.get(
                  activeReply.commentId,
                );
                return (
                  <div className="mt-3 flex items-start justify-between gap-2 rounded-[10px] border border-[rgba(7,193,96,0.18)] bg-[rgba(7,193,96,0.06)] px-3 py-2 text-[12px] text-[color:var(--text-secondary)]">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="truncate">
                        {t(msg`正在回复 ${activeReply.authorName}`)}
                      </div>
                      {replyTargetComment ? (
                        <div className="truncate text-[color:var(--text-muted)]">
                          {t(msg`「${replyTargetComment.text}」`)}
                        </div>
                      ) : null}
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
                );
              })()
            ) : null}

            <div className="mt-3 border-t border-[color:var(--border-faint)] pt-3">
              {moment.canInteract ? (
                <MomentCommentComposer
                  value={commentDraft}
                  onChange={onCommentChange}
                  onSubmit={onCommentSubmit}
                  pending={commentLoading}
                  inputRef={composerInputRef}
                  placeholder={
                    activeReply
                      ? t(msg`回复 ${activeReply.authorName}...`)
                      : t(msg`写评论...`)
                  }
                  inputClassName="rounded-xl border-[color:var(--border-faint)] bg-white px-4 py-2 text-[13px] shadow-none hover:bg-white focus:border-[rgba(7,193,96,0.14)] focus:shadow-none"
                  buttonClassName="bg-[color:var(--brand-primary)] text-white shadow-none hover:opacity-95"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-[color:var(--border-faint)] bg-white px-4 py-2 text-[12px] text-[color:var(--text-muted)]">
                  {t(msg`加为好友后才能评论。`)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CommentLine({
  authorName,
  replyToName,
  text,
}: {
  authorName: string;
  replyToName: string | null;
  text: string;
}) {
  const translate = useRuntimeTranslator();
  return (
    <span>
      <span className="font-medium text-[#07c160]">{authorName}</span>
      {replyToName ? (
        <>
          <span className="text-[color:var(--text-secondary)]">
            {translate(msg` 回复 `)}
          </span>
          <span className="font-medium text-[#07c160]">{replyToName}</span>
        </>
      ) : null}
      <span className="text-[color:var(--text-secondary)]">
        {translate(msg`：`)}
      </span>
      <span className="text-[color:var(--text-primary)]">{text}</span>
    </span>
  );
}
