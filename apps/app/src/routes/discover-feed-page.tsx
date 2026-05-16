import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { msg } from "@lingui/macro";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Copy,
  Image as ImageIcon,
  PenSquare,
  Share2,
} from "lucide-react";
import {
  addFeedComment,
  getBlockedCharacters,
  getFeed,
  likeFeedPost,
  listFeedComments,
  replyFeedComment,
  unlikeFeedPost,
  type FeedAuthorType,
  type FeedComment,
  type FeedListResponse,
  type FeedPostWithComments,
} from "@yinjie/contracts";
import { AppPage, Button, InlineNotice } from "@yinjie/ui";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { FeedPostShareCardModal } from "../components/feed-post-share-card-modal";
import { MomentMediaGallery } from "../components/moment-media-gallery";
import { RouteRedirectState } from "../components/route-redirect-state";
import { buildCharacterDetailRouteHash } from "../features/contacts/character-detail-route-state";
import {
  hydrateDesktopFavoritesFromNative,
  readDesktopFavorites,
  removeDesktopFavorite,
  upsertDesktopFavorite,
} from "../features/favorites/favorites-storage";
import { SocialPostCard } from "../components/social-post-card";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { WeChatActionBubble } from "../components/wechat-action-bubble";
import {
  WeChatCommentBar,
  type WeChatCommentBarReplyTarget,
} from "../components/wechat-comment-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import {
  publishFeedComposeDraft,
  useMomentComposeDraft,
} from "../features/moments/moment-compose-media";
import { usePullToRefresh } from "../features/moments/use-pull-to-refresh";
import {
  buildFeedRouteHash,
  parseFeedRouteHash,
} from "../features/feed/feed-route-state";
import { buildMobileFeedPublishRouteHash } from "../features/feed/mobile-feed-publish-route-state";
import { consumeFeedPublishFlash } from "../features/feed/feed-publish-flash";
import {
  getFeedSummaryText,
  resolveFeedMomentContentType,
} from "../features/feed/feed-media";
import { stripToolCallSyntax } from "../features/moments/moment-content";
import { formatTimestamp } from "../lib/format";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { buildPublicShareUrl } from "../lib/share-url";
import { shareWithNativeShell } from "../runtime/mobile-bridge";
import { isNativeMobileShareSurface } from "../runtime/mobile-share-surface";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";
const DesktopFeedWorkspace = lazy(async () => {
  const mod = await import("../features/desktop/feed/desktop-feed-workspace");
  return { default: mod.DesktopFeedWorkspace };
});

const DesktopMessageAvatarPopover = lazy(async () => {
  const mod = await import("../features/chat/message-avatar-popover-shell");
  return { default: mod.DesktopMessageAvatarPopover };
});

