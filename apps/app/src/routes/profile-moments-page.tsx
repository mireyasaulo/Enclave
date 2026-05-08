import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera } from "lucide-react";
import {
  addMomentComment,
  getMoments,
  toggleMomentLike,
  type MomentComment,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import {
  AppPage,
  Button,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
} from "@yinjie/ui";
import { EmptyState } from "../components/empty-state";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { WeChatActionBubble } from "../components/wechat-action-bubble";
import {
  WeChatCommentBar,
  type WeChatCommentBarReplyTarget,
} from "../components/wechat-comment-bar";
import { WeChatMomentCard } from "../components/wechat-moment-card";
import { WeChatMomentsCover } from "../components/wechat-moments-cover";
import { buildMobileMomentsPublishRouteHash } from "../features/moments/mobile-moments-publish-route-state";
import { usePullToRefresh } from "../features/moments/use-pull-to-refresh";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { navigateBackOrFallback } from "../lib/history-back";
import { describeRequestError } from "../lib/request-error";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const PUBLISH_RETURN_HASH = buildMobileMomentsPublishRouteHash({
  returnPath: "/profile/moments",
});

export function ProfileMomentsPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const queryClient = useQueryClient();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const ownerId = useWorldOwnerStore((state) => state.id);
  const ownerName = useWorldOwnerStore((state) => state.username);
  const ownerAvatar = useWorldOwnerStore((state) => state.avatar);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [actionBubble, setActionBubble] = useState<{
    momentId: string;
    anchorRect: DOMRect;
  } | null>(null);
  const [commentBarTarget, setCommentBarTarget] = useState<{
    momentId: string;
    replyTo: WeChatCommentBarReplyTarget | null;
  } | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/tabs/moments", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  const momentsQuery = useQuery({
    queryKey: ["app-moments", baseUrl],
    queryFn: () => getMoments(baseUrl),
  });

  const ownMoments = useMemo(() => {
    if (!momentsQuery.data || !ownerId) {
      return [];
    }
    return momentsQuery.data.filter(
      (moment) => moment.authorType === "user" && moment.authorId === ownerId,
    );
  }, [momentsQuery.data, ownerId]);

  const likeMutation = useMutation({
    mutationFn: (momentId: string) => toggleMomentLike(momentId, baseUrl),
    onSuccess: async () => {
      setNotice({
        tone: "success",
        message: t(msg`朋友圈互动已更新。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-moments", baseUrl],
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: (momentId: string) => {
      const text = commentDrafts[momentId]?.trim();
      if (!text) {
        throw new Error(t(msg`请先输入评论内容。`));
      }

      const target =
        commentBarTarget?.momentId === momentId
          ? commentBarTarget.replyTo
          : null;

      return addMomentComment(
        momentId,
        {
          text,
          replyToCommentId: target?.commentId,
          replyToAuthorId: target?.authorId,
        },
        baseUrl,
      );
    },
    onSuccess: async (_, momentId) => {
      setCommentDrafts((current) => ({ ...current, [momentId]: "" }));
      setCommentBarTarget(null);
      setNotice({
        tone: "success",
        message: t(msg`朋友圈互动已更新。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-moments", baseUrl],
      });
    },
  });

  const pendingCommentMomentId = commentMutation.isPending
    ? commentMutation.variables
    : null;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const { containerRef, state: pullState } = usePullToRefresh({
    onRefresh: async () => {
      await momentsQuery.refetch();
    },
    enabled: !isDesktopLayout,
  });

  if (isDesktopLayout) {
    return null;
  }

  const goBack = () =>
    navigateBackOrFallback(() =>
      navigate({ to: "/tabs/profile", replace: true }),
    );

  const goPublish = () =>
    navigate({
      to: "/discover/moments/publish",
      hash: PUBLISH_RETURN_HASH,
    });

  const displayName = ownerName?.trim() || t(msg`世界主人`);

  const onCommentTap = (momentId: string, comment: MomentComment | null) => {
    setCommentBarTarget({
      momentId,
      replyTo: comment
        ? {
            authorId: comment.authorId,
            authorName: comment.authorName,
            commentId: comment.id,
          }
        : null,
    });
  };

  const activeMoment = actionBubble
    ? ownMoments.find((moment) => moment.id === actionBubble.momentId) ?? null
    : null;
  const liked = Boolean(
    ownerId && activeMoment?.likes.some((like) => like.authorId === ownerId),
  );

  return (
    <AppPage className="relative space-y-0 bg-white px-0 py-0">
      <TabPageTopBar
        title={t(msg`我的朋友圈`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[#ECECEC] bg-white px-4 pb-1.5 pt-1.5 text-[#1A1A1A] shadow-none"
        leftActions={
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1A1A1A] transition-colors active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </button>
        }
        rightActions={
          <button
            type="button"
            onClick={goPublish}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1A1A1A] transition-colors active:bg-black/[0.05]"
            aria-label={t(msg`发条朋友圈`)}
          >
            <Camera size={20} strokeWidth={1.6} />
          </button>
        }
      />

      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto overscroll-contain bg-white"
        style={{ overflowAnchor: "none" }}
      >
        {pullState.offset || pullState.refreshing ? (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 flex items-center justify-center text-[12px] text-[#9A9A9A]"
            style={{ top: 0, height: `${pullState.offset || 60}px` }}
          >
            <span>
              {pullState.refreshing
                ? t(msg`正在刷新...`)
                : pullState.offset >= 64
                  ? t(msg`松手刷新`)
                  : t(msg`下拉刷新`)}
            </span>
          </div>
        ) : null}

        <div
          style={{
            transform: `translateY(${pullState.offset}px)`,
            transition: pullState.pulling ? "none" : "transform 220ms ease-out",
          }}
        >
          <WeChatMomentsCover nickname={displayName} avatarUrl={ownerAvatar} />

          {notice ? (
            <div className="px-4 pt-3">
              <InlineNotice
                tone={notice.tone}
                className="rounded-[8px] border border-[#ECECEC] bg-white px-3 py-2 text-[12px] shadow-none"
              >
                {notice.message}
              </InlineNotice>
            </div>
          ) : null}

          {momentsQuery.isLoading ? (
            <div className="px-4 pt-10">
              <LoadingBlock label={t(msg`正在加载我的朋友圈`)} />
            </div>
          ) : null}

          {momentsQuery.isError && momentsQuery.error ? (
            <div className="px-4 pt-10">
              <ErrorBlock message={describeRequestError(momentsQuery.error)} />
            </div>
          ) : null}

          {!momentsQuery.isLoading &&
          !momentsQuery.isError &&
          ownMoments.length === 0 ? (
            <div className="px-4 pt-12">
              <EmptyState
                title={t(msg`还没有发布过朋友圈`)}
                description={t(msg`记录此刻，你的朋友圈会出现在这里。`)}
                action={
                  <Button
                    variant="primary"
                    className="rounded-full bg-[#07C160] px-5 text-[13px] text-white shadow-none hover:bg-[#06ad56]"
                    onClick={goPublish}
                  >
                    {t(msg`发条朋友圈`)}
                  </Button>
                }
              />
            </div>
          ) : null}

          {ownMoments.map((moment, index) => (
            <div
              key={moment.id}
              className={index === 0 ? "" : "border-t border-[#ECECEC]"}
            >
              <PersonalAlbumRow
                moment={moment}
                ownerId={ownerId}
                onOpenActionMenu={(rect) =>
                  setActionBubble({ momentId: moment.id, anchorRect: rect })
                }
                onDoubleTapLike={() => likeMutation.mutate(moment.id)}
                onCommentTap={(comment) => onCommentTap(moment.id, comment)}
              />
            </div>
          ))}

          <div className="h-[calc(env(safe-area-inset-bottom,0px)+24px)]" />
        </div>
      </div>

      <WeChatActionBubble
        open={Boolean(actionBubble)}
        anchorRect={actionBubble?.anchorRect ?? null}
        liked={liked}
        onLike={() => {
          if (actionBubble) {
            likeMutation.mutate(actionBubble.momentId);
          }
        }}
        onComment={() => {
          if (actionBubble) {
            onCommentTap(actionBubble.momentId, null);
          }
        }}
        onClose={() => setActionBubble(null)}
      />

      <WeChatCommentBar
        open={Boolean(commentBarTarget)}
        replyTo={commentBarTarget?.replyTo ?? null}
        value={
          commentBarTarget
            ? commentDrafts[commentBarTarget.momentId] ?? ""
            : ""
        }
        onChange={(value) => {
          if (commentBarTarget) {
            setCommentDrafts((current) => ({
              ...current,
              [commentBarTarget.momentId]: value,
            }));
          }
        }}
        pending={
          commentBarTarget
            ? pendingCommentMomentId === commentBarTarget.momentId
            : false
        }
        onSubmit={() => {
          if (commentBarTarget) {
            commentMutation.mutate(commentBarTarget.momentId);
          }
        }}
        onClose={() => setCommentBarTarget(null)}
      />
    </AppPage>
  );
}

function PersonalAlbumRow({
  moment,
  ownerId,
  onOpenActionMenu,
  onDoubleTapLike,
  onCommentTap,
}: {
  moment: import("@yinjie/contracts").Moment;
  ownerId: string | null;
  onOpenActionMenu: (rect: DOMRect) => void;
  onDoubleTapLike: () => void;
  onCommentTap: (comment: MomentComment | null) => void;
}) {
  const date = new Date(moment.postedAt);
  const day = Number.isNaN(date.getTime())
    ? "--"
    : `${date.getDate()}`.padStart(2, "0");
  const monthLabel = Number.isNaN(date.getTime())
    ? "--"
    : `${date.getMonth() + 1}月`;
  return (
    <div className="flex items-start gap-2 px-4 py-3.5">
      <div className="w-12 shrink-0 pt-1 text-right">
        <div className="text-[26px] font-semibold leading-none text-[#1A1A1A]">
          {day}
        </div>
        <div className="mt-1 text-[11px] tracking-[0.04em] text-[#9A9A9A]">
          {monthLabel}
        </div>
      </div>
      <div className="min-w-0 flex-1 pr-4">
        <WeChatMomentCard
          cardId={`moment-post-${moment.id}`}
          moment={moment}
          ownerId={ownerId}
          liked={
            Boolean(ownerId) &&
            moment.likes.some((like) => like.authorId === ownerId)
          }
          hideAuthor
          flush
          onOpenActionMenu={onOpenActionMenu}
          onDoubleTapLike={onDoubleTapLike}
          onCommentTap={onCommentTap}
        />
      </div>
    </div>
  );
}

