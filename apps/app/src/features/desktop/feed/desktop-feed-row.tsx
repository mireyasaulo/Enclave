import { useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { msg } from "@lingui/macro";
import {
  type FeedComment,
  type FeedPostListItem,
  type FeedPostWithComments,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { ErrorBlock, LoadingBlock, cn } from "@yinjie/ui";
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
import { MomentCommentComposer } from "../../../components/moment-comment-composer";
import { MomentMediaGallery } from "../../../components/moment-media-gallery";
import {
  getFeedSummaryText,
  resolveFeedMomentContentType,
} from "../../feed/feed-media";
import { stripToolCallSyntax } from "../../moments/moment-content";
import { formatTimestamp } from "../../../lib/format";
import { type FeedCommentReplyTarget } from "./feed-types";

type DesktopFeedRowProps = {
  commentDraft: string;
  commentLoading: boolean;
  commentReplyTarget?: FeedCommentReplyTarget | null;
  detailErrorMessage?: string | null;
  detailLoading?: boolean;
  detailPost?: FeedPostWithComments | null;
  favorite: boolean;
  likeLoading: boolean;
  post: FeedPostListItem;
  onCancelCommentReply?: () => void;
  onCommentChange: (value: string) => void;
  onCommentSubmit: () => void;
  onLoadFullComments?: () => void;
  onLike: () => void;
  /** 可选 — 触发"分享图卡"。 */
  onShare?: () => void;
  onStartCommentReply?: (comment: FeedComment) => void;
  /** 点击评论里的作者/回复对象名 → 打开对应用户的资料/头像卡。 */
  onSelectCommentAuthor?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    comment: FeedComment,
  ) => void;
  /** 点击 post 作者头像/名字 → 打开对应居民/世界主人卡片。 */
  onSelectAuthor?: (
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onToggleFavorite: () => void;
};

export function DesktopFeedRow({
  commentDraft,
  commentLoading,
  commentReplyTarget = null,
  detailErrorMessage = null,
  detailLoading = false,
  detailPost = null,
  favorite,
  likeLoading,
  post,
  onCancelCommentReply,
  onCommentChange,
  onCommentSubmit,
  onLoadFullComments,
  onLike,
  onShare,
  onStartCommentReply,
  onSelectCommentAuthor,
  onSelectAuthor,
  onToggleFavorite,
}: DesktopFeedRowProps) {
  const t = useRuntimeTranslator();
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const displayText = stripToolCallSyntax(post.text);
  const hasText = Boolean(displayText);
  const hasMedia = post.media.length > 0;
  const mediaSummaryText = hasText ? "" : getFeedSummaryText(post);
  // 服务端 /feed/:id/like 现在双向：POST 加赞，DELETE 取消（与移动端 likeMutation
  // 对齐）。之前桌面端按钮 disabled={likeLoading || liked} 把已赞行整条 disable，
  // 用户点过一次就再也取消不掉；改成只在 likeLoading 时 disable，已赞状态由
  // 文案 + 图标填色 + onClick 触发反向 toggle 表达。
  const liked = Boolean(post.ownerState?.hasLiked);

  // 历史 DB 里可能残留 text="" 的鬼影评论（后端校验前 curl 直发的），以及 AI
  // 角色把整段 CoT prose 当评论存进来（gpt-4.1 这类非推理模型没 <think> 包裹）。
  // 两种都经 stripToolCallSyntax 后变 ""——之前桌面端直接渲染，列表里会冒出
  // 「{authorName}：」后面只有冒号的空评论占位；与移动端 discover-feed-page
  // 的过滤行为对齐。
  const commentsForDisplay = useMemo(() => {
    const source = detailPost ? detailPost.comments : post.commentsPreview;
    return source.filter(
      (comment) => stripToolCallSyntax(comment.text).trim().length > 0,
    );
  }, [detailPost, post.commentsPreview]);
  // detailPost 展开后若全部评论都是脏评论被过滤掉，但 commentCount > 0：
  // 用户点了「查看全部 N 条」拉到 detailPost，列表却变空，看不到任何东西也
  // 没解释——给一行兜底提示，跟移动端 expandedAllFiltered 对齐。
  const expandedAllFiltered =
    Boolean(detailPost) &&
    commentsForDisplay.length === 0 &&
    post.commentCount > 0;

  const commentsById = useMemo(
    () =>
      new Map(
        commentsForDisplay.map((comment) => [comment.id, comment] as const),
      ),
    [commentsForDisplay],
  );
  const authorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const comment of commentsForDisplay) {
      if (comment.authorId && comment.authorName) {
        map.set(comment.authorId, comment.authorName);
      }
    }
    return map;
  }, [commentsForDisplay]);

  function lookupReplyToName(comment: FeedComment): string | null {
    if (comment.replyToCommentId) {
      const target = commentsById.get(comment.replyToCommentId);
      if (target?.authorName) {
        return target.authorName;
      }
    }
    if (comment.replyToAuthorId) {
      const fromMap = authorNameById.get(comment.replyToAuthorId);
      if (fromMap) {
        return fromMap;
      }
    }
    // commentsPreview .slice(-3) 把被回复的根评论挤出窗口时，commentsById /
    // authorNameById 都查不到——但服务端 serializeComment 已经在 reply 的 DTO
    // 上塞了 replyToAuthorName 兜底（feed-contract.ts 第 87 行）。漏掉这层
    // fallback → 桌面端该回复就丢了"回复 X："前缀，与移动端 discover-feed-page
    // 的 ?? comment.replyToAuthorName ?? null 对齐。
    return comment.replyToAuthorName ?? null;
  }

  function lookupReplyToComment(comment: FeedComment): FeedComment | null {
    if (comment.replyToCommentId) {
      return commentsById.get(comment.replyToCommentId) ?? null;
    }
    return null;
  }

  const focusComposer = () => {
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  };

  const activeReply =
    commentReplyTarget && commentReplyTarget.postId === post.id
      ? commentReplyTarget
      : null;
  const replyTargetComment = activeReply
    ? (commentsById.get(activeReply.commentId) ??
      post.commentsPreview.find((item) => item.id === activeReply.commentId) ??
      null)
    : null;
  const canReply = Boolean(onStartCommentReply);
  const showLoadMore =
    !detailPost && post.commentCount > commentsForDisplay.length;

  return (
    <article
      id={`desktop-feed-post-${post.id}`}
      className="rounded-[16px] border border-[color:var(--border-faint)] bg-white px-4 py-4 shadow-[var(--shadow-section)]"
    >
      <div className="flex items-start gap-3">
        {onSelectAuthor ? (
          <button
            type="button"
            onClick={(event) => onSelectAuthor(event)}
            className="shrink-0 rounded-[18px] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(7,193,96,0.34)] focus-visible:ring-offset-1"
            aria-label={t(msg`查看 ${post.authorName} 的资料`)}
          >
            <AvatarChip
              name={post.authorName}
              src={post.authorAvatar}
              size="wechat"
            />
          </button>
        ) : (
          <div className="shrink-0 rounded-[18px]">
            <AvatarChip
              name={post.authorName}
              src={post.authorAvatar}
              size="wechat"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {onSelectAuthor ? (
                <button
                  type="button"
                  onClick={(event) => onSelectAuthor(event)}
                  className="truncate text-left text-[15px] font-semibold text-[color:var(--text-primary)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(7,193,96,0.34)] focus-visible:ring-offset-1"
                >
                  {post.authorName}
                </button>
              ) : (
                <div className="truncate text-[15px] font-semibold text-[color:var(--text-primary)]">
                  {post.authorName}
                </div>
              )}
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
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--text-muted)]">
              <span>{formatTimestamp(post.createdAt)}</span>
              <span>{t(msg`居民公开可见`)}</span>
            </div>
          </div>

          {hasText ? (
            <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-[color:var(--text-primary)]">
              {displayText}
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
                title={liked ? t(msg`再点一次取消赞`) : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] transition-[background-color,color,border-color] disabled:opacity-55",
                  liked
                    ? "border-[rgba(7,193,96,0.18)] bg-[rgba(7,193,96,0.06)] text-[color:var(--brand-primary)]"
                    : "border-[color:var(--border-faint)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]",
                )}
              >
                <Heart size={14} className={liked ? "fill-current" : ""} />
                {likeLoading
                  ? t(msg`处理中...`)
                  : liked
                    ? t(msg`已赞`)
                    : t(msg`点赞`)}
              </button>
              <button
                type="button"
                onClick={focusComposer}
                aria-label={t(msg`评论`)}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[color:var(--border-faint)] px-2.5 text-[12px] text-[color:var(--text-secondary)] transition-[background-color,color,border-color] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]"
              >
                <MessageCircle size={14} />
                {t(msg`评论`)}
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

          <div className="mt-3 rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--text-primary)]">
                <MessageCircle size={13} />
                {t(msg`评论`)}
              </div>
              <span className="text-[11px] text-[color:var(--text-muted)]">
                {t(msg`${post.commentCount} 条`)}
              </span>
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

            {expandedAllFiltered ? (
              <div className="mt-3 text-[12px] text-[color:var(--text-muted)]">
                {t(msg`评论暂时无法显示`)}
              </div>
            ) : null}

            {commentsForDisplay.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {commentsForDisplay.map((comment) => {
                  const replyToName = lookupReplyToName(comment);
                  const replyToComment = lookupReplyToComment(comment);
                  const isActiveReply = activeReply?.commentId === comment.id;
                  const authorClickHandler = onSelectCommentAuthor
                    ? (event: ReactMouseEvent<HTMLButtonElement>) => {
                        event.stopPropagation();
                        onSelectCommentAuthor(event, comment);
                      }
                    : undefined;
                  const replyToClickHandler =
                    onSelectCommentAuthor && replyToComment
                      ? (event: ReactMouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          onSelectCommentAuthor(event, replyToComment);
                        }
                      : undefined;
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
                          onAuthorClick={authorClickHandler}
                          onReplyToClick={replyToClickHandler}
                        />
                      </div>
                    );
                  }
                  const openReply = () => {
                    onStartCommentReply?.(comment);
                    focusComposer();
                  };
                  return (
                    <div
                      key={comment.id}
                      role="button"
                      tabIndex={0}
                      onClick={openReply}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openReply();
                        }
                      }}
                      className={cn(
                        "block w-full cursor-pointer rounded-[10px] px-2 py-1.5 text-left text-[13px] leading-6 transition-colors",
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
                        onAuthorClick={authorClickHandler}
                        onReplyToClick={replyToClickHandler}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !detailLoading && post.commentCount === 0 ? (
              // commentCount > 0 但 commentsForDisplay 全空只说明 preview 全是
              // 脏评论；这时另有 showLoadMore 让用户翻全量 + expandedAllFiltered
              // 兜底，不要再喊"还没有评论"。
              <div className="mt-3 text-[12px] text-[color:var(--text-muted)]">
                {t(msg`还没有评论，你可以成为第一个回应的人。`)}
              </div>
            ) : null}

            {showLoadMore && onLoadFullComments ? (
              <button
                type="button"
                onClick={onLoadFullComments}
                className="mt-3 text-[12px] font-medium text-[color:var(--brand-primary)]"
              >
                {detailLoading
                  ? t(msg`正在读取...`)
                  : t(msg`查看全部 ${post.commentCount} 条评论`)}
              </button>
            ) : null}

            {activeReply ? (
              <div className="mt-3 flex items-start justify-between gap-2 rounded-[10px] border border-[rgba(7,193,96,0.18)] bg-[rgba(7,193,96,0.06)] px-3 py-2 text-[12px] text-[color:var(--text-secondary)]">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate">
                    {t(msg`正在回复 ${activeReply.authorName}`)}
                  </div>
                  {replyTargetComment ? (
                    <div className="truncate text-[color:var(--text-muted)]">
                      {t(msg`「${stripToolCallSyntax(replyTargetComment.text)}」`)}
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
            ) : null}

            <div className="mt-3 border-t border-[color:var(--border-faint)] pt-3">
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
  onAuthorClick,
  onReplyToClick,
}: {
  authorName: string;
  replyToName: string | null;
  text: string;
  onAuthorClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onReplyToClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const t = useRuntimeTranslator();
  return (
    <span>
      {onAuthorClick ? (
        <button
          type="button"
          onClick={onAuthorClick}
          className="font-medium text-[#07c160] hover:opacity-80"
        >
          {authorName}
        </button>
      ) : (
        <span className="font-medium text-[#07c160]">{authorName}</span>
      )}
      {replyToName ? (
        <>
          <span className="text-[color:var(--text-secondary)]">
            {t(msg` 回复 `)}
          </span>
          {onReplyToClick ? (
            <button
              type="button"
              onClick={onReplyToClick}
              className="font-medium text-[#07c160] hover:opacity-80"
            >
              {replyToName}
            </button>
          ) : (
            <span className="font-medium text-[#07c160]">{replyToName}</span>
          )}
        </>
      ) : null}
      <span className="text-[color:var(--text-secondary)]">
        {t(msg`：`)}
      </span>
      <span className="text-[color:var(--text-primary)]">
        {stripToolCallSyntax(text)}
      </span>
    </span>
  );
}