export function DiscoverFeedPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
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
  const [actionBubble, setActionBubble] = useState<{
    postId: string;
    anchorRect: DOMRect;
  } | null>(null);
  const [commentBarTarget, setCommentBarTarget] = useState<{
    postId: string;
    replyTo: WeChatCommentBarReplyTarget | null;
  } | null>(null);
  // 走查 Round 4：commentMutation.variables 只追最后一次 mutate 的 postId —
  // 桌面端 Row A 还在飞的时候用户在 Row B 也按发送，variables 翻到 B，Row A
  // 的 `commentLoading=pendingCommentPostId===A` 立刻变 false，"发送"按钮被
  // 解锁，用户能在 A 上再敲一次回车，产出一条重复评论。维护一个并发集合，
  // onMutate 入栈、onSettled 出栈，桌面 Row 直接 `.has(postId)`。
  const [commentInflightPostIds, setCommentInflightPostIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  // 走查 Round 5：likeMutation 同样的并发追踪坑——用户在 Row A 还在飞时
  // 把 Row B 也点赞，likeMutation.variables 翻到 B，Row A 的"处理中..."
  // 解锁回"已赞"。此时用户在 Row A 再点一下又触发一次 UNLIKE 飞向服务端，
  // 跟在飞的 LIKE 撞包（两个请求同时到达服务端，谁先 commit 谁说了算）。
  // 用同样的 Set 模式跟踪 inflight postIds，让 row 各查各的。
  const [likeInflightPostIds, setLikeInflightPostIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [showCompose, setShowCompose] = useState(false);
  // 「查看全部 N 条评论」点开后，按 postId 把 listFeedComments 的全量结果放进来；
  // 命中即在 secondary 区用全量替换 commentsPreview。loadingPostId 用来在点击
  // 后把按钮文案换成"正在读取..."避免重复触发请求。
  const [fullCommentsByPostId, setFullCommentsByPostId] = useState<
    Record<string, FeedComment[]>
  >({});
  const [loadingFullCommentsPostId, setLoadingFullCommentsPostId] = useState<
    string | null
  >(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info">("success");
  const [noticeActionLabel, setNoticeActionLabel] = useState<string | null>(
    null,
  );
  const [noticeAction, setNoticeAction] = useState<(() => void) | null>(null);
  const [favoriteSourceIds, setFavoriteSourceIds] = useState<string[]>([]);
  // 「分享图卡」目标 post id — 与 link-share 分开存，用户可以两种都点。
  const [shareCardPostId, setShareCardPostId] = useState<string | null>(null);
  const [desktopAvatarPopover, setDesktopAvatarPopover] = useState<
    | {
        anchorElement: HTMLButtonElement;
        kind: "character";
        characterId: string;
        fallbackAvatar?: string | null;
        fallbackName: string;
        // 让 popover 走"查看资料"/"朋友圈"时拿 /tabs/feed 当 returnPath，
        // 否则掉进 popover 默认的 /tabs/chat — 在广场上点头像，看完资料回来
        // 直接被踹到聊天 tab。
        navigationContext?: {
          profileReturnPath?: string;
          profileReturnHash?: string;
          momentsReturnPath?: string;
          momentsReturnHash?: string;
        };
      }
    | {
        anchorElement: HTMLButtonElement;
        kind: "owner";
      }
    | null
  >(null);
  const routeState = parseFeedRouteHash(hash);
  const normalizedDesktopReturnPath =
    isDesktopLayout && routeState.returnPath === "/discover/feed"
      ? "/tabs/feed"
      : routeState.returnPath;
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const desktopPathMismatch = pathname !== "/tabs/feed";
  const routeSelectedPostId = routeState.postId;
  const [desktopSelectedPostId, setDesktopSelectedPostId] = useState<
    string | null
  >(routeSelectedPostId);
  const routeSelectionAlreadySynced =
    !desktopPathMismatch && routeSelectedPostId === desktopSelectedPostId;
  const safeReturnPath =
    normalizedDesktopReturnPath &&
    !isDesktopOnlyPath(normalizedDesktopReturnPath)
      ? normalizedDesktopReturnPath
      : undefined;
  const safeReturnHash = safeReturnPath ? routeState.returnHash : undefined;

  // 广场用无限分页：首屏 20 条，触底拉下一页，避免一次性把 200 条都拉过来
  // （后端那侧虽有 page 但前端老 client 写死 limit=200，整体反序列化和 JSON 媒体载荷都很沉）。
  const feedQuery = useInfiniteQuery({
    queryKey: ["app-feed-paged", baseUrl],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getFeed(pageParam, 20, baseUrl),
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce(
        (acc, page) => acc + page.posts.length,
        0,
      );
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    // staleTime 默认 0 → 切 tab 回来 / 路由再 mount 时把 4 页全 refetch（每次 ~80
    // 条 post + media JSON 重传）。广场不是高频更新的数据，30s 内的"陈旧"完全
    // 可接受；publish / 手动刷新仍走 invalidate 强制 refetch，不受影响。
    staleTime: 30_000,
  });
  // 按 id 去重：分页路径下若新发/删除导致页间边界偏移，page N 末尾和 page N+1 开头
  // 可能拿到同一条 post。UI 层兜底去重，避免列表重复闪烁。
  const feedPosts = useMemo(() => {
    if (!feedQuery.data) return [] as FeedListResponse["posts"];
    const seen = new Set<string>();
    const items: FeedListResponse["posts"] = [];
    for (const page of feedQuery.data.pages) {
      for (const post of page.posts) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        items.push(post);
      }
    }
    return items;
  }, [feedQuery.data]);
  // 触底加载：sentinel 进入视口 → fetchNextPage。
  // 用默认 root=null（viewport）+ rootMargin 提前触发，避免触到底再等。
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasNextFeedPage = feedQuery.hasNextPage;
  const isFetchingNextFeedPage = feedQuery.isFetchingNextPage;
  // fetchNextPage 失败时（中途网络抖动 / 服务端 5xx），feedQuery.isError 仍
  // 是 false（首屏数据没坏），错误是隐式 isFetchNextPageError 标记。旧逻辑
  // 没看这个 flag：observer 见 sentinel 一直在视口 → 不停重试 → 不停失败，
  // 用户既看不到失败提示也看不到 "正在加载更多" 之外的反馈。检到这个状态
  // 后：(1) 关掉 observer 别再自动重试；(2) 在底部 sentinel 旁边显式渲一条
  // 「加载更多失败 · 重试」让用户手动触发。
  const isFetchNextFeedPageError = feedQuery.isFetchNextPageError;
  const fetchNextFeedPage = feedQuery.fetchNextPage;
  useEffect(() => {
    if (!hasNextFeedPage || isFetchingNextFeedPage) {
      return;
    }
    if (isFetchNextFeedPageError) {
      return;
    }
    const sentinel = loadMoreRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextFeedPage();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    fetchNextFeedPage,
    hasNextFeedPage,
    isFetchingNextFeedPage,
    isFetchNextFeedPageError,
  ]);

  // 桌面端没有触底 sentinel，但旧版无脑递归 prefetch 把所有页一路串行拉到底——
  // 广场总量 200+ 时光首屏就要排 10+ RTT，把后端拉爆且白白下载用户没滚到的页。
  // 改成「自动 prefetch 头 N 页避免空白」+「DesktopFeedWorkspace 内滚动接近底
  // 时再调用 onRequestMore 加载下一页」。这里的自动 prefetch 上限取 3（=60 条），
  // 兼顾首屏不会一直只有 20 条 vs 不要拉光所有 page。
  const desktopAutoPrefetchPages = useRef(0);
  const DESKTOP_AUTO_PREFETCH_PAGE_CAP = 3;
  useEffect(() => {
    if (!isDesktopLayout) return;
    if (!hasNextFeedPage || isFetchingNextFeedPage) return;
    // Round 18 移动端补的 isFetchNextPageError 闸门，桌面端这三条自动拉页
    // 路径（auto-prefetch / on-demand requestMore / deep-link 目标驱动）当时
    // 没顺手补上。fetch 失败后 isFetchingNextFeedPage 翻回 false → 每个依赖
    // 它的 effect 立刻又触发一次 fetchNextPage，counter 一路烧到 cap=3 才
    // 停，把刚抖动的服务端继续打。
    if (isFetchNextFeedPageError) return;
    if (desktopAutoPrefetchPages.current >= DESKTOP_AUTO_PREFETCH_PAGE_CAP) {
      return;
    }
    desktopAutoPrefetchPages.current += 1;
    void fetchNextFeedPage();
  }, [
    isDesktopLayout,
    hasNextFeedPage,
    isFetchingNextFeedPage,
    isFetchNextFeedPageError,
    fetchNextFeedPage,
  ]);
  // 用户主动刷新（resetFeedToFirstPage 后 refetch）会把 page 回 1，此时
  // 自动 prefetch 计数器也要重置，否则刷新后只剩 1 页用户得自己滚。
  function resetDesktopAutoPrefetchCounter() {
    desktopAutoPrefetchPages.current = 0;
  }
  // 给 DesktopFeedWorkspace 用的稳定 callback：避免每次 page render 都把
  // workspace 内 IntersectionObserver 拆掉重建。useCallback 依赖 fetchNextPage
  // 的稳定引用（react-query useInfiniteQuery 内部 memo）+ hasNextPage/isFetchingNextPage
  // 标记（这两个值变化时本来就该重建 observer 决定是否要观测）。
  const desktopRequestMore = useCallback(() => {
    if (isFetchNextFeedPageError) return;
    if (hasNextFeedPage && !isFetchingNextFeedPage) {
      void fetchNextFeedPage();
    }
  }, [
    hasNextFeedPage,
    isFetchingNextFeedPage,
    isFetchNextFeedPageError,
    fetchNextFeedPage,
  ]);
  // 深链 /tabs/feed#post=<id> 落到桌面但目标 post 在第 4 页以后：Round 1 把
  // 自动 prefetch 上限砍到 3 页（=60 条）防止 200+ 条广场把后端拉爆，副作用
  // 是 deep-link 找不到目标只能枯坐。这里独立加一层「目标驱动」拉页：仅当
  // routeSelectedPostId 存在且尚未在 visiblePosts 里时绕开 cap 继续翻，直到
  // 找到或没有下一页；与移动端 line ~870 的等价 effect 对齐。
  // 注意 useEffect deps 用 feedPosts 而不是 visiblePosts，避免 blockedQuery 还
  // 没回来时 visiblePosts 空导致循环 fetch；feedPosts 跟着 cache 增量更新即可。
  useEffect(() => {
    if (!isDesktopLayout) return;
    if (!routeSelectedPostId) return;
    if (feedPosts.some((post) => post.id === routeSelectedPostId)) return;
    if (!hasNextFeedPage || isFetchingNextFeedPage) return;
    if (isFetchNextFeedPageError) return;
    void fetchNextFeedPage();
  }, [
    isDesktopLayout,
    routeSelectedPostId,
    feedPosts,
    hasNextFeedPage,
    isFetchingNextFeedPage,
    isFetchNextFeedPageError,
    fetchNextFeedPage,
  ]);

  const blockedQuery = useQuery({
    queryKey: ["app-discover-blocked-characters", baseUrl],
    queryFn: () => getBlockedCharacters(baseUrl),
    enabled: Boolean(ownerId),
    // block 名单几乎不变（用户主动屏蔽角色才更新）。默认 staleTime=0 会让每次
    // 路由 mount / window focus 都重拉，纯浪费。给 5 分钟兜底，用户手动 unblock
    // 后回到广场不至于太久才看到生效——必要时由 contacts/blocks 那一侧
    // invalidate 推过来即可。
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      publishFeedComposeDraft({
        text: composeDraft.text,
        imageDrafts: composeDraft.imageDrafts,
        videoDraft: composeDraft.videoDraft,
        baseUrl,
      }),
    onSuccess: (newPost) => {
      composeDraft.reset();
      setShowCompose(false);
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`广场动态已发布，世界居民公开可见。`));
      // 立刻把新 post prepend 到 paged 头部 + 平铺 flat cache，本页就能马上看到刚发的内容；
      // 顺便把已加载的多页砍回 1 页（发布后分页边界后移，避免 page 1 末尾和 page 2 开头重复）。
      // 砍页等价于 resetFeedToFirstPage，但走的不是那个 helper，所以 prefetch
      // 计数器要同步重置，否则发布前已经打满 cap 时新账户 / 当前账户都拉不出
      // 后续页，sentinel 救不到底端外。
      resetDesktopAutoPrefetchCounter();
      const newListItem = { ...newPost, commentsPreview: [] };
      queryClient.setQueryData<InfiniteData<FeedListResponse>>(
        ["app-feed-paged", baseUrl],
        (current) =>
          current && current.pages.length > 0
            ? {
                pages: [
                  {
                    ...current.pages[0]!,
                    posts: [newListItem, ...current.pages[0]!.posts],
                    total: current.pages[0]!.total + 1,
                  },
                ],
                pageParams: current.pageParams.slice(0, 1),
              }
            : current,
      );
      queryClient.setQueryData<FeedListResponse>(
        ["app-feed", baseUrl],
        (current) =>
          current
            ? {
                posts: [newListItem, ...current.posts],
                total: current.total + 1,
              }
            : current,
      );
      // 后台 invalidate 让 discover-page、search-index 等共用 cache 的页面也合并最新状态
      void queryClient.invalidateQueries({
        queryKey: ["app-feed-paged", baseUrl],
      });
      void queryClient.invalidateQueries({ queryKey: ["app-feed", baseUrl] });
      void queryClient.invalidateQueries({ queryKey: ["app-feed-post", baseUrl] });
    },
  });

  const likeMutation = useMutation({
    // 微信样式气泡的「赞 / 取消」必须真双向：原本只 POST /feed/:id/like，
    // bubble 上「取消」按下后没有 unlike 端点 → 后端 INSERT OR IGNORE 静默忽略，
    // 用户看到 toast 成功但红心和计数没变。改成根据当前 hasLiked 状态走
    // POST 或 DELETE。
    mutationFn: (postId: string) => {
      const currentPost = feedPosts.find((post) => post.id === postId);
      const alreadyLiked = currentPost?.ownerState?.hasLiked ?? false;
      return alreadyLiked
        ? unlikeFeedPost(postId, baseUrl)
        : likeFeedPost(postId, baseUrl);
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["app-feed-paged", baseUrl] });
      setLikeInflightPostIds((current) => {
        if (current.has(postId)) return current;
        const next = new Set(current);
        next.add(postId);
        return next;
      });
      // 直接 setQueriesData 翻 hasLiked/likeCount，不再 capture full snapshot
      // —— onError 用反向 toggle 回滚（见下方 onError 注释）。
      queryClient.setQueriesData<InfiniteData<FeedListResponse>>(
        { queryKey: ["app-feed-paged", baseUrl] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) => {
                if (post.id !== postId) return post;
                const alreadyLiked = post.ownerState?.hasLiked ?? false;
                return {
                  ...post,
                  likeCount: Math.max(
                    0,
                    post.likeCount + (alreadyLiked ? -1 : 1),
                  ),
                  ownerState: {
                    ...(post.ownerState ?? {
                      hasLiked: false,
                      hasFavorited: false,
                      isFollowingAuthor: false,
                      isNotInterested: false,
                      hasViewed: false,
                      hasShared: false,
                      lastViewedAt: null,
                      watchProgressSeconds: null,
                      completed: false,
                    }),
                    hasLiked: !alreadyLiked,
                  },
                };
              }),
            })),
          };
        },
      );
    },
    onError: (_error, postId) => {
      // 之前用 full-snapshot rollback：snapshot 在本 mutation 的 onMutate 时拍，
      // 不含其他 post 在期间产生的乐观更新。串发场景下（点 A 还在飞就点 B）
      // B 成功 + A 失败时，A 的 onError 拿 snapshotA 一把全覆盖回去，B 的乐观
      // 状态也跟着被冲掉。
      // 改成"只对出错那条 post 反向 toggle"：onMutate 把 hasLiked 翻了一下，
      // 这里再翻回去就行，不碰其他 post。
      queryClient.setQueriesData<InfiniteData<FeedListResponse>>(
        { queryKey: ["app-feed-paged", baseUrl] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) => {
                if (post.id !== postId) return post;
                const currentHasLiked = post.ownerState?.hasLiked ?? false;
                return {
                  ...post,
                  likeCount: Math.max(
                    0,
                    post.likeCount + (currentHasLiked ? -1 : 1),
                  ),
                  ownerState: {
                    ...(post.ownerState ?? {
                      hasLiked: false,
                      hasFavorited: false,
                      isFollowingAuthor: false,
                      isNotInterested: false,
                      hasViewed: false,
                      hasShared: false,
                      lastViewedAt: null,
                      watchProgressSeconds: null,
                      completed: false,
                    }),
                    hasLiked: !currentHasLiked,
                  },
                };
              }),
            })),
          };
        },
      );
    },
    onSettled: (_data, _error, postId) => {
      setLikeInflightPostIds((current) => {
        if (!current.has(postId)) return current;
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    },
    onSuccess: () => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`广场互动已更新。`));
      // 点赞 toggle 是 boolean，optimistic 已经把 likeCount/hasLiked 切对。
      // 完全省掉 invalidate，避免拉回 paged 多页 + 30+ media 条件请求 RTT。
    },
  });

  const commentMutation = useMutation({
    mutationFn: (input: {
      postId: string;
      replyTarget?: {
        authorId: string;
        authorName: string;
        commentId: string;
        postId: string;
      } | null;
      text: string;
    }) => {
      const text = input.text.trim();
      if (!text) {
        throw new Error(t(msg`请先输入评论内容。`));
      }

      if (input.replyTarget) {
        return replyFeedComment(
          input.replyTarget.commentId,
          { text },
          baseUrl,
        );
      }

      return addFeedComment(input.postId, { text }, baseUrl);
    },
    onMutate: (input) => {
      setCommentInflightPostIds((current) => {
        if (current.has(input.postId)) return current;
        const next = new Set(current);
        next.add(input.postId);
        return next;
      });
    },
    onSettled: (_data, _error, input) => {
      setCommentInflightPostIds((current) => {
        if (!current.has(input.postId)) return current;
        const next = new Set(current);
        next.delete(input.postId);
        return next;
      });
    },
    onSuccess: (newComment, input) => {
      setCommentDrafts((current) => ({ ...current, [input.postId]: "" }));
      setDesktopReplyTarget((current) =>
        current?.postId === input.postId ? null : current,
      );
      setCommentBarTarget((current) =>
        current?.postId === input.postId ? null : current,
      );
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        input.replyTarget
          ? t(msg`广场回复已发送。`)
          : t(msg`广场互动已更新。`),
      );
      // 旧版每次评论都 invalidate paged-feed + legacy + post 三套 cache，
      // 桌面端自动 prefetch 4 页时 paged 失效 → 80+ 条 post 含 media JSON
      // 整把重拉，连续评论的体感是"输入框卡，列表轻微抖动 1-2s"。
      // 改成乐观更新本地 cache：在受影响的那条 post 上 commentsPreview append
      // 新评论 + .slice(-3)（与服务端 buildCommentsPreviewMap 同样保留最近 3），
      // commentCount += 1。detail post cache 也同样 append。下次自然 refetch
      // 时 server 会校准——但常规路径不再触发 N 页拉回。
      const appendToPost = <P extends {
        id: string;
        commentsPreview: FeedComment[];
        commentCount: number;
      }>(
        post: P,
      ): P =>
        post.id !== input.postId
          ? post
          : {
              ...post,
              commentsPreview: [...post.commentsPreview, newComment].slice(-3),
              commentCount: post.commentCount + 1,
            };
      queryClient.setQueriesData<InfiniteData<FeedListResponse>>(
        { queryKey: ["app-feed-paged", baseUrl] },
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  posts: page.posts.map(appendToPost),
                })),
              }
            : current,
      );
      queryClient.setQueryData<FeedListResponse>(
        ["app-feed", baseUrl],
        (current) =>
          current
            ? { ...current, posts: current.posts.map(appendToPost) }
            : current,
      );
      queryClient.setQueryData<FeedPostWithComments>(
        ["app-feed-post", baseUrl, input.postId],
        (current) =>
          current
            ? {
                ...current,
                comments: [...current.comments, newComment],
                commentCount: current.commentCount + 1,
              }
            : current,
      );
      // 「查看全部」展开后（移动端 fullCommentsByPostId）：直接 append 避免再拉一遍。
      if (fullCommentsByPostId[input.postId]) {
        setFullCommentsByPostId((current) => ({
          ...current,
          [input.postId]: [...(current[input.postId] ?? []), newComment],
        }));
      }
    },
  });

  function submitComment(
    postId: string,
    options?: {
      replyTarget?: {
        authorId: string;
        authorName: string;
        commentId: string;
        postId: string;
      } | null;
      // 由调用方显式给出 text — 桌面 row 内 useCallback 把 commentDraft 通过
      // prop 直传上来，避免 page 层闭包 commentDrafts state 让所有 row 的
      // onSubmit 引用每个键码变换。移动端仍走 commentDrafts[postId] 兜底。
      text?: string;
    },
  ) {
    commentMutation.mutate({
      postId,
      replyTarget: options?.replyTarget ?? null,
      text: options?.text ?? commentDrafts[postId] ?? "",
    });
  }

