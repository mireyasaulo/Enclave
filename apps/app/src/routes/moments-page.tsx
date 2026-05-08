import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { msg } from "@lingui/macro";
import { ArrowLeft, Camera } from "lucide-react";
import {
  addMomentComment,
  getBlockedCharacters,
  getMoments,
  toggleMomentLike,
  type Moment,
  type MomentComment,
} from "@yinjie/contracts";
import type { MessageDescriptor } from "@lingui/core";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, Button, InlineNotice } from "@yinjie/ui";
import { RouteRedirectState } from "../components/route-redirect-state";
import { WeChatActionBubble } from "../components/wechat-action-bubble";
import {
  WeChatCommentBar,
  type WeChatCommentBarReplyTarget,
} from "../components/wechat-comment-bar";
import { WeChatMomentCard } from "../components/wechat-moment-card";
import { WeChatMomentsCover } from "../components/wechat-moments-cover";
import { usePullToRefresh } from "../features/moments/use-pull-to-refresh";
import {
  hydrateDesktopFavoritesFromNative,
  readDesktopFavorites,
  removeDesktopFavorite,
  upsertDesktopFavorite,
} from "../features/favorites/favorites-storage";
import { buildDesktopFriendMomentsRouteHash } from "../features/moments/friend-moments-route-state";
import { buildMobileFriendMomentsRouteHash } from "../features/moments/mobile-friend-moments-route-state";
import { buildMobileMomentsPublishRouteHash } from "../features/moments/mobile-moments-publish-route-state";
import {
  buildDesktopMomentsRouteHash,
  parseDesktopMomentsRouteState,
} from "../features/moments/moments-route-state";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { consumeMomentPublishFlash } from "../features/moments/moment-publish-flash";
import {
  publishMomentComposeDraft,
  useMomentComposeDraft,
} from "../features/moments/moment-compose-media";
import { getMomentSummaryText } from "../features/moments/moment-content";
import { formatTimestamp } from "../lib/format";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { normalizePathname } from "../lib/normalize-pathname";
import { shareWithNativeShell } from "../runtime/mobile-bridge";
import { isNativeMobileShareSurface } from "../runtime/mobile-share-surface";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const DesktopMomentsWorkspace = lazy(async () => {
  const mod =
    await import("../features/desktop/moments/desktop-moments-workspace");
  return { default: mod.DesktopMomentsWorkspace };
});

const DesktopMessageAvatarPopover = lazy(async () => {
  const mod = await import("../features/chat/message-avatar-popover-shell");
  return { default: mod.DesktopMessageAvatarPopover };
});