// Round 5 之前 pendingLikePostId 派生自 likeMutation.variables，但
  // useMutation 只追最后一次 mutate；改为读 likeInflightPostIds 让多 row
  // 并发能各自追踪。保留兼容旧名给本文件后面的 row callback / mobile
  // bubble 引用 (但都改成 has() 查询)。
  // Round 4：桌面端要并发跟踪多条 row 的 inflight 状态，单值 `pendingCommentPostId`
  // 已不够用。这里保留旧名给移动端 commentBar 兜 `.has()`（移动端只能有一条
  // 评论 bar 打开），桌面端走 commentInflightPostIds 直传。
  const isCommentPendingForPost = (postId: string) =>
    commentInflightPostIds.has(postId);
  // blockedCharacterIds + visiblePosts 之前每 render 都 new Set / new Array：
  // 桌面 workspace 拿 posts={visiblePosts} 作 prop，引用每次都换 → workspace
  // 内部 useEffect 依赖 posts 的（比如 selectedPostId 校验、scrollIntoView lock）
  // 全部 re-run，DesktopFeedList → 每条 Row 跟着 re-render。打字、点赞气泡、
  // 滚动这些高频路径下都跟着抖。两层都包 useMemo，保住引用稳定。
  const blockedCharacterIds = useMemo(
    () =>
      new Set((blockedQuery.data ?? []).map((item) => item.characterId)),
    [blockedQuery.data],
  );
  const visiblePosts = useMemo(
    () =>
      feedPosts.filter(
        (post) =>
          post.authorType !== "character" ||
          !blockedCharacterIds.has(post.authorId),
      ),
    [feedPosts, blockedCharacterIds],
  );
  // 收藏命中查每条 row 一次走 includes：100 条 post × 50 个收藏 ≈ O(N×M)
  // 数组扫，每次 page render 都重做。落成 Set + useCallback 一举两得 ——
  // 查询 O(1)，闭包引用稳定不再让 workspace 因为 isPostFavorite prop 变天
  // 而 re-render。
  const favoriteSourceIdSet = useMemo(
    () => new Set(favoriteSourceIds),
    [favoriteSourceIds],
  );
  const isPostFavorite = useCallback(
    (postId: string) => favoriteSourceIdSet.has(`feed-${postId}`),
    [favoriteSourceIdSet],
  );

  function toggleFavoriteByPostId(postId: string) {
    const post = visiblePosts.find((item) => item.id === postId);
    if (!post) {
      return;
    }

    const sourceId = `feed-${post.id}`;
    const collected = favoriteSourceIdSet.has(sourceId);
    const nextFavorites = collected
      ? removeDesktopFavorite(sourceId)
      : upsertDesktopFavorite({
          id: `favorite-${sourceId}`,
          sourceId,
          category: "feed",
          title: post.authorName,
          description: getFeedSummaryText(post),
          meta: formatTimestamp(post.createdAt),
          to: `/tabs/feed${buildFeedRouteHash({ postId: post.id }) ? `#${buildFeedRouteHash({ postId: post.id })}` : ""}`,
          badge: t(msg`广场动态`),
          avatarName: post.authorName,
          avatarSrc: post.authorAvatar,
        });

    setFavoriteSourceIds(
      nextFavorites.map((favorite) => favorite.sourceId),
    );
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

  function resetFeedToFirstPage() {
    queryClient.setQueryData<InfiniteData<FeedListResponse>>(
      ["app-feed-paged", baseUrl],
      (current) =>
        current
          ? {
              pages: current.pages.slice(0, 1),
              pageParams: current.pageParams.slice(0, 1),
            }
          : current,
    );
    resetDesktopAutoPrefetchCounter();
  }

  function handleStatusBack() {
    if (navigateToRouteStateReturn()) {
      return;
    }

    resetFeedToFirstPage();
    void feedQuery.refetch();
    void blockedQuery.refetch();
  }

  function handleRetryLoad() {
    resetFeedToFirstPage();
    void feedQuery.refetch();
    void blockedQuery.refetch();
  }

  // 下拉刷新：只替换头部 page 1，保留已加载的 page 2+，避免列表瞬间变短引发
  // 橡皮筋反弹 + 串行 fetchNextPage 把内容堆回来；新发布的内容若把老 page 2
  // 起点往下挤，由 feedPosts 的 id 去重 useMemo 兜底。和 moments-page 对齐。
  const handlePullRefresh = async () => {
    const key = ["app-feed-paged", baseUrl];
    try {
      await Promise.all([
        getFeed(1, 20, baseUrl).then((fresh) => {
          queryClient.setQueryData<InfiniteData<FeedListResponse>>(
            key,
            (current) => {
              if (!current || current.pages.length === 0) {
                return { pages: [fresh], pageParams: [1] };
              }
              return {
                pages: [fresh, ...current.pages.slice(1)],
                pageParams: current.pageParams,
              };
            },
          );
        }),
        ownerId ? blockedQuery.refetch() : Promise.resolve(null),
      ]);
      // R18-R19 给底部"加载更多失败 · 点击重试"挂上之后，下拉刷新成功了
      // 这条红条不会自己消失（手动 setQueryData 不会重置 useInfiniteQuery 的
      // isFetchNextPageError）。用户刚刚下拉成功又看到「加载更多失败」会以为
      // 整张 feed 还在抖。pull-refresh 成功通常意味着网络也恢复了，顺手再
      // 试一次 fetchNextPage，成功就把错误位清掉、observer 也能继续自动加载；
      // 失败就维持原状让用户继续走「点击重试」路径。
      if (hasNextFeedPage && isFetchNextFeedPageError) {
        void fetchNextFeedPage();
      }
    } catch (error) {
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        error instanceof Error
          ? t(msg`广场刷新失败：${error.message}`)
          : t(msg`广场刷新失败，请稍后重试。`),
      );
    }
  };

  const { containerRef: pullContainerRef, state: pullState } =
    usePullToRefresh({
      onRefresh: handlePullRefresh,
      enabled: !isDesktopLayout,
    });

  function openMobileFeedPublishPage() {
    const currentHash = hash.startsWith("#") ? hash.slice(1) : hash;
    void navigate({
      to: "/discover/feed/publish",
      hash: buildMobileFeedPublishRouteHash({
        returnPath: pathname,
        returnHash: currentHash || undefined,
      }),
    });
  }

  function openCharacterDetail(
    authorId: string,
    authorType: FeedAuthorType,
  ) {
    if (authorType !== "character" || !authorId) {
      return;
    }
    const currentHash = hash.startsWith("#") ? hash.slice(1) : hash;
    void navigate({
      to: "/character/$characterId",
      params: { characterId: authorId },
      hash: buildCharacterDetailRouteHash({
        returnPath: pathname,
        returnHash: currentHash || undefined,
      }),
    });
  }

  function handleEmptyStateAction() {
    if (navigateToRouteStateReturn()) {
      return;
    }

    openMobileFeedPublishPage();
  }
  const interactionActionLabel = safeReturnPath
    ? t(msg`返回上一页`)
    : t(msg`重试读取`);

  useEffect(() => {
    setDesktopAvatarPopover(null);
  }, [hash, pathname]);

  // StrictMode dev 下 useEffect 会跑两次（mount → cleanup → mount），原本拆成
  // 两个 effect（这里只 reset+清 notice / 下面 consume publish flash）会因为
  // consumeFeedPublishFlash 不幂等（第二次返回 null）+ 本 effect 再跑一遍
  // setNotice("") 把刚显的发布提示清掉 → 用户从发表页跳回广场看不到任何成功提示。
  // 合并成一个 effect + 用 ref 缓存第一次 consume 的结果，dev/prod 行为一致；
  // 同时把 setNotice 的写入留到 flash 取完之后，再考虑要不要清。
  // 注意：isDesktopLayout 只在 publishFlashRef.taken 第一次为 false 时被读，
  // 取过一次就锁住——所以它*不能*作为 effect deps，否则窗口宽度跨 960px 时
  // 用户半路写到一半的评论草稿、compose 文本全被这层 reset 抹掉。用 ref
  // 兜住"挂载那一刻是否桌面"。
  const publishFlashRef = useRef<{ taken: boolean; value: string | null }>({
    taken: false,
    value: null,
  });
  const isDesktopLayoutAtMountRef = useRef(isDesktopLayout);
  useEffect(() => {
    resetComposeDraft();
    setCommentDrafts({});
    setActionBubble(null);
    setCommentBarTarget(null);
    setShowCompose(false);
    setFullCommentsByPostId({});
    setLoadingFullCommentsPostId(null);
    // baseUrl 改变（切换账户）→ feedQuery 变成全新 query，但 ref 计数器是
    // 跨账户共享的：上一个账户已经把它打满到 cap 时，新账户的页 1 加载完
    // 后自动 prefetch 直接被卡住，只剩 20 条得用户自己滚才能再翻。
    resetDesktopAutoPrefetchCounter();

    if (!publishFlashRef.current.taken) {
      publishFlashRef.current.taken = true;
      publishFlashRef.current.value = isDesktopLayoutAtMountRef.current
        ? null
        : consumeFeedPublishFlash();
    }
    const flash = publishFlashRef.current.value;
    if (flash) {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(flash);
      return;
    }

    setNoticeActionLabel(null);
    setNoticeAction(null);
    setNotice(""); // i18n-ignore-line
  }, [baseUrl, resetComposeDraft]);

  async function expandFullComments(postId: string) {
    if (loadingFullCommentsPostId === postId) return;
    if (fullCommentsByPostId[postId]) return;
    setLoadingFullCommentsPostId(postId);
    try {
      const all = await listFeedComments(postId, baseUrl);
      setFullCommentsByPostId((current) => ({
        ...current,
        [postId]: all,
      }));
    } catch (error) {
      setNoticeTone("info");
      setNoticeActionLabel(t(msg`重试`));
      setNoticeAction(() => () => {
        void expandFullComments(postId);
      });
      setNotice(
        error instanceof Error
          ? t(msg`读取全部评论失败：${error.message}`)
          : t(msg`读取全部评论失败，请稍后重试。`),
      );
    } finally {
      setLoadingFullCommentsPostId((current) =>
        current === postId ? null : current,
      );
    }
  }

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
    // 带「重试」之类操作按钮的提示（评论失败/分享失败/读全部评论失败）以前
    // 也被无脑 2.4s 自动收掉，用户根本来不及瞄到按钮就消失了。带 action 的
    // 一律不自动 dismiss，由下次提示覆盖或用户手动点击 action 后再清。
    if (noticeAction) {
      return;
    }
    const timer = window.setTimeout(() => {
      setNotice(""); // i18n-ignore-line
      setNoticeActionLabel(null);
      setNoticeAction(null);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [notice, noticeAction]);

  useEffect(() => {
    setDesktopSelectedPostId(routeSelectedPostId);
  }, [routeSelectedPostId]);

  // 一旦在桌面布局下落到 /tabs/feed 就锁定；之后用户从这里 navigate 到
  // /character/$id 等兄弟路由时，TanStack 会先把 location.pathname 切走、
  // 再 unmount 旧 page，期间这里的 useEffect 不能再 replace 回 /tabs/feed
  // 把目标导航吞掉（与 chat-list/contacts/search 已踩过的同类坑）。
  const desktopFeedPathStabilizedRef = useRef(false);

  useEffect(() => {
    if (
      !isDesktopLayout ||
      (routeSelectionAlreadySynced &&
        normalizedHash ===
          (buildFeedRouteHash({
            postId: desktopSelectedPostId,
            returnPath: safeReturnPath,
            returnHash: safeReturnHash,
          }) ?? ""))
    ) {
      if (!desktopPathMismatch) {
        desktopFeedPathStabilizedRef.current = true;
      }
      return;
    }
    // pathname 已不在 /tabs/feed 上：要么是用户主动跳走（hash 同步无意义），
    // 要么是首次从 /discover/feed 旧路径进来（需要 canonicalize 一次）。
    // 已经在 /tabs/feed 上稳定过的会话不再做路径 replace，避免吞掉出站导航。
    if (desktopPathMismatch && desktopFeedPathStabilizedRef.current) {
      return;
    }
    if (!desktopPathMismatch) {
      desktopFeedPathStabilizedRef.current = true;
    }

    void navigate({
      to: "/tabs/feed",
      hash: buildFeedRouteHash({
        postId: desktopSelectedPostId,
        returnPath: safeReturnPath,
        returnHash: safeReturnHash,
      }),
      replace: true,
    });
  }, [
    desktopPathMismatch,
    desktopSelectedPostId,
    isDesktopLayout,
    navigate,
    normalizedHash,
    routeSelectionAlreadySynced,
    safeReturnHash,
    safeReturnPath,
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
      !routeSelectedPostId ||
      typeof document === "undefined"
    ) {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(`feed-post-${routeSelectedPostId}`)
        ?.scrollIntoView({
          // behavior: "smooth" 在 hash auto-load 的多 page chain 拉过来期间
          // 反复触发 scrollIntoView，动画被打断 + IntersectionObserver 又触底拉
          // 下一页，最终 scrollTop 偏过 target ~650px（实测肉眼能看到的是错位
          // ~2 张卡片的距离）。改 auto / instant，每次 length 变化都 hard-snap
          // 到 target，新 page 加载不影响已经定位好的 scrollTop。
          behavior: "auto",
          block: "start",
        });
    });
  }, [isDesktopLayout, routeSelectedPostId, visiblePosts.length]);

  // 用户通过 #post=<id> 进来（分享链接 / 收藏 / 站内跳转）但目标 post 不在
  // 首屏 20 条里时，老逻辑只 scrollIntoView 找不到 → 静默失败，用户看到的
  // 是普通 feed 列表，根本不知道自己点的链接对应哪条。
  // 这里在目标 post 还没加载且还有下一页时自动 fetchNextPage，IntersectionObserver
  // 的兜底之上再多一层"跟着 hash 翻页"的逻辑；找到后上面的 scrollIntoView 自然
  // 把它滚进视口。
  useEffect(() => {
    if (isDesktopLayout || !routeSelectedPostId) {
      return;
    }
    const targetLoaded = visiblePosts.some(
      (post) => post.id === routeSelectedPostId,
    );
    if (targetLoaded) {
      return;
    }
    if (!hasNextFeedPage || isFetchingNextFeedPage) {
      return;
    }
    // Round 19：fetchNextPage 失败时这条 effect 仍会在每次 visiblePosts /
    // isFetchingNextFeedPage flip 时再触发——继续打后端、永远找不到目标。
    // 命中错误就让位给底部的「点击重试」按钮，由用户决定要不要再跳。
    if (isFetchNextFeedPageError) {
      return;
    }
    void fetchNextFeedPage();
  }, [
    isDesktopLayout,
    routeSelectedPostId,
    visiblePosts,
    hasNextFeedPage,
    isFetchingNextFeedPage,
    isFetchNextFeedPageError,
    fetchNextFeedPage,
  ]);

  // 后端给的 page 1 整页 20 条全是被屏蔽角色（用户跟一堆 wiki 走查角色发
  // 生过恩怨，刷出来全是同人 cluster），visiblePosts 直接为空，触发 R15
  // 加的「广场动态都被你屏蔽了」空态——但底部 sentinel 是 gate 在
  // `visiblePosts.length > 0` 才挂上的，没 visiblePost 也就没 observer 自动
  // 翻页，用户陷在空态里看不到后面 200 多条非屏蔽内容。这条 effect 跟
  // 「目标驱动拉页」对齐，专门处理「有后端数据 + 全被过滤 + 还有下一页」
  // 的情况：自动翻页直到出现非屏蔽内容或没有下一页。
  // 闸门齐全：依赖 blockedQuery 已经 ready（visiblePosts 是 feedPosts -
  // blocked，blocked 还没回来时 visiblePosts 可能虚为空 → 不要拉），
  // hasNext + !isFetching + !isFetchNextPageError 一票否决。
  // Round 3 桌面端走查：原本 `if (isDesktopLayout) return;` 直接跳过——桌面
  // auto-prefetch 三页打满后若全是屏蔽角色，DesktopFeedList 会渲染「广场还没
  // 有新动态 / 发广场动态」CTA，后台 200+ 条非屏蔽内容用户看不到也不知道在哪
  // 找。把 effect 同样下放给桌面：桌面没有触底 sentinel observer 兜底，
  // 更需要这一层"全被过滤就自动翻页"。
  useEffect(() => {
    if (visiblePosts.length > 0) return;
    if (feedPosts.length === 0) return;
    if (blockedQuery.isPending) return;
    if (!hasNextFeedPage || isFetchingNextFeedPage) return;
    if (isFetchNextFeedPageError) return;
    void fetchNextFeedPage();
  }, [
    visiblePosts.length,
    feedPosts.length,
    blockedQuery.isPending,
    hasNextFeedPage,
    isFetchingNextFeedPage,
    isFetchNextFeedPageError,
    fetchNextFeedPage,
  ]);

  async function handleSharePost(post: (typeof visiblePosts)[number]) {
    const shareHash = buildFeedRouteHash({
      postId: post.id,
    });
    const sharePath = `${pathname}${shareHash ? `#${shareHash}` : ""}`;
    const shareUrl = buildPublicShareUrl(sharePath);
    const postSummary = getFeedSummaryText(post);
    const summaryText = `${post.authorName}：${postSummary}\n${shareUrl}`;

    if (nativeMobileShareSupported) {
      const shared = await shareWithNativeShell({
        title: t(msg`${post.authorName} 的广场动态`),
        text: t(msg`${post.authorName}：${postSummary}`),
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
        void handleSharePost(post);
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
        void handleSharePost(post);
      });
      setNotice(
        nativeMobileShareSupported
          ? t(msg`系统分享失败，请稍后重试。`)
          : t(msg`复制动态摘要失败，请稍后重试。`),
      );
    }
  }

  // 桌面 row 用 React.memo 来跳过非自己条目的 re-render，前提是 page 传下去的
  // 回调引用要稳。这些 callback 历史上都是内联 `(...args) => setX(...)`，每次
  // 渲染都换 identity → workspace → list → row 一路穿透 memo，敲一下评论框 80
  // 条 row 全跑一遍 stripToolCallSyntax / Map 构建 / MomentMediaGallery 协调。
  // 在这里收敛成 useCallback：只有真依赖（commentMutation.mutate /
  // desktopReplyTarget / likeMutation.mutate）变了才换 identity。setState 类
  // setter 本身是 stable 的，依赖列表里都不用写。
  const commentMutationMutate = commentMutation.mutate;
  const likeMutationMutate = likeMutation.mutate;
  const createMutationMutate = createMutation.mutate;
  const handleRowCommentChange = useCallback(
    (postId: string, value: string) => {
      setCommentDrafts((current) => ({ ...current, [postId]: value }));
    },
    [],
  );
  const handleRowCommentSubmit = useCallback(
    (postId: string, text: string) => {
      // text 由 row 顺手传上来 — 不再读 commentDrafts，page callback 跨键码稳定。
      commentMutationMutate({
        postId,
        replyTarget:
          desktopReplyTarget?.postId === postId ? desktopReplyTarget : null,
        text,
      });
    },
    [commentMutationMutate, desktopReplyTarget],
  );
  const handleRowLike = useCallback(
    (postId: string) => {
      likeMutationMutate(postId);
    },
    [likeMutationMutate],
  );
  const handleRowToggleFavorite = useCallback(
    (postId: string) => {
      toggleFavoriteByPostId(postId);
    },
    // toggleFavoriteByPostId 闭包了 visiblePosts/favoriteSourceIdSet — 这两个
    // 只在真数据变（fetch / 收藏切换）时换，键盘敲字不会重生成。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiblePosts, favoriteSourceIdSet],
  );
  const handleRowStartCommentReply = useCallback((comment: FeedComment) => {
    setDesktopReplyTarget({
      authorId: comment.authorId,
      authorName: comment.authorName,
      commentId: comment.id,
      postId: comment.postId,
    });
  }, []);
  const handleRowCancelCommentReply = useCallback(() => {
    setDesktopReplyTarget(null);
  }, []);
  // popover 走"查看资料"/"朋友圈"进 character 详情 / friend-moments 时，
  // 必须把 returnPath 显式塞成 /tabs/feed，否则 DesktopMessageAvatarPopover
  // 内置默认 profileReturnPath = momentsReturnPath = "/tabs/chat" — 广场上
  // 的用户点头像看完资料按返回会被踹进聊天 tab，刚滑了 4 页找到的 post
  // 位置和选中态全丢。
  const buildFeedAvatarNavigationContext = useCallback((postId: string) => {
    const returnHash = buildFeedRouteHash({ postId }) || undefined;
    return {
      profileReturnPath: "/tabs/feed",
      profileReturnHash: returnHash,
      momentsReturnPath: "/tabs/feed",
      momentsReturnHash: returnHash,
    };
  }, []);
  const handleRowSelectCommentAuthor = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, comment: FeedComment) => {
      if (comment.authorType === "character") {
        setDesktopAvatarPopover({
          anchorElement: event.currentTarget,
          kind: "character",
          characterId: comment.authorId,
          fallbackAvatar: comment.authorAvatar,
          fallbackName: comment.authorName,
          navigationContext: buildFeedAvatarNavigationContext(comment.postId),
        });
      } else if (comment.authorType === "user") {
        setDesktopAvatarPopover({
          anchorElement: event.currentTarget,
          kind: "owner",
        });
      }
    },
    [buildFeedAvatarNavigationContext],
  );
  const handleRowSelectPostAuthor = useCallback(
    ({
      anchorElement,
      post,
    }: {
      anchorElement: HTMLButtonElement;
      post: typeof visiblePosts[number];
    }) => {
      // 跟 desktop-moments-feed 对齐：post 作者头像/名字也得能点；之前
      // 只评论里的作者可点，post 头部却只有 div，找居民资料只能去通讯录。
      if (post.authorType === "character") {
        setDesktopAvatarPopover({
          anchorElement,
          kind: "character",
          characterId: post.authorId,
          fallbackAvatar: post.authorAvatar,
          fallbackName: post.authorName,
          navigationContext: buildFeedAvatarNavigationContext(post.id),
        });
      } else if (post.authorType === "user") {
        setDesktopAvatarPopover({
          anchorElement,
          kind: "owner",
        });
      }
    },
    [buildFeedAvatarNavigationContext],
  );
  const handleRowShare = useCallback((postId: string) => {
    setShareCardPostId(postId);
  }, []);

  if (isDesktopLayout) {
    const errors: string[] = [];

    if (feedQuery.isError && feedQuery.error instanceof Error) {
      errors.push(feedQuery.error.message);
    }

    if (blockedQuery.isError && blockedQuery.error instanceof Error) {
      errors.push(blockedQuery.error.message);
    }

    return (
      <Suspense
        fallback={
          <RouteRedirectState
            title={t(msg`正在打开桌面发现`)}
            description={t(
              msg`正在载入桌面看一看工作区，马上显示当前动态内容。`,
            )}
            loadingLabel={t(msg`载入桌面发现工作区...`)}
          />
        }
      >
        <DesktopFeedWorkspace
          baseUrl={baseUrl}
          canAddImages={composeDraft.canAddImages}
          canAddVideo={composeDraft.canAddVideo}
          commentDrafts={commentDrafts}
          commentErrorMessage={
            commentMutation.isError && commentMutation.error instanceof Error
              ? commentMutation.error.message
              : null
          }
          commentPendingPostIds={commentInflightPostIds}
          composeErrorMessage={
            composeDraft.mediaError ??
            (createMutation.isError && createMutation.error instanceof Error
              ? createMutation.error.message
              : null)
          }
          createPending={createMutation.isPending}
          errors={errors}
          hasNextPage={feedQuery.hasNextPage}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          isFetchNextPageError={isFetchNextFeedPageError}
          rawLoadedCount={feedPosts.length}
          imageDrafts={composeDraft.imageDrafts}
          isLoading={feedQuery.isLoading}
          serverTotal={
            // 用最新一页的 total（中间有删/加 post 时数字会跟着变），fallback
            // 到首页。两个都没拿到就交给 toolbar 自己用 loadedCount 兜。
            feedQuery.data?.pages.at(-1)?.total ??
            feedQuery.data?.pages[0]?.total
          }
          likeErrorMessage={
            likeMutation.isError && likeMutation.error instanceof Error
              ? likeMutation.error.message
              : null
          }
          likePendingPostIds={likeInflightPostIds}
          ownerAvatar={ownerAvatar}
          ownerUsername={ownerUsername}
          posts={visiblePosts}
          onRequestMore={desktopRequestMore}
          onRetryNextPage={() => {
            // 用户在 fetchNextPage 失败的红条上点「重试」，desktopRequestMore
            // 自身 gate 在 isFetchNextPageError 上会直接 return；这里走原始
            // fetchNextPage 让 react-query 清掉错误标记并重新发请求。
            if (hasNextFeedPage && !isFetchingNextFeedPage) {
              void fetchNextFeedPage();
            }
          }}
          onSelectedPostChange={setDesktopSelectedPostId}
          routeSelectedPostId={routeSelectedPostId}
          showCompose={showCompose}
          successNotice={notice}
          text={composeDraft.text}
          videoDraft={composeDraft.videoDraft}
          isPostFavorite={isPostFavorite}
          setShowCompose={(next) => {
            // 上一次发布失败 / 选错图片 → 关闭面板 → 重开：composeErrorMessage
            // 还会渲染上次的 createMutation.error 和 composeDraft.mediaError，
            // 用户没法分辨"这是上次失败"还是"这次又失败"。开/关一次显式
            // reset，让面板每次开都是干净状态（草稿文本/图片/视频留着）。
            if (createMutation.isError) {
              createMutation.reset();
            }
            if (composeDraft.mediaError) {
              composeDraft.setMediaError(null);
            }
            setShowCompose(next);
          }}
          commentReplyTarget={desktopReplyTarget}
          onCancelCommentReply={handleRowCancelCommentReply}
          onCommentChange={handleRowCommentChange}
          onCommentSubmit={handleRowCommentSubmit}
          onStartCommentReply={handleRowStartCommentReply}
          onSelectCommentAuthor={handleRowSelectCommentAuthor}
          onSelectPostAuthor={handleRowSelectPostAuthor}
          onCreate={() => createMutationMutate()}
          onImageFilesSelected={(files) => {
            void handleImageFilesSelected(files);
          }}
          onLike={handleRowLike}
          onRemoveImage={(id) => composeDraft.removeImageDraft(id)}
          onRemoveVideo={() => composeDraft.clearVideoDraft()}
          onRefresh={() => {
            resetFeedToFirstPage();
            void feedQuery.refetch();
            if (ownerId) {
              void blockedQuery.refetch();
            }
          }}
          onTextChange={composeDraft.setText}
          onToggleFavorite={handleRowToggleFavorite}
          onShare={handleRowShare}
          onVideoFileSelected={(file) => {
            void handleVideoFileSelected(file);
          }}
        />
        <FeedPostShareCardModal
          post={
            shareCardPostId
              ? visiblePosts.find((item) => item.id === shareCardPostId) ?? null
              : null
          }
          ownerDisplayName={ownerUsername?.trim() || t(msg`世界主人`)}
          onClose={() => setShareCardPostId(null)}
        />
        {desktopAvatarPopover ? (
          <Suspense fallback={null}>
            {desktopAvatarPopover.kind === "character" ? (
              <DesktopMessageAvatarPopover
                anchorElement={desktopAvatarPopover.anchorElement}
                kind="character"
                characterId={desktopAvatarPopover.characterId}
                fallbackAvatar={desktopAvatarPopover.fallbackAvatar}
                fallbackName={desktopAvatarPopover.fallbackName}
                navigationContext={desktopAvatarPopover.navigationContext}
                onClose={() => setDesktopAvatarPopover(null)}
              />
            ) : (
              <DesktopMessageAvatarPopover
                anchorElement={desktopAvatarPopover.anchorElement}
                kind="owner"
                onClose={() => setDesktopAvatarPopover(null)}
              />
            )}
          </Suspense>
        ) : null}
      </Suspense>
    );
  }

  return (
    <AppPage className="space-y-0 px-0 pb-0 pt-0">
      <TabPageTopBar
        title={t(msg`广场动态`)}
        subtitle={t(msg`世界居民公开可见`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            onClick={() =>
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
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border-0 bg-transparent text-[color:var(--text-primary)] active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </Button>
        }
        rightActions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border-0 bg-transparent text-[color:var(--text-primary)] active:bg-black/[0.05]"
            onClick={openMobileFeedPublishPage}
            aria-label={t(msg`发一条广场动态`)}
          >
            <PenSquare size={17} />
          </Button>
        }
      />

      <div ref={pullContainerRef} className="relative">
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
            transition: pullState.pulling
              ? "none"
              : "transform 220ms ease-out",
          }}
        >
      <div className="space-y-2.5 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-2.5">
        <section className="space-y-2">
          <div className="px-1">
            <div className="text-[11px] text-[color:var(--text-muted)]">
              {t(msg`最近动态`)}
            </div>
            <div className="mt-0.5 text-[10px] leading-4 text-[color:var(--text-muted)]">
              {t(msg`这里不只看朋友，也能看到世界里的居民正在说什么。`)}
            </div>
          </div>
          {notice ? (
            <InlineNotice
              className="rounded-[11px] px-2.5 py-1.5 text-[11px] leading-[1.35rem] shadow-none"
              tone={noticeTone}
            >
              {noticeTone === "info" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1">{notice}</span>
                  <div className="flex items-center gap-1.5">
                    {noticeAction && noticeActionLabel ? (
                      <button
                        type="button"
                        onClick={() => {
                          // Round 1 把 action 提示从 2.4s 自动收掉改成持久显示，
                          // 但忘了清掉旧 notice：用户点「重试」成功后，老错误条
                          // 没人收，挂在屏幕上像没修好一样。先把当前条收掉再调
                          // action；如果重试又失败，setNotice 会重新写新条。
                          const action = noticeAction;
                          setNotice(""); // i18n-ignore-line
                          setNoticeActionLabel(null);
                          setNoticeAction(null);
                          action();
                        }}
                        className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                      >
                        {noticeActionLabel}
                      </button>
                    ) : null}
                    {/* 副按钮：没有具体 noticeAction 时（如下拉刷新失败），
                        给「重试读取/返回上一页」做兜底；已经有 noticeAction
                        时（如展开评论/分享失败），多挂一个无关的 feed refetch
                        反而扰人，改成单纯的「知道了」让用户能手动收掉提示。 */}
                    {noticeAction && noticeActionLabel ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(""); // i18n-ignore-line
                          setNoticeActionLabel(null);
                          setNoticeAction(null);
                        }}
                        className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                      >
                        {t(msg`知道了`)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          // 副按钮触发 handleStatusBack（refetch 整张 feed 或
                          // navigateToRouteStateReturn），但旧实现没顺手清掉这
                          // 条 InlineNotice。下拉刷新失败 → 用户点「重试读取」
                          // → refetch 成功 → 列表回归正常但顶上"广场刷新失败"
                          // 红条还挂着，下次 setNotice 之前永不消失。先把
                          // notice 收掉再走 handleStatusBack；refetch 又失败的
                          // 话 feedQuery.isError 走单独的 danger card 路径，
                          // 不会跟 notice 撞。
                          setNotice(""); // i18n-ignore-line
                          setNoticeActionLabel(null);
                          setNoticeAction(null);
                          handleStatusBack();
                        }}
                        className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                      >
                        {safeReturnPath ? t(msg`返回上一页`) : t(msg`重试读取`)}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                notice
              )}
            </InlineNotice>
          ) : null}
          {feedQuery.isLoading ? (
            <MobileFeedStatusCard
              badge={t(msg`读取中`)}
              title={t(msg`正在刷新广场动态`)}
              description={t(msg`稍等一下，正在同步居民公开动态和互动状态。`)}
              tone="loading"
            />
          ) : null}
          {feedQuery.isError && feedQuery.error instanceof Error ? (
            <MobileFeedStatusCard
              badge={t(msg`读取失败`)}
              title={t(msg`广场动态暂时不可用`)}
              description={feedQuery.error.message}
              tone="danger"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={handleRetryLoad}
                  >
                    {t(msg`重试读取`)}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={handleStatusBack}
                  >
                    {safeReturnPath ? t(msg`返回上一页`) : t(msg`重试读取`)}
                  </Button>
                </div>
              }
            />
          ) : null}

          {visiblePosts.map((post) => {
            const displayText = stripToolCallSyntax(post.text);
            const postSummaryText = getFeedSummaryText(post);
            const summaryText = displayText ? "" : postSummaryText;

            return (
              <div key={post.id} className="yj-list-item-virtual-card">
              <SocialPostCard
                cardId={`feed-post-${post.id}`}
                authorName={post.authorName}
                authorAvatar={post.authorAvatar}
                onAuthorClick={
                  post.authorType === "character"
                    ? () =>
                        openCharacterDetail(post.authorId, post.authorType)
                    : undefined
                }
                meta={`${formatTimestamp(post.createdAt)} · ${
                  post.authorType === "user"
                    ? t(msg`世界主人`)
                    : t(msg`居民动态`)
                }`}
                headerActions={
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-card-hover)] hover:text-[color:var(--text-primary)]"
                      onClick={() => setShareCardPostId(post.id)}
                      aria-label={t(msg`生成分享图卡`)}
                    >
                      <ImageIcon size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-card-hover)] hover:text-[color:var(--text-primary)]"
                      onClick={() => void handleSharePost(post)}
                      aria-label={
                        nativeMobileShareSupported
                          ? t(msg`分享这条动态`)
                          : t(msg`复制这条动态摘要`)
                      }
                    >
                      {nativeMobileShareSupported ? (
                        <Share2 size={15} />
                      ) : (
                        <Copy size={15} />
                      )}
                    </Button>
                  </div>
                }
                body={
                  <div className="space-y-3">
                    {post.authorType === "user" ? (
                      <div className="inline-flex rounded-full bg-[rgba(7,193,96,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#07c160]">
                        {t(msg`居民公开可见`)}
                      </div>
                    ) : null}
                    {displayText ? (
                      <div className="whitespace-pre-wrap break-words">
                        {displayText}
                      </div>
                    ) : null}
                    {post.media.length > 0 ? (
                      <MomentMediaGallery
                        contentType={resolveFeedMomentContentType(post.media)}
                        media={post.media}
                        variant="mobile"
                      />
                    ) : null}
                  </div>
                }
                summary={
                  post.likeCount > 0 || post.commentCount > 0
                    ? `${t(msg`${post.likeCount} 赞`)} · ${t(
                        msg`${post.commentCount} 评论`,
                      )}`
                    : summaryText || undefined
                }
                actions={
                  post.canInteract ? (
                    <div className="flex w-full justify-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setActionBubble({ postId: post.id, anchorRect: rect });
                        }}
                        aria-label={t(msg`更多操作`)}
                        className="inline-flex h-7 w-9 items-center justify-center rounded-[4px] bg-[#F2F2F2] text-[#4C4C4C] active:bg-[#E5E5E5]"
                      >
                        <MoreHorizontalDots />
                      </button>
                    </div>
                  ) : null
                }
                secondary={(() => {
                  const expandedComments = fullCommentsByPostId[post.id] ?? null;
                  // 历史 DB 里可能残留 text="" 的鬼影评论（后端校验之前 curl 直发的），
                  // 以及 AI 角色把整段 CoT prose 当评论存进来（gpt-4.1 等非推理模型，
                  // 没 <think> 包裹，server 兜不住）。两种都经 stripToolCallSyntax 后
                  // 变 ""，渲染层一起过掉，否则会渲出 "w：" 只剩冒号的空评论占位。
                  const renderedComments = (
                    expandedComments ?? post.commentsPreview
                  ).filter(
                    (comment) =>
                      stripToolCallSyntax(comment.text).trim().length > 0,
                  );
                  // preview 里全是被过滤掉的脏评论（gpt-4.1 等模型把 CoT prose 当
                  // 广场评论存进来 → stripToolCallSyntax 后变 ""），但 commentCount
                  // 仍 > 0：之前 return null 把「查看全部 N 条评论」也一并吞掉，
                  // header summary 写「1 评论」但用户点不进去 — 评论被彻底藏起来。
                  // 留出 expand 按钮入口；展开后若全量也全是脏评论，给一行占位。
                  const showExpandButton =
                    post.commentCount > renderedComments.length &&
                    !expandedComments;
                  const expandedAllFiltered =
                    Boolean(expandedComments) &&
                    renderedComments.length === 0 &&
                    post.commentCount > 0;
                  if (
                    renderedComments.length === 0 &&
                    !showExpandButton &&
                    !expandedAllFiltered
                  ) {
                    return null;
                  }
                  // 展开「查看全部 N 条评论」后 renderedComments 体量可能上百。
                  // 旧逻辑给每条评论都 .find 一遍找被回复评论 → O(N²)，100 条 = 1 万次
                  // 字符串比较，每次父组件 setState（如点赞气泡）整张广场重渲都会重算。
                  // 落成 Map 一次 O(N) 建好，每条 O(1) 命中。
                  const commentById = new Map(
                    renderedComments.map((item) => [item.id, item]),
                  );
                  return (
                    <div className="overflow-hidden rounded-[3px] border border-[#EDEDED] bg-[#F7F7F7]">
                      <div className="space-y-0.5 px-2.5 py-1.5 text-[13px] leading-[22px]">
                        {renderedComments.map((comment) => {
                          const replyToComment = comment.replyToCommentId
                            ? commentById.get(comment.replyToCommentId) ?? null
                            : null;
                          // commentsPreview 只截最后 3 条；当前评论的被回复评论可能不在 preview 里。
                          // 优先用 renderedComments 里找到的（自带 authorType，能渲成可点按钮），
                          // 退化时用 server 注入的 replyToAuthorName（纯文本，无 authorType）。
                          const replyToName =
                            replyToComment?.authorName ??
                            comment.replyToAuthorName ??
                            null;
                          const cleanCommentText = stripToolCallSyntax(comment.text);
                          const openReply = () => {
                            if (!post.canInteract) return;
                            setCommentBarTarget({
                              postId: post.id,
                              replyTo: {
                                authorId: comment.authorId,
                                authorName: comment.authorName,
                                commentId: comment.id,
                              },
                            });
                          };
                          // 评论作者名字用蓝色 #576B95 显示，过去无脑包成 <button> —
                          // 但 openCharacterDetail 对 authorType==='user'（世界主人自己）
                          // 直接 return，按起来视觉是"可点"实际无任何反应，是 round 3
                          // 修过的 post 头像同款误导。authorType=character 才渲成 button。
                          const authorIsCharacter =
                            comment.authorType === "character";
                          const replyAuthorIsCharacter =
                            replyToComment?.authorType === "character";
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
                              className="block w-full cursor-pointer text-left text-[#1A1A1A] active:bg-[#EFEFEF]"
                            >
                              {/* 长名字（wiki 走查角色叫 "走查词条_1778866835578221688"、
                                  群里改备注成一句话等）会按字宽 wrap，把后面的
                                  「回复 X：评论正文」推到下一行甚至撞断句。
                                  跟 wechat-moment-card 对齐：作者名 + 被回复名都
                                  套 inline-block + truncate + max-w-[160px]，单
                                  名字最多占一行，超出 …。 */}
                              {authorIsCharacter ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openCharacterDetail(
                                      comment.authorId,
                                      comment.authorType,
                                    );
                                  }}
                                  className="inline-block max-w-[160px] truncate align-bottom text-[#576B95] hover:opacity-80"
                                  title={comment.authorName}
                                >
                                  {comment.authorName}
                                </button>
                              ) : (
                                <span
                                  className="inline-block max-w-[160px] truncate align-bottom text-[#576B95]"
                                  title={comment.authorName}
                                >
                                  {comment.authorName}
                                </span>
                              )}
                              {replyToName ? (
                                <>
                                  <span> {t(msg`回复`)} </span>
                                  {replyToComment && replyAuthorIsCharacter ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openCharacterDetail(
                                          replyToComment.authorId,
                                          replyToComment.authorType,
                                        );
                                      }}
                                      className="inline-block max-w-[160px] truncate align-bottom text-[#576B95] hover:opacity-80"
                                      title={replyToName}
                                    >
                                      {replyToName}
                                    </button>
                                  ) : (
                                    <span
                                      className="inline-block max-w-[160px] truncate align-bottom text-[#576B95]"
                                      title={replyToName}
                                    >
                                      {replyToName}
                                    </span>
                                  )}
                                </>
                              ) : null}
                              <span>：{cleanCommentText}</span>
                            </div>
                          );
                        })}
                        {post.commentCount > renderedComments.length &&
                        !expandedComments ? (
                          <button
                            type="button"
                            onClick={() => {
                              void expandFullComments(post.id);
                            }}
                            disabled={loadingFullCommentsPostId === post.id}
                            className="mt-1 block text-left text-[12px] text-[#576B95] active:opacity-60 disabled:opacity-50"
                          >
                            {loadingFullCommentsPostId === post.id
                              ? t(msg`正在读取全部评论…`)
                              : t(msg`查看全部 ${post.commentCount} 条评论`)}
                          </button>
                        ) : null}
                        {expandedAllFiltered ? (
                          <div className="mt-1 text-[12px] text-[#9A9A9A]">
                            {t(msg`评论暂时无法显示`)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              />
              </div>
            );
          })}

          {likeMutation.isError && likeMutation.error instanceof Error ? (
            <InlineNotice
              tone="info"
              className="rounded-[11px] px-2.5 py-1.5 text-[11px] leading-[1.35rem] shadow-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  {likeMutation.error.message}
                </span>
                {/* 旧按钮是 handleStatusBack（refetch 整张 feed），跟"点赞失败"
                    完全不挨着，用户点完莫名其妙列表重刷一遍但赞没补上。改成
                    真的对失败那条 post 重试一次。 */}
                <button
                  type="button"
                  onClick={() => {
                    const targetPostId = likeMutation.variables;
                    if (targetPostId) {
                      likeMutation.mutate(targetPostId);
                    } else {
                      likeMutation.reset();
                    }
                  }}
                  className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                >
                  {t(msg`重试点赞`)}
                </button>
              </div>
            </InlineNotice>
          ) : null}
          {commentMutation.isError && commentMutation.error instanceof Error ? (
            <InlineNotice
              tone="info"
              className="rounded-[11px] px-2.5 py-1.5 text-[11px] leading-[1.35rem] shadow-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  {commentMutation.error.message}
                </span>
                {/* 同上：refetch 整张 feed 解决不了"评论没发出去"。回放上一次
                    的 mutate 变量（postId + replyTarget），text 现读现用——
                    R15 直接 mutate(variables) 会把失败那一刻的旧 text 又发
                    一遍，但用户在那之后通常已经改过草稿（评论太长被驳回时
                    用户会缩一缩再点"重试发送"），旧 text 直接覆盖用户修改
                    会把刚改完的本意又顶回去。 */}
                <button
                  type="button"
                  onClick={() => {
                    const variables = commentMutation.variables;
                    if (!variables) {
                      commentMutation.reset();
                      return;
                    }
                    const currentDraft =
                      commentDrafts[variables.postId] ?? variables.text;
                    commentMutation.mutate({
                      ...variables,
                      text: currentDraft,
                    });
                  }}
                  className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                >
                  {t(msg`重试发送`)}
                </button>
              </div>
            </InlineNotice>
          ) : null}

          {visiblePosts.length > 0 ? (
            <>
              <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
              {isFetchingNextFeedPage ? (
                <div className="py-3 text-center text-[11px] text-[color:var(--text-muted)]">
                  {t(msg`正在加载更多…`)}
                </div>
              ) : isFetchNextFeedPageError ? (
                /* fetchNextPage 失败后旧逻辑啥也不显示 + observer 还在死循环
                   重试。现在显式渲一条「加载更多失败 · 点击重试」让用户手动
                   触发，且 observer 自动 fetch 已经被 isFetchNextFeedPageError
                   gate 关掉避免后台炸 RTT。 */
                <button
                  type="button"
                  onClick={() => void fetchNextFeedPage()}
                  className="block w-full py-3 text-center text-[11px] text-[#576B95] active:opacity-60"
                >
                  {t(msg`加载更多失败 · 点击重试`)}
                </button>
              ) : !hasNextFeedPage ? (
                <div className="py-3 text-center text-[11px] text-[color:var(--text-muted)]">
                  {t(msg`已经到底了`)}
                </div>
              ) : null}
            </>
          ) : null}

          {!feedQuery.isLoading &&
          !feedQuery.isError &&
          !visiblePosts.length ? (
            feedPosts.length > 0 ? (
              // 后端给了 N 条 post 但全是被屏蔽的角色：旧逻辑统一显示「还没有
              // 新动态 → 你先发一条」，把"被你自己屏蔽掉了"包装成"广场空"，
              // 用户去 contacts 解除屏蔽前根本不知道为什么列表是空的。
              // 进一步：R21 加了「全被屏蔽 → 自动翻下一页」的兜底 effect，
              // 但本空态不挑剔状态直接渲，用户看到的是"广场动态都被你屏蔽了"
              // 静态文案 + 「打开通讯录」按钮——其实后台还在自动翻下一页找
              // 非屏蔽内容。用户来不及反应就点了按钮跳走，后台的努力被抹掉。
              // 翻页还没结束（还在 fetch / 还有下一页 / 没命中错误）时换成
              // loading 文案，让用户知道在等什么；翻完了再降级到原始 CTA。
              isFetchingNextFeedPage ||
              (hasNextFeedPage && !isFetchNextFeedPageError) ? (
                <MobileFeedStatusCard
                  badge={t(msg`广场`)}
                  title={t(msg`正在寻找未屏蔽的动态`)}
                  description={t(
                    msg`当前页的 ${feedPosts.length} 条动态作者都在你的屏蔽名单里，正在自动翻下一页找未屏蔽的居民动态。`,
                  )}
                  tone="loading"
                />
              ) : (
                <MobileFeedStatusCard
                  badge={t(msg`广场`)}
                  title={t(msg`广场动态都被你屏蔽了`)}
                  description={t(
                    msg`当前共 ${feedPosts.length} 条动态作者全部在你的屏蔽名单里。去通讯录里解除屏蔽，或者等其他居民发布新动态。`,
                  )}
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      className="h-8 rounded-full bg-[#07c160] px-3.5 text-[11px] text-white hover:bg-[#06ad56]"
                      onClick={() => void navigate({ to: "/tabs/contacts" })}
                    >
                      {t(msg`打开通讯录`)}
                    </Button>
                  }
                />
              )
            ) : (
              <MobileFeedStatusCard
                badge={t(msg`广场`)}
                title={t(msg`还没有新动态`)}
                description={t(
                  msg`你先发一条居民公开可见的动态，或者等世界里的居民先开口。`,
                )}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 rounded-full bg-[#07c160] px-3.5 text-[11px] text-white hover:bg-[#06ad56]"
                    onClick={handleEmptyStateAction}
                  >
                    {safeReturnPath ? t(msg`返回上一页`) : t(msg`发一条广场动态`)}
                  </Button>
                }
              />
            )
          ) : null}
        </section>
      </div>
        </div>
      </div>

      <FeedPostShareCardModal
        post={
          shareCardPostId
            ? visiblePosts.find((item) => item.id === shareCardPostId) ?? null
            : null
        }
        ownerDisplayName={
          ownerUsername?.trim() || t(msg`世界主人`)
        }
        onClose={() => setShareCardPostId(null)}
      />

      <WeChatActionBubble
        open={Boolean(actionBubble)}
        anchorRect={actionBubble?.anchorRect ?? null}
        liked={
          actionBubble
            ? Boolean(
                visiblePosts.find((item) => item.id === actionBubble.postId)
                  ?.ownerState?.hasLiked,
              )
            : false
        }
        favorited={
          actionBubble
            ? favoriteSourceIdSet.has(`feed-${actionBubble.postId}`)
            : false
        }
        onLike={() => {
          if (!actionBubble) return;
          likeMutation.mutate(actionBubble.postId);
        }}
        onComment={() => {
          if (!actionBubble) return;
          setCommentBarTarget({
            postId: actionBubble.postId,
            replyTo: null,
          });
        }}
        onFavorite={() => {
          if (!actionBubble) return;
          toggleFavoriteByPostId(actionBubble.postId);
        }}
        onClose={() => setActionBubble(null)}
      />

      <WeChatCommentBar
        open={Boolean(commentBarTarget)}
        replyTo={commentBarTarget?.replyTo ?? null}
        value={
          commentBarTarget
            ? (commentDrafts[commentBarTarget.postId] ?? "")
            : ""
        }
        onChange={(value: string) => {
          if (!commentBarTarget) return;
          setCommentDrafts((current) => ({
            ...current,
            [commentBarTarget.postId]: value,
          }));
        }}
        pending={
          commentBarTarget
            ? isCommentPendingForPost(commentBarTarget.postId)
            : false
        }
        onSubmit={() => {
          if (!commentBarTarget) return;
          submitComment(commentBarTarget.postId, {
            replyTarget: commentBarTarget.replyTo
              ? {
                  authorId: commentBarTarget.replyTo.authorId,
                  authorName: commentBarTarget.replyTo.authorName,
                  commentId: commentBarTarget.replyTo.commentId,
                  postId: commentBarTarget.postId,
                }
              : null,
          });
        }}
        onClose={() => setCommentBarTarget(null)}
      />
    </AppPage>
  );
}

function MoreHorizontalDots() {
  return (
    <svg
      width="14"
      height="3"
      viewBox="0 0 14 3"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="2" cy="1.5" r="1.2" />
      <circle cx="7" cy="1.5" r="1.2" />
      <circle cx="12" cy="1.5" r="1.2" />
    </svg>
  );
}

function MobileFeedStatusCard({
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