export function MomentsPage() {
  const t = useRuntimeTranslator();
  const isDesktopLayout = useDesktopLayout();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const hash = useRouterState({
    select: (state) => state.location.hash,
  });
  const queryClient = useQueryClient();
  const ownerId = useWorldOwnerStore((state) => state.id);
  const ownerAvatar = useWorldOwnerStore((state) => state.avatar);
  const ownerUsername = useWorldOwnerStore((state) => state.username);
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const nativeDesktopFavorites = runtimeConfig.appPlatform === "desktop";
  const nativeMobileShareSupported = isNativeMobileShareSurface({
    isDesktopLayout,
  });
  const normalizedPathname = normalizePathname(pathname);
  const composeDraft = useMomentComposeDraft();
  const resetComposeDraft = composeDraft.reset;
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [desktopReplyTarget, setDesktopReplyTarget] = useState<{
    authorId: string;
    authorName: string;
    commentId: string;
    postId: string;
  } | null>(null);
  // 移动端微信化交互状态
  const [actionBubble, setActionBubble] = useState<{
    momentId: string;
    anchorRect: DOMRect;
  } | null>(null);
  const [commentBarTarget, setCommentBarTarget] = useState<{
    momentId: string;
    replyTo: WeChatCommentBarReplyTarget | null;
  } | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info">("success");
  const [noticeActionLabel, setNoticeActionLabel] = useState<string | null>(
    null,
  );
  const [noticeAction, setNoticeAction] = useState<(() => void) | null>(null);
  const [favoriteSourceIds, setFavoriteSourceIds] = useState<string[]>([]);
  const [desktopAvatarPopover, setDesktopAvatarPopover] = useState<{
    anchorElement: HTMLButtonElement;
    characterId: string;
    fallbackAvatar?: string | null;
    fallbackName: string;
    returnHash?: string;
  } | null>(null);
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const routeState = parseDesktopMomentsRouteState(hash);
  const routeSelectedAuthorId = routeState.authorId ?? null;
  const routeSelectedMomentId = routeState.momentId ?? null;
  const safeReturnPath =
    routeState.returnPath && !isDesktopOnlyPath(routeState.returnPath)
      ? routeState.returnPath
      : undefined;
  const safeReturnHash = safeReturnPath ? routeState.returnHash : undefined;
  const currentRouteHash = useMemo(
    () =>
      buildDesktopMomentsRouteHash({
        authorId: routeSelectedAuthorId ?? undefined,
        momentId: routeSelectedMomentId ?? undefined,
        returnPath: safeReturnPath,
        returnHash: safeReturnHash,
      }),
    [
      routeSelectedAuthorId,
      routeSelectedMomentId,
      safeReturnHash,
      safeReturnPath,
    ],
  );

  useEffect(() => {
    setDesktopAvatarPopover(null);
  }, [hash, pathname]);

  const momentsQuery = useQuery({
    queryKey: ["app-moments", baseUrl],
    queryFn: () => getMoments(baseUrl),
  });
  const blockedQuery = useQuery({
    queryKey: ["app-moments-blocked-characters", baseUrl],
    queryFn: () => getBlockedCharacters(baseUrl),
    enabled: Boolean(ownerId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      publishMomentComposeDraft({
        text: composeDraft.text,
        imageDrafts: composeDraft.imageDrafts,
        videoDraft: composeDraft.videoDraft,
        baseUrl,
      }),
    onSuccess: async () => {
      composeDraft.reset();
      setShowCompose(false);
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`朋友圈已发布。`));
      await queryClient.invalidateQueries({
        queryKey: ["app-moments", baseUrl],
      });
    },
  });

  const likeMutation = useMutation({
    mutationFn: (momentId: string) => toggleMomentLike(momentId, baseUrl),
    onMutate: async (momentId) => {
      if (!ownerId) {
        return { snapshots: [] as Array<[readonly unknown[], Moment[] | undefined]> };
      }
      await queryClient.cancelQueries({ queryKey: ["app-moments", baseUrl] });
      const snapshots = queryClient.getQueriesData<Moment[]>({
        queryKey: ["app-moments", baseUrl],
      });
      snapshots.forEach(([key, data]) => {
        if (!data) {
          return;
        }
        queryClient.setQueryData<Moment[]>(
          key,
          data.map((moment) => {
            if (moment.id !== momentId) {
              return moment;
            }
            const alreadyLiked = moment.likes.some(
              (like) => like.authorId === ownerId,
            );
            const nextLikes = alreadyLiked
              ? moment.likes.filter((like) => like.authorId !== ownerId)
              : [
                  ...moment.likes,
                  {
                    id: `optimistic-${ownerId}-${moment.id}`,
                    postId: moment.id,
                    authorId: ownerId,
                    authorName: ownerUsername ?? t(msg`我`),
                    authorAvatar: ownerAvatar ?? "",
                    authorType: "user" as const,
                    createdAt: new Date().toISOString(),
                  },
                ];
            return {
              ...moment,
              likes: nextLikes,
              likeCount: Math.max(
                0,
                moment.likeCount + (alreadyLiked ? -1 : 1),
              ),
            };
          }),
        );
      });
      return { snapshots };
    },
    onError: (_error, _momentId, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: async () => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`朋友圈互动已更新。`));
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

      const replyTo =
        desktopReplyTarget && desktopReplyTarget.postId === momentId
          ? desktopReplyTarget
          : null;

      return addMomentComment(
        momentId,
        {
          text,
          replyToCommentId: replyTo?.commentId,
          replyToAuthorId: replyTo?.authorId,
        },
        baseUrl,
      );
    },
    onSuccess: async (_, momentId) => {
      setCommentDrafts((current) => ({ ...current, [momentId]: "" }));
      setDesktopReplyTarget((current) =>
        current?.postId === momentId ? null : current,
      );
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`朋友圈互动已更新。`));
      await queryClient.invalidateQueries({
        queryKey: ["app-moments", baseUrl],
      });
    },
  });
  const pendingLikeMomentId = likeMutation.isPending
    ? likeMutation.variables
    : null;
  const pendingCommentMomentId = commentMutation.isPending
    ? commentMutation.variables
    : null;
  const blockedCharacterIds = new Set(
    (blockedQuery.data ?? []).map((item) => item.characterId),
  );
  const visibleMoments = (momentsQuery.data ?? []).filter(
    (moment) =>
      moment.authorType !== "character" ||
      !blockedCharacterIds.has(moment.authorId),
  );
  const routeSelectedMoment = routeSelectedMomentId
    ? visibleMoments.find((moment) => moment.id === routeSelectedMomentId) ?? null
    : null;
  const routeSelectedAuthorMoment = routeSelectedAuthorId
    ? routeSelectedMoment?.authorId === routeSelectedAuthorId
      ? routeSelectedMoment
      : visibleMoments.find((moment) => moment.authorId === routeSelectedAuthorId) ??
        null
    : null;
  const syncedRouteSelectedAuthorId =
    routeSelectedAuthorId &&
    routeSelectedAuthorMoment?.authorType === "character"
      ? routeSelectedAuthorId
      : undefined;
  const isDiscoverSubPage = normalizedPathname === "/discover/moments";
  const desktopMomentsPath = "/tabs/moments";
  const isDesktopMomentsRoute =
    normalizedPathname === desktopMomentsPath ||
    normalizedPathname === "/moments" ||
    normalizedPathname === "/discover/moments";
  const interactionActionLabel = safeReturnPath
    ? t(msg`返回上一页`)
    : t(msg`重试读取`);

  function openMobileMomentsPublishPage() {
    void navigate({
      to: "/discover/moments/publish",
      hash: buildMobileMomentsPublishRouteHash({
        returnPath: pathname,
        returnHash: currentRouteHash || undefined,
      }),
    });
  }

  function openMobileFriendMoments(characterId: string) {
    void navigate({
      to: "/friend-moments/$characterId",
      params: { characterId },
      hash: buildMobileFriendMomentsRouteHash({
        returnPath: pathname,
        returnHash: currentRouteHash || undefined,
      }),
    });
  }

  function navigateToRouteStateReturn() {
    if (!safeReturnPath) {
      return false;
    }

    void navigate({
      to: safeReturnPath,
      ...(safeReturnHash ? { hash: safeReturnHash } : {}),
    });
    return true;
  }

  function handleStatusBack() {
    if (navigateToRouteStateReturn()) {
      return;
    }

    void momentsQuery.refetch();
    void blockedQuery.refetch();
  }

  function handleRetryLoad() {
    void momentsQuery.refetch();
    void blockedQuery.refetch();
  }

  function handleEmptyStateAction() {
    if (navigateToRouteStateReturn()) {
      return;
    }

    openMobileMomentsPublishPage();
  }

  useEffect(() => {
    resetComposeDraft();
    setCommentDrafts({});
    setShowCompose(false);
    const flashNotice = consumeMomentPublishFlash();
    if (flashNotice) {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(flashNotice);
      return;
    }

    setNoticeActionLabel(null);
    setNoticeAction(null);
    setNotice("");
  }, [baseUrl, resetComposeDraft]);

  useEffect(() => {
    setFavoriteSourceIds(readDesktopFavorites().map((item) => item.sourceId));
  }, []);

  useEffect(() => {
    if (!nativeDesktopFavorites) {
      return;
    }

    let cancelled = false;

    async function syncFavoriteSourceIds() {
      const favoriteSourceIds = (await hydrateDesktopFavoritesFromNative()).map(
        (item) => item.sourceId,
      );
      if (cancelled) {
        return;
      }

      setFavoriteSourceIds((current) =>
        JSON.stringify(current) === JSON.stringify(favoriteSourceIds)
          ? current
          : favoriteSourceIds,
      );
    }

    const handleFocus = () => {
      void syncFavoriteSourceIds();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void syncFavoriteSourceIds();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [nativeDesktopFavorites]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeActionLabel(null);
      setNoticeAction(null);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const desktopPathMismatch = pathname !== desktopMomentsPath;

    if (
      !isDesktopLayout ||
      !isDesktopMomentsRoute ||
      syncedRouteSelectedAuthorId ||
      (!desktopPathMismatch && currentRouteHash === normalizedHash)
    ) {
      return;
    }

    void navigate({
      to: desktopMomentsPath,
      hash: currentRouteHash || undefined,
      replace: true,
    });
  }, [
    currentRouteHash,
    isDesktopLayout,
    isDesktopMomentsRoute,
    navigate,
    normalizedHash,
    pathname,
    syncedRouteSelectedAuthorId,
    desktopMomentsPath,
  ]);

  useEffect(() => {
    if (
      !isDesktopLayout ||
      !isDesktopMomentsRoute ||
      !syncedRouteSelectedAuthorId
    ) {
      return;
    }

    void navigate({
      to: "/desktop/friend-moments/$characterId",
      params: { characterId: syncedRouteSelectedAuthorId },
      hash: buildDesktopFriendMomentsRouteHash({
        momentId: routeSelectedMomentId ?? undefined,
        source: "moments",
        returnPath: desktopMomentsPath,
        returnHash: buildDesktopMomentsRouteHash({
          momentId: routeSelectedMomentId ?? undefined,
        }),
      }),
      replace: true,
    });
  }, [
    isDesktopLayout,
    isDesktopMomentsRoute,
    navigate,
    routeSelectedMomentId,
    syncedRouteSelectedAuthorId,
    desktopMomentsPath,
  ]);

  useEffect(() => {
    if (
      !isDesktopLayout ||
      !routeSelectedAuthorId ||
      syncedRouteSelectedAuthorId === routeSelectedAuthorId
    ) {
      return;
    }

    const nextHash = buildDesktopMomentsRouteHash({
      momentId: routeSelectedMomentId ?? undefined,
      returnPath: safeReturnPath,
      returnHash: safeReturnHash,
    });

    if ((nextHash ?? "") === normalizedHash) {
      return;
    }

    void navigate({
      to: pathname,
      hash: nextHash,
      replace: true,
    });
  }, [
    isDesktopLayout,
    navigate,
    normalizedHash,
    pathname,
    routeSelectedAuthorId,
    routeSelectedMomentId,
    safeReturnHash,
    safeReturnPath,
    syncedRouteSelectedAuthorId,
  ]);

  async function handleImageFilesSelected(files: FileList | null) {
    try {
      await composeDraft.addImageFiles(files);
    } catch (error) {
      composeDraft.setMediaError(
        error instanceof Error
          ? error.message
          : t(msg`图片选择失败，请稍后重试。`),
      );
    }
  }

  async function handleVideoFileSelected(file: File | null) {
    try {
      await composeDraft.replaceVideoFile(file);
    } catch (error) {
      composeDraft.setMediaError(
        error instanceof Error
          ? error.message
          : t(msg`视频选择失败，请稍后重试。`),
      );
    }
  }

  useEffect(() => {
    if (
      isDesktopLayout ||
      !routeSelectedMomentId ||
      typeof document === "undefined"
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(`moment-post-${routeSelectedMomentId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }, [isDesktopLayout, routeSelectedMomentId, visibleMoments.length]);

  async function handleShareMoment(moment: (typeof visibleMoments)[number]) {
    const summaryBody = getMomentSummaryText(moment);
    const shareHash = buildDesktopMomentsRouteHash({
      momentId: moment.id,
    });
    const sharePath = `${pathname}${shareHash ? `#${shareHash}` : ""}`;
    const shareUrl =
      typeof window === "undefined"
        ? sharePath
        : `${window.location.origin}${sharePath}`;
    const locationLine = moment.location
      ? t(msg`\n位置：${moment.location}`)
      : "";
    const summaryText = `${moment.authorName}：${summaryBody}${locationLine}\n${shareUrl}`;

    if (nativeMobileShareSupported) {
      const shared = await shareWithNativeShell({
        title: t(msg`${moment.authorName} 的朋友圈`),
        text: `${moment.authorName}：${summaryBody}${locationLine}`,
        url: shareUrl,
      });

      if (shared) {
        setNoticeTone("success");
        setNoticeActionLabel(null);
        setNoticeAction(null);
        setNotice(t(msg`已打开系统分享面板。`));
        return;
      }
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setNoticeTone("info");
      setNoticeActionLabel(
        nativeMobileShareSupported ? t(msg`重试分享`) : t(msg`重试复制`),
      );
      setNoticeAction(() => () => {
        void handleShareMoment(moment);
      });
      setNotice(
        nativeMobileShareSupported
          ? t(msg`当前设备暂时无法打开系统分享，请稍后重试。`)
          : t(msg`当前环境暂不支持复制动态摘要。`),
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(summaryText);
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        nativeMobileShareSupported
          ? t(msg`系统分享暂时不可用，已复制动态摘要。`)
          : t(msg`动态摘要已复制。`),
      );
    } catch {
      setNoticeTone("info");
      setNoticeActionLabel(
        nativeMobileShareSupported ? t(msg`重试分享`) : t(msg`重试复制`),
      );
      setNoticeAction(() => () => {
        void handleShareMoment(moment);
      });
      setNotice(
        nativeMobileShareSupported
          ? t(msg`系统分享失败，请稍后重试。`)
          : t(msg`复制动态摘要失败，请稍后重试。`),
      );
    }
  }

  if (isDesktopLayout) {
    if (syncedRouteSelectedAuthorId) {
      return (
        <RouteRedirectState
          title={t(msg`正在打开好友朋友圈`)}
          description={t(msg`正在切换到桌面好友朋友圈工作区，马上显示对应居民的动态。`)}
          loadingLabel={t(msg`正在切换到桌面朋友圈...`)}
        />
      );
    }

    const errors: string[] = [];

    if (momentsQuery.isError && momentsQuery.error instanceof Error) {
      errors.push(momentsQuery.error.message);
    }

    if (blockedQuery.isError && blockedQuery.error instanceof Error) {
      errors.push(blockedQuery.error.message);
    }

    return (
      <Suspense
        fallback={
          <RouteRedirectState
            title={t(msg`正在打开桌面朋友圈`)}
            description={t(msg`正在载入桌面朋友圈工作区，马上显示动态和详情。`)}
            loadingLabel={t(msg`载入桌面朋友圈...`)}
          />
        }
      >
        <DesktopMomentsWorkspace
          commentDrafts={commentDrafts}
          commentErrorMessage={
            commentMutation.isError && commentMutation.error instanceof Error
              ? commentMutation.error.message
              : null
          }
          commentPendingMomentId={pendingCommentMomentId}
          composeErrorMessage={
            composeDraft.mediaError ??
            (createMutation.isError && createMutation.error instanceof Error
              ? createMutation.error.message
              : null)
          }
          createPending={createMutation.isPending}
          errors={errors}
          imageDrafts={composeDraft.imageDrafts}
          isLoading={momentsQuery.isLoading}
          likeErrorMessage={
            likeMutation.isError && likeMutation.error instanceof Error
              ? likeMutation.error.message
              : null
          }
          likePendingMomentId={pendingLikeMomentId}
          moments={visibleMoments}
          ownerAvatar={ownerAvatar}
          ownerId={ownerId}
          ownerUsername={ownerUsername}
          scrollToMomentId={routeSelectedMomentId}
          showCompose={showCompose}
          successNotice={notice}
          text={composeDraft.text}
          videoDraft={composeDraft.videoDraft}
          isMomentFavorite={(momentId) =>
            favoriteSourceIds.includes(`moment-${momentId}`)
          }
          commentReplyTarget={desktopReplyTarget}
          setShowCompose={setShowCompose}
          onCancelCommentReply={() => setDesktopReplyTarget(null)}
          onCommentChange={(momentId, value) =>
            setCommentDrafts((current) => ({
              ...current,
              [momentId]: value,
            }))
          }
          onCommentSubmit={(momentId) => commentMutation.mutate(momentId)}
          onStartCommentReply={({ momentId, comment }) =>
            setDesktopReplyTarget({
              authorId: comment.authorId,
              authorName: comment.authorName,
              commentId: comment.id,
              postId: momentId,
            })
          }
          onCreate={() => createMutation.mutate()}
          onImageFilesSelected={(files) => {
            void handleImageFilesSelected(files);
          }}
          onLike={(momentId) => likeMutation.mutate(momentId)}
          onOpenAuthorPopover={({ anchorElement, moment }) => {
            if (moment.authorType !== "character") {
              return;
            }

            setDesktopAvatarPopover({
              anchorElement,
              characterId: moment.authorId,
              fallbackAvatar: moment.authorAvatar,
              fallbackName: moment.authorName,
              returnHash: buildDesktopMomentsRouteHash({
                authorId: routeSelectedAuthorId ?? undefined,
                momentId: moment.id,
                returnPath: safeReturnPath,
                returnHash: safeReturnHash,
              }),
            });
          }}
          onToggleFavorite={(momentId) => {
            const moment = visibleMoments.find((item) => item.id === momentId);
            if (!moment) {
              return;
            }

            const sourceId = `moment-${moment.id}`;
            const collected = favoriteSourceIds.includes(sourceId);
            const routeHash = buildDesktopMomentsRouteHash({
              momentId: moment.id,
            });
            const nextFavorites = collected
              ? removeDesktopFavorite(sourceId)
              : upsertDesktopFavorite({
                  id: `favorite-${sourceId}`,
                  sourceId,
                  category: "moments",
                  title: moment.authorName,
                  description: getMomentSummaryText(moment),
                  meta: t(msg`朋友圈 · ${formatTimestamp(moment.postedAt)}`),
                  to: `/tabs/moments${routeHash ? `#${routeHash}` : ""}`,
                  badge: t(msg`朋友圈`),
                  avatarName: moment.authorName,
                  avatarSrc: moment.authorAvatar,
                });

            setFavoriteSourceIds(
              nextFavorites.map((favorite) => favorite.sourceId),
            );
          }}
          onRefresh={() => {
            void momentsQuery.refetch();
            if (ownerId) {
              void blockedQuery.refetch();
            }
          }}
          onTextChange={composeDraft.setText}
          onRemoveImage={(id) => composeDraft.removeImageDraft(id)}
          onRemoveVideo={() => composeDraft.clearVideoDraft()}
          onVideoFileSelected={(file) => {
            void handleVideoFileSelected(file);
          }}
        />
        {desktopAvatarPopover ? (
          <Suspense fallback={null}>
            <DesktopMessageAvatarPopover
              anchorElement={desktopAvatarPopover.anchorElement}
              kind="character"
              characterId={desktopAvatarPopover.characterId}
              fallbackAvatar={desktopAvatarPopover.fallbackAvatar}
              fallbackName={desktopAvatarPopover.fallbackName}
              navigationContext={{
                momentsReturnHash: desktopAvatarPopover.returnHash,
                momentsReturnPath: pathname,
                profileReturnHash: desktopAvatarPopover.returnHash,
                profileReturnPath: pathname,
              }}
              onClose={() => setDesktopAvatarPopover(null)}
            />
          </Suspense>
        ) : null}
      </Suspense>
    );
  }

  return (
    <MobileMomentsView
      isDiscoverSubPage={isDiscoverSubPage}
      ownerId={ownerId}
      ownerAvatar={ownerAvatar}
      ownerUsername={ownerUsername}
      visibleMoments={visibleMoments}
      momentsLoading={momentsQuery.isLoading}
      momentsError={
        momentsQuery.isError && momentsQuery.error instanceof Error
          ? momentsQuery.error
          : null
      }
      likePending={likeMutation.isPending}
      pendingCommentMomentId={pendingCommentMomentId}
      notice={notice}
      noticeTone={noticeTone}
      noticeActionLabel={noticeActionLabel}
      noticeAction={noticeAction}
      interactionActionLabel={interactionActionLabel}
      hasReturnPath={Boolean(safeReturnPath)}
      actionBubble={actionBubble}
      commentBarTarget={commentBarTarget}
      commentDrafts={commentDrafts}
      tx={t}
      onBack={() =>
        navigateBackOrFallback(() => {
          if (safeReturnPath) {
            void navigate({
              to: safeReturnPath,
              ...(safeReturnHash ? { hash: safeReturnHash } : {}),
            });
            return;
          }

          void navigate({ to: "/tabs/discover" });
        })
      }
      onCompose={openMobileMomentsPublishPage}
      onAuthorTap={(moment) => {
        if (moment.authorType === "character") {
          openMobileFriendMoments(moment.authorId);
        }
      }}
      onLikeMoment={(momentId) => likeMutation.mutate(momentId)}
      onOpenActionMenu={(momentId, anchorRect) =>
        setActionBubble({ momentId, anchorRect })
      }
      onCloseActionMenu={() => setActionBubble(null)}
      onCommentTap={(momentId, comment) =>
        setCommentBarTarget({
          momentId,
          replyTo: comment
            ? {
                authorId: comment.authorId,
                authorName: comment.authorName,
                commentId: comment.id,
              }
            : null,
        })
      }
      onCloseCommentBar={() => setCommentBarTarget(null)}
      onCommentChange={(momentId, value) =>
        setCommentDrafts((current) => ({
          ...current,
          [momentId]: value,
        }))
      }
      onCommentSubmit={(momentId) => {
        const target =
          commentBarTarget?.momentId === momentId
            ? commentBarTarget
            : null;
        setDesktopReplyTarget(
          target?.replyTo
            ? {
                authorId: target.replyTo.authorId,
                authorName: target.replyTo.authorName,
                commentId: target.replyTo.commentId,
                postId: momentId,
              }
            : null,
        );
        commentMutation.mutate(momentId, {
          onSuccess: () => setCommentBarTarget(null),
        });
      }}
      onRefresh={async () => {
        await Promise.all([
          momentsQuery.refetch(),
          ownerId ? blockedQuery.refetch() : Promise.resolve(null),
        ]);
      }}
      onRetry={handleRetryLoad}
      onEmptyAction={handleEmptyStateAction}
      onNoticeBack={handleStatusBack}
      likeError={
        likeMutation.isError && likeMutation.error instanceof Error
          ? likeMutation.error
          : null
      }
      commentError={
        commentMutation.isError && commentMutation.error instanceof Error
          ? commentMutation.error
          : null
      }
    />
  );
}

type MobileMomentsViewProps = {
  isDiscoverSubPage: boolean;
  ownerId: string | null;
  ownerAvatar: string | null;
  ownerUsername: string | null;
  visibleMoments: Moment[];
  momentsLoading: boolean;
  momentsError: Error | null;
  likePending: boolean;
  pendingCommentMomentId: string | null | undefined;
  notice: string;
  noticeTone: "success" | "info";
  noticeActionLabel: string | null;
  noticeAction: (() => void) | null;
  interactionActionLabel: string;
  hasReturnPath: boolean;
  actionBubble: { momentId: string; anchorRect: DOMRect } | null;
  commentBarTarget: {
    momentId: string;
    replyTo: WeChatCommentBarReplyTarget | null;
  } | null;
  commentDrafts: Record<string, string>;
  tx: (descriptor: MessageDescriptor) => string;
  onBack: () => void;
  onCompose: () => void;
  onAuthorTap: (moment: Moment) => void;
  onLikeMoment: (momentId: string) => void;
  onOpenActionMenu: (momentId: string, anchorRect: DOMRect) => void;
  onCloseActionMenu: () => void;
  onCommentTap: (momentId: string, comment: MomentComment | null) => void;
  onCloseCommentBar: () => void;
  onCommentChange: (momentId: string, value: string) => void;
  onCommentSubmit: (momentId: string) => void;
  onRefresh: () => Promise<unknown>;
  onRetry: () => void;
  onEmptyAction: () => void;
  onNoticeBack: () => void;
  likeError: Error | null;
  commentError: Error | null;
};

function MobileMomentsView({
  isDiscoverSubPage,
  ownerId,
  ownerAvatar,
  ownerUsername,
  visibleMoments,
  momentsLoading,
  momentsError,
  likePending: _likePending,
  pendingCommentMomentId,
  notice,
  noticeTone,
  noticeActionLabel,
  noticeAction,
  interactionActionLabel,
  hasReturnPath,
  actionBubble,
  commentBarTarget,
  commentDrafts,
  tx,
  onBack,
  onCompose,
  onAuthorTap,
  onLikeMoment,
  onOpenActionMenu,
  onCloseActionMenu,
  onCommentTap,
  onCloseCommentBar,
  onCommentChange,
  onCommentSubmit,
  onRefresh,
  onRetry,
  onEmptyAction,
  onNoticeBack,
  likeError,
  commentError,
}: MobileMomentsViewProps) {
  const t = tx;
  const { containerRef, state: pullState } = usePullToRefresh({
    onRefresh,
    enabled: true,
  });

  const activeMoment = actionBubble
    ? visibleMoments.find((moment) => moment.id === actionBubble.momentId) ??
      null
    : null;
  const liked = Boolean(
    ownerId &&
      activeMoment?.likes.some((like) => like.authorId === ownerId),
  );
  const ownerName = ownerUsername?.trim() || t(msg`世界主人`);

  return (
    <AppPage className="relative space-y-0 bg-white px-0 pb-0 pt-0">
      <TabPageTopBar
        title={t(msg`朋友圈`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[#ECECEC] bg-white px-4 pb-1.5 pt-1.5 text-[#1A1A1A] shadow-none"
        leftActions={
          isDiscoverSubPage ? (
            <Button
              onClick={onBack}
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border-0 bg-transparent text-[#1A1A1A] active:bg-black/[0.05]"
              aria-label={t(msg`返回`)}
            >
              <ArrowLeft size={17} />
            </Button>
          ) : undefined
        }
        rightActions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border-0 bg-transparent text-[#1A1A1A] active:bg-black/[0.05]"
            onClick={onCompose}
            aria-label={t(msg`发一条朋友圈`)}
          >
            <Camera size={20} strokeWidth={1.6} />
          </Button>
        }
      />

      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto overscroll-contain bg-white"
        style={{ overflowAnchor: "none" }}
      >
        <PullToRefreshIndicator state={pullState} t={t} />

        <div
          style={{
            transform: `translateY(${pullState.offset}px)`,
            transition: pullState.pulling ? "none" : "transform 220ms ease-out",
          }}
        >
          <WeChatMomentsCover
            nickname={ownerName}
            avatarUrl={ownerAvatar}
          />

          {notice ? (
            <div className="px-4 pt-3">
              <MobileMomentsInlineNotice
                tone={noticeTone}
                action={
                  noticeTone === "info" ? (
                    <div className="flex items-center gap-1.5">
                      {noticeAction && noticeActionLabel ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 rounded-full border-[#E5E5E5] bg-white px-3 text-[11px]"
                          onClick={noticeAction}
                        >
                          {noticeActionLabel}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 shrink-0 rounded-full border-[#E5E5E5] bg-white px-3 text-[11px]"
                        onClick={onNoticeBack}
                      >
                        {interactionActionLabel}
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {notice}
              </MobileMomentsInlineNotice>
            </div>
          ) : null}

          {momentsLoading && !visibleMoments.length ? (
            <div className="px-4 pt-10 pb-12 text-center text-[12px] text-[#9A9A9A]">
              {t(msg`正在刷新朋友圈`)}
            </div>
          ) : null}

          {momentsError ? (
            <div className="px-4 pt-10 pb-12 text-center">
              <div className="text-[14px] font-medium text-[#1A1A1A]">
                {t(msg`朋友圈暂时不可用`)}
              </div>
              <div className="mt-2 text-[12px] text-[#9A9A9A]">
                {momentsError.message}
              </div>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-full border-[#E5E5E5] bg-white px-3.5 text-[11px]"
                  onClick={onRetry}
                >
                  {t(msg`重试读取`)}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-full border-[#E5E5E5] bg-white px-3.5 text-[11px]"
                  onClick={onNoticeBack}
                >
                  {hasReturnPath ? t(msg`返回上一页`) : t(msg`重试读取`)}
                </Button>
              </div>
            </div>
          ) : null}

          {visibleMoments.map((moment, index) => (
            <div
              key={moment.id}
              className={
                index === 0
                  ? ""
                  : "border-t border-[#ECECEC]"
              }
            >
              <WeChatMomentCard
                cardId={`moment-post-${moment.id}`}
                moment={moment}
                ownerId={ownerId}
                liked={
                  Boolean(ownerId) &&
                  moment.likes.some((like) => like.authorId === ownerId)
                }
                onAuthorTap={() => onAuthorTap(moment)}
                onOpenActionMenu={(rect) => onOpenActionMenu(moment.id, rect)}
                onDoubleTapLike={() => onLikeMoment(moment.id)}
                onCommentTap={(comment) => onCommentTap(moment.id, comment)}
              />
            </div>
          ))}

          {likeError ? (
            <div className="px-4 pt-3">
              <MobileMomentsInlineNotice tone="info">
                {likeError.message}
              </MobileMomentsInlineNotice>
            </div>
          ) : null}
          {commentError ? (
            <div className="px-4 pt-3">
              <MobileMomentsInlineNotice tone="info">
                {commentError.message}
              </MobileMomentsInlineNotice>
            </div>
          ) : null}

          {!momentsLoading && !momentsError && !visibleMoments.length ? (
            <div className="px-4 pt-12 pb-16 text-center">
              <div className="text-[14px] font-medium text-[#1A1A1A]">
                {t(msg`还很安静`)}
              </div>
              <div className="mt-2 text-[12px] text-[#9A9A9A]">
                {t(msg`你先发一条动态，或者等世界里的角色们先开口。`)}
              </div>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 rounded-full bg-[#07C160] px-3.5 text-[12px] text-white hover:bg-[#06ad56]"
                  onClick={onEmptyAction}
                >
                  {hasReturnPath ? t(msg`返回上一页`) : t(msg`发一条朋友圈`)}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="h-[calc(env(safe-area-inset-bottom,0px)+24px)]" />
        </div>
      </div>

      <WeChatActionBubble
        open={Boolean(actionBubble)}
        anchorRect={actionBubble?.anchorRect ?? null}
        liked={liked}
        onLike={() => {
          if (actionBubble) {
            onLikeMoment(actionBubble.momentId);
          }
        }}
        onComment={() => {
          if (actionBubble) {
            onCommentTap(actionBubble.momentId, null);
          }
        }}
        onClose={onCloseActionMenu}
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
            onCommentChange(commentBarTarget.momentId, value);
          }
        }}
        pending={
          commentBarTarget
            ? pendingCommentMomentId === commentBarTarget.momentId
            : false
        }
        onSubmit={() => {
          if (commentBarTarget) {
            onCommentSubmit(commentBarTarget.momentId);
          }
        }}
        onClose={onCloseCommentBar}
      />
    </AppPage>
  );
}

function PullToRefreshIndicator({
  state,
  t,
}: {
  state: { offset: number; refreshing: boolean; pulling: boolean };
  t: (descriptor: MessageDescriptor) => string;
}) {
  if (!state.offset && !state.refreshing) return null;
  const label = state.refreshing
    ? t(msg`正在刷新...`)
    : state.offset >= 64
      ? t(msg`松手刷新`)
      : t(msg`下拉刷新`);
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center justify-center text-[12px] text-[#9A9A9A]"
      style={{
        top: 0,
        height: `${state.offset || 60}px`,
        transform: `translateY(-${(state.offset || 60) - state.offset}px)`,
      }}
    >
      <span>{label}</span>
    </div>
  );
}

function MobileMomentsStatusCard({
  badge,
  title,
  description,
  tone = "default",
  action,
}: {
  badge: string;
  title: string;
  description: string;
  tone?: "default" | "danger" | "loading";
  action?: ReactNode;
}) {
  const loading = tone === "loading";
  return (
    <section
      className={
        tone === "danger"
          ? "rounded-[18px] border border-[color:var(--border-danger)] bg-[linear-gradient(180deg,rgba(255,245,245,0.96),rgba(254,242,242,0.94))] px-4 py-5 text-center shadow-none"
          : "rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-5 text-center shadow-none"
      }
    >
      <div
        className={
          tone === "danger"
            ? "mx-auto inline-flex rounded-full bg-[rgba(220,38,38,0.08)] px-2.5 py-1 text-[9px] font-medium tracking-[0.04em] text-[color:var(--state-danger-text)]"
            : "mx-auto inline-flex rounded-full bg-[rgba(7,193,96,0.1)] px-2.5 py-1 text-[9px] font-medium tracking-[0.04em] text-[#07c160]"
        }
      >
        {badge}
      </div>
      {loading ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black/15 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-black/25 animate-pulse [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-[#8ecf9d] animate-pulse [animation-delay:240ms]" />
        </div>
      ) : null}
      <div className="mt-3 text-[15px] font-medium text-[color:var(--text-primary)]">
        {title}
      </div>
      <p className="mx-auto mt-2 max-w-[18rem] text-[11px] leading-[1.35rem] text-[color:var(--text-secondary)]">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

function MobileMomentsInlineNotice({
  children,
  tone,
  action,
}: {
  children: ReactNode;
  tone: "success" | "info";
  action?: ReactNode;
}) {
  return (
    <InlineNotice
      tone={tone}
      className="rounded-[11px] px-2.5 py-1.5 text-[11px] leading-[1.35rem] shadow-none"
    >
      {action ? (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1">{children}</span>
          {action}
        </div>
      ) : (
        children
      )}
    </InlineNotice>
  );
}
