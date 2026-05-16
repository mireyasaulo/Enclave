import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { msg } from "@lingui/macro";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  EyeOff,
  MessageCircleMore,
  Music2,
  Play,
  Share2,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  SELF_CHARACTER_ID,
  addFeedComment,
  favoriteFeedPost,
  followChannelAuthor,
  generateChannelPost,
  getChannelAuthorProfile,
  getChannelHome,
  getChannelHomeDecorations,
  getFeedPost,
  likeFeedPost,
  likeFeedComment,
  listFeedComments,
  markFeedPostNotInterested,
  replyFeedComment,
  unfavoriteFeedPost,
  unfollowChannelAuthor,
  unlikeFeedPost,
  viewFeedPost,
  type FeedChannelHomeResponse,
  type FeedChannelHomeSection,
  type FeedComment,
  type FeedPostListItem,
  type FeedPostWithComments,
} from "@yinjie/contracts";
import { AppPage, Button, cn, InlineNotice } from "@yinjie/ui";
import { AvatarChip } from "../components/avatar-chip";
import { ChannelsForwardPicker } from "../components/channels-forward-picker";
import { resolveAppMediaUrl } from "../lib/media-url";
import { ExpandableText } from "../components/expandable-text";
import { RouteRedirectState } from "../components/route-redirect-state";
import { stripToolCallSyntax } from "../features/moments/moment-content";
import {
  buildDesktopChannelsRouteHash,
  parseDesktopChannelsRouteHash,
} from "../features/channels/channels-route-state";
import { getChannelsSectionBadge } from "../features/channels/channels-section-badge";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import {
  readDesktopFavorites,
  removeDesktopFavorite,
  upsertDesktopFavorite,
} from "../features/favorites/favorites-storage";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { formatTimestamp } from "../lib/format";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { normalizePathname } from "../lib/normalize-pathname";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";

const EMPTY_CHANNEL_POSTS: FeedPostListItem[] = [];
const CHANNELS_PAGE_LIMIT = 20;
const DesktopChannelsWorkspace = lazy(async () => {
  const mod =
    await import("../features/desktop/channels/desktop-channels-workspace");
  return { default: mod.DesktopChannelsWorkspace };
});

type FeedCommentReplyTarget = {
  authorId: string;
  authorName: string;
  commentId: string;
  postId: string;
};

export function ChannelsPage() {
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
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const normalizedPathname = normalizePathname(pathname);
  const routeState = useMemo(() => parseDesktopChannelsRouteHash(hash), [hash]);
  const normalizedDesktopReturnPath =
    isDesktopLayout && routeState.returnPath === "/discover/channels"
      ? "/tabs/channels"
      : routeState.returnPath;
  const isDesktopChannelsRoute =
    normalizedPathname === "/tabs/channels" ||
    normalizedPathname === "/channels" ||
    normalizedPathname === "/discover/channels";
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const safeReturnPath =
    normalizedDesktopReturnPath &&
    !isDesktopOnlyPath(normalizedDesktopReturnPath)
      ? normalizedDesktopReturnPath
      : undefined;
  const safeReturnHash = safeReturnPath ? routeState.returnHash : undefined;
  const routeSelectedPostId = routeState.postId;
  const routeSelectedAuthorId = routeState.authorId;
  const [activeSection, setActiveSection] =
    useState<FeedChannelHomeSection>(routeState.section ?? "recommended");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [desktopSelectedPostId, setDesktopSelectedPostId] = useState<
    string | null
  >(routeSelectedPostId);
  const [mobileCommentSheetPostId, setMobileCommentSheetPostId] = useState<
    string | null
  >(null);
  const [mobileReplyTarget, setMobileReplyTarget] =
    useState<FeedCommentReplyTarget | null>(null);
  const [desktopReplyTarget, setDesktopReplyTarget] =
    useState<FeedCommentReplyTarget | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info">("success");
  const [noticeActionLabel, setNoticeActionLabel] = useState<string | null>(
    null,
  );
  const [noticeAction, setNoticeAction] = useState<(() => void) | null>(null);
  // 视频号转发面板：null = 关闭，非空 = 当前要转发的 post 摘要
  const [forwardPickerPost, setForwardPickerPost] = useState<{
    id: string;
    excerpt: string;
  } | null>(null);
  const previousBaseUrlRef = useRef(baseUrl);

  const channelsQuery = useQuery({
    queryKey: ["app-channels-home", baseUrl, activeSection],
    queryFn: () =>
      getChannelHome(baseUrl, {
        section: activeSection,
        limit: CHANNELS_PAGE_LIMIT,
      }),
  });
  // 装饰位（tab 计数 + 评论预览）走第二个并行请求，不卡首屏列表/首播。
  // 拆分理由见 api/src/modules/feed/feed.service.ts getChannelHomeDecorations。
  const decorationsQuery = useQuery({
    queryKey: ["app-channels-home-decorations", baseUrl, activeSection],
    queryFn: () =>
      getChannelHomeDecorations(baseUrl, {
        section: activeSection,
        limit: CHANNELS_PAGE_LIMIT,
      }),
  });
  const commentsPreviewByPostId =
    decorationsQuery.data?.commentsPreviewByPostId;
  const getCommentsPreview = useCallback(
    (postId: string): FeedComment[] =>
      commentsPreviewByPostId?.[postId] ?? [],
    [commentsPreviewByPostId],
  );

  // 点赞改成 toggle：原来只 POST /like、不调 DELETE，但 aria-label 和
  // 实心 ThumbsUp 都暗示用户可以"取消点赞"。后端早就支持 unlike，UI 没接。
  // 现在 input 带 hasLiked，按需走 like / unlike，optimistic 也按 toggle 翻。
  //
  // 失败回滚 per-post 而不是整缓存：用户连点 A→B 两条 like，A 失败的时候
  // 不能 setQueryData(整张老快照)，否则会把 B 的乐观更新一起抹掉。只把 A 这条
  // 的 likeCount/hasLiked 恢复成"被点之前那条"，其他 post 用当前缓存。
  const likeMutation = useMutation({
    mutationFn: (input: { postId: string; hasLiked: boolean }) =>
      input.hasLiked
        ? unlikeFeedPost(input.postId, baseUrl)
        : likeFeedPost(input.postId, baseUrl),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      const previousEntries: Array<{
        key: readonly unknown[];
        previousPost: FeedPostListItem | null;
      }> = [];
      const snapshots = queryClient.getQueriesData<FeedChannelHomeResponse>({
        queryKey: ["app-channels-home", baseUrl],
      });
      snapshots.forEach(([key, data]) => {
        if (!data?.posts) {
          return;
        }
        const previousPost =
          data.posts.find((post) => post.id === input.postId) ?? null;
        previousEntries.push({ key, previousPost });
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...data,
          posts: data.posts.map((post) =>
            post.id === input.postId
              ? {
                  ...post,
                  likeCount: input.hasLiked
                    ? Math.max(0, post.likeCount - 1)
                    : post.likeCount + 1,
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
                    hasLiked: !input.hasLiked,
                  },
                }
              : post,
          ),
        });
      });
      return { previousEntries };
    },
    onError: (error, input, context) => {
      // 只回滚被点的这条 post——拿当前缓存（已经包含后来的乐观更新）做底，
      // 仅把 input.postId 还原成失败前那条。
      context?.previousEntries.forEach(({ key, previousPost }) => {
        const current =
          queryClient.getQueryData<FeedChannelHomeResponse>(key);
        if (!current?.posts) return;
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...current,
          posts: current.posts.map((post) =>
            post.id === input.postId ? (previousPost ?? post) : post,
          ),
        });
      });
      // 失败时给一行 info 通知；不要把单条点赞失败升级成"视频号暂时不可用"
      // 大状态卡——home 列表其实还能用。
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        error instanceof Error
          ? t(msg`点赞失败：${error.message}`)
          : t(msg`点赞失败，请稍后重试。`),
      );
    },
    onSuccess: () => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`视频号互动已更新。`));
      // 点赞 toggle 是 boolean，optimistic 已经切对 hasLiked/likeCount。
      // 完全省掉 invalidate，避免视频号首页全量 + media 条件请求 RTT。
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
          {
            text,
          },
          baseUrl,
        );
      }

      return addFeedComment(
        input.postId,
        {
          text,
        },
        baseUrl,
      );
    },
    onSuccess: (_, input) => {
      // 走查 R1：原来无条件把 commentDrafts[postId] 清空——但 textarea 在 mutation
      // 飞行期没 disabled，用户提交完会接着打下一条评论。RTT 落地时 onSuccess 把
      // 「正在打的下一条」也一起抹掉，用户辛苦敲的内容凭空消失。只在当前草稿仍
      // 等于刚发出去的文本（用户没继续输入）时才清空；否则保留草稿。
      const sentText = input.text;
      setCommentDrafts((current) => {
        if ((current[input.postId] ?? "") !== sentText) {
          return current;
        }
        return { ...current, [input.postId]: "" };
      });
      // 走查 R3：原来只按 postId 抹 replyTarget——但用户提交回复 A 后还没
      // 收到 RTT 就先按了评论 B 的「回复」按钮，replyTarget 已经被替换成 B；
      // mutation 落地把 current.postId === input.postId 当真，把刚换上的 B 也
      // 一起清掉，用户的「我下一步要回 B」意图丢失。改成「sent target 跟当前
      // target 完全相同」才清；用户已经切到别的评论 / 退回到顶层评论时不动。
      // input.replyTarget 为 null（顶层评论）时，原 replyTarget 必为 null
      // （顶层评论提交不会经过 setMobileReplyTarget），不需要再做事。
      const sentTarget = input.replyTarget ?? null;
      setMobileReplyTarget((current) => {
        if (!current || !sentTarget) return current;
        if (
          current.postId === sentTarget.postId &&
          current.commentId === sentTarget.commentId
        ) {
          return null;
        }
        return current;
      });
      setDesktopReplyTarget((current) => {
        if (!current || !sentTarget) return current;
        if (
          current.postId === sentTarget.postId &&
          current.commentId === sentTarget.commentId
        ) {
          return null;
        }
        return current;
      });
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        input.replyTarget
          ? t(msg`视频号回复已发送。`)
          : t(msg`视频号评论已发送。`),
      );
      // fire-and-forget：await 会让"发送"按钮一直 disabled。
      // 主接口刷新 commentCount，decorations 刷新 commentsPreview 卡底"最近评论"。
      void queryClient.invalidateQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      void queryClient.invalidateQueries({
        queryKey: ["app-channels-home-decorations", baseUrl],
      });
      void queryClient.invalidateQueries({
        queryKey: ["app-feed-comments", baseUrl, input.postId],
      });
    },
    // 走查 R7: 失败兜底。原来没 onError，错误只通过 mobileCommentSheetErrorMessage
    // 在 sheet 里显示——但用户在提交完后立刻关 sheet（提交按钮不阻挡关闭 X），
    // mutation 还在飞，最终失败时 sheet 已经关了，红条没人看到。用户以为"发送
    // 成功"了，因为既没 success notice 也没 error notice。这里加 page 级 notice
    // 兜底，info tone，2.4s 自动消失（同 like/favorite 的失败提示样式）。
    onError: (error, input) => {
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      const fallback = input.replyTarget
        ? t(msg`视频号回复发送失败，请稍后重试。`)
        : t(msg`视频号评论发送失败，请稍后重试。`);
      setNotice(error instanceof Error ? `${fallback} (${error.message})` : fallback);
    },
  });
  const generateMutation = useMutation({
    mutationFn: () => generateChannelPost(baseUrl),
    onSuccess: async (data) => {
      setNoticeActionLabel(null);
      setNoticeAction(null);
      if (!data) {
        // 后端跳过生成（MiniMax key 未配 / 视频额度今日用完 / 没有可发帖的角色）
        // 时统一返回 null。原来文案是"额度今日已用完, 明天再试"，但 key 未配 /
        // 没有可发帖的角色 时根本不是额度问题，"明天再试"会误导用户白等一天。
        // 改成中性"现在没法生成"，不锁死重试时间。
        setNoticeTone("info");
        setNotice(t(msg`现在没法生成新内容，稍后再试看看。`));
        return;
      }
      setNoticeTone("success");
      // 后端只是把 draft 写进 DB + 异步排队 MiniMax 出视频，要等 callback
      // 才会落到 publishStatus='published'。home 这次 refetch 通常看不到。
      // 把文案从 "已生成" 改成 "正在生成"，对齐真实状态。
      setNotice(t(msg`新视频号正在生成中，几分钟后刷新看看。`));
      await queryClient.invalidateQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
    },
    onError: (err) => {
      // 网络/服务端错误不要冒到顶层的 errorMessage——那会让整个 home
      // 切到 "视频号暂时不可用" 状态卡，但实际推荐流仍然能拉到。改成
      // info 风格的轻量通知，2.4s 自动消失。
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNoticeTone("info");
      setNotice(
        err instanceof Error
          ? t(msg`换一批失败：${err.message}`)
          : t(msg`换一批失败，请稍后重试。`),
      );
    },
  });
  const favoriteMutation = useMutation({
    mutationFn: (input: { postId: string; favorited: boolean }) =>
      input.favorited
        ? unfavoriteFeedPost(input.postId, baseUrl)
        : favoriteFeedPost(input.postId, baseUrl),
    // optimistic：和点赞 / 关注的处理同一套路。本地 favorites 入口（toggleFavorite
    // 里调的 upsertDesktopFavorite）原来已经立刻反映，但 slide 上的收藏按钮要等
    // home 重拉才翻状态，看着像是"按钮没响应"。
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      // 同 likeMutation：失败回滚 per-post，避免并发 mutate 互相覆盖。
      const previousEntries: Array<{
        key: readonly unknown[];
        previousPost: FeedPostListItem | null;
      }> = [];
      const snapshots = queryClient.getQueriesData<FeedChannelHomeResponse>({
        queryKey: ["app-channels-home", baseUrl],
      });
      snapshots.forEach(([key, data]) => {
        if (!data?.posts) return;
        const previousPost =
          data.posts.find((post) => post.id === input.postId) ?? null;
        previousEntries.push({ key, previousPost });
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...data,
          posts: data.posts.map((post) =>
            post.id === input.postId
              ? {
                  ...post,
                  favoriteCount: input.favorited
                    ? Math.max(0, post.favoriteCount - 1)
                    : post.favoriteCount + 1,
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
                    hasFavorited: !input.favorited,
                  },
                }
              : post,
          ),
        });
      });
      return { previousEntries };
    },
    onError: (error, input, context) => {
      context?.previousEntries.forEach(({ key, previousPost }) => {
        const current =
          queryClient.getQueryData<FeedChannelHomeResponse>(key);
        if (!current?.posts) return;
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...current,
          posts: current.posts.map((post) =>
            post.id === input.postId ? (previousPost ?? post) : post,
          ),
        });
      });
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        error instanceof Error
          ? t(msg`收藏失败：${error.message}`)
          : t(msg`收藏失败，请稍后重试。`),
      );
    },
    onSuccess: async (_, input) => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        input.favorited
          ? t(msg`已取消收藏。`)
          : t(msg`已收藏这条视频号内容。`),
      );
      await queryClient.invalidateQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
    },
  });
  const followMutation = useMutation({
    mutationFn: (input: { authorId: string; following: boolean }) =>
      input.following
        ? unfollowChannelAuthor(input.authorId, baseUrl)
        : followChannelAuthor(input.authorId, baseUrl),
    // optimistic：在关注 tab 上点 "已关注" → 应该立刻看到按钮翻成 +关注 状态。
    // 没有这层，关注 tab 上要等 invalidate → 重拉 home → 重渲，按钮在 300+ms
    // 里都还停在 "已关注"，比 点赞 慢得多。把同作者所有 post 的 ownerState
    // 一起翻——既覆盖 关注 tab，也覆盖 推荐 / 朋友 tab 上同一作者的 post。
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      // 同 likeMutation：per-author 记录失败前的所有相关 post，回滚也只动这些。
      const previousEntries: Array<{
        key: readonly unknown[];
        previousPosts: Map<string, FeedPostListItem>;
      }> = [];
      const snapshots = queryClient.getQueriesData<FeedChannelHomeResponse>({
        queryKey: ["app-channels-home", baseUrl],
      });
      snapshots.forEach(([key, data]) => {
        if (!data?.posts) return;
        const previousPosts = new Map<string, FeedPostListItem>();
        data.posts.forEach((post) => {
          if (post.authorId === input.authorId) {
            previousPosts.set(post.id, post);
          }
        });
        previousEntries.push({ key, previousPosts });
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...data,
          posts: data.posts.map((post) =>
            post.authorId === input.authorId
              ? {
                  ...post,
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
                    isFollowingAuthor: !input.following,
                  },
                }
              : post,
          ),
        });
      });
      return { previousEntries };
    },
    onError: (error, input, context) => {
      context?.previousEntries.forEach(({ key, previousPosts }) => {
        const current =
          queryClient.getQueryData<FeedChannelHomeResponse>(key);
        if (!current?.posts) return;
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...current,
          posts: current.posts.map((post) =>
            post.authorId === input.authorId
              ? (previousPosts.get(post.id) ?? post)
              : post,
          ),
        });
      });
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        error instanceof Error
          ? t(msg`关注失败：${error.message}`)
          : t(msg`关注失败，请稍后重试。`),
      );
    },
    onSuccess: async (_, input) => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        input.following
          ? t(msg`已取消关注。`)
          : t(msg`已关注该视频号作者。`),
      );
      await queryClient.invalidateQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      // 关注/取消关注影响 关注/朋友 tab 的 sections.count。
      await queryClient.invalidateQueries({
        queryKey: ["app-channels-home-decorations", baseUrl],
      });
    },
  });
  const notInterestedMutation = useMutation({
    mutationFn: (postId: string) => markFeedPostNotInterested(postId, baseUrl),
    // 减少推荐：optimistic 把这条 post 从可见列表里抠掉。
    // 没有这层，点完后要等 invalidate → 重拉 home (~150-400ms) 才消失，期间用户
    // 还会盯着自己说"不感兴趣"的卡，可能再来一下导致重复请求。
    onMutate: async (postId) => {
      await queryClient.cancelQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      const previousEntries: Array<{
        key: readonly unknown[];
        previousData: FeedChannelHomeResponse;
      }> = [];
      const snapshots = queryClient.getQueriesData<FeedChannelHomeResponse>({
        queryKey: ["app-channels-home", baseUrl],
      });
      snapshots.forEach(([key, data]) => {
        if (!data?.posts) return;
        previousEntries.push({ key, previousData: data });
        queryClient.setQueryData<FeedChannelHomeResponse>(key, {
          ...data,
          posts: data.posts.filter((post) => post.id !== postId),
        });
      });
      return { previousEntries };
    },
    onError: (error, _postId, context) => {
      // 回滚：失败时把 post 还原回去。这里整张 home 还原是安全的——
      // notInterested 不在并发 mutate 范围内（用户不会连点不同 post 的"减少推荐"），
      // 且其他乐观更新通常以 per-post 维度，这里 filter 只删一条，恢复就行。
      context?.previousEntries.forEach(({ key, previousData }) => {
        queryClient.setQueryData(key, previousData);
      });
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        error instanceof Error
          ? t(msg`减少推荐失败：${error.message}`)
          : t(msg`减少推荐失败，请稍后重试。`),
      );
    },
    onSuccess: async () => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`这类内容会减少推荐。`));
      await queryClient.invalidateQueries({
        queryKey: ["app-channels-home", baseUrl],
      });
      // 隐藏帖子影响 sections.count / 作者位 / 直播位。
      await queryClient.invalidateQueries({
        queryKey: ["app-channels-home-decorations", baseUrl],
      });
    },
  });
  const likeCommentMutation = useMutation({
    mutationFn: (input: { commentId: string; postId: string }) =>
      likeFeedComment(input.commentId, baseUrl),
    // optimistic：评论点赞 RTT ~200ms 期间按钮一直显示「处理中」，count 也不动，
    // 公网下点完一秒钟才看到点赞数 +1，体感像点了没生效。后端 likeOwnerComment
    // 对已 liked 是 no-op，没有 unlike 路径，所以 toggle 永远只往 +1 走，
    // optimistic 安全。
    // 缓存两处都翻：
    //   - app-feed-comments：评论面板里整条 list
    //   - app-channels-home-decorations.commentsPreviewByPostId：home 卡底"最近评论"
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ["app-feed-comments", baseUrl, input.postId],
        }),
        queryClient.cancelQueries({
          queryKey: ["app-channels-home-decorations", baseUrl],
        }),
      ]);

      const previousFullComments = queryClient.getQueryData<FeedComment[]>([
        "app-feed-comments",
        baseUrl,
        input.postId,
      ]);
      const previousDecorationsEntries = queryClient.getQueriesData<{
        commentsPreviewByPostId?: Record<string, FeedComment[]>;
      }>({
        queryKey: ["app-channels-home-decorations", baseUrl],
      });

      const flipComment = (c: FeedComment): FeedComment =>
        c.id === input.commentId && !c.likedByOwner
          ? {
              ...c,
              likedByOwner: true,
              likeCount: c.likeCount + 1,
            }
          : c;

      if (previousFullComments) {
        queryClient.setQueryData<FeedComment[]>(
          ["app-feed-comments", baseUrl, input.postId],
          previousFullComments.map(flipComment),
        );
      }
      previousDecorationsEntries.forEach(([key, data]) => {
        if (!data?.commentsPreviewByPostId) return;
        const preview = data.commentsPreviewByPostId[input.postId];
        if (!preview) return;
        queryClient.setQueryData(key, {
          ...data,
          commentsPreviewByPostId: {
            ...data.commentsPreviewByPostId,
            [input.postId]: preview.map(flipComment),
          },
        });
      });

      return { previousFullComments, previousDecorationsEntries };
    },
    onError: (error, input, context) => {
      // 走查 R4：原回滚把 previousFullComments 整体 setQueryData 回去——
      // 但用户连点 A → B 两条评论的点赞，B 的 onMutate 在 A 之后已经把 B 也
      // 翻成 liked；如果 A 失败时直接整张快照覆盖回去，B 的 optimistic 翻动
      // 也被一起抹掉，下一帧 invalidate 才补回 B 的真值，中间用户会看到 B
      // 突然变回未赞又再变回已赞，体感像"我又被打回去了"。改成只回滚当前 input
      // 这一条评论，其它评论按当前 cache（含后续乐观更新）继续保留。
      if (context) {
        const previousFullComment = context.previousFullComments?.find(
          (c) => c.id === input.commentId,
        );
        queryClient.setQueryData<FeedComment[]>(
          ["app-feed-comments", baseUrl, input.postId],
          (current) => {
            if (!current) return current;
            return current.map((c) =>
              c.id === input.commentId ? (previousFullComment ?? c) : c,
            );
          },
        );
        context.previousDecorationsEntries.forEach(([key, prevData]) => {
          if (prevData === undefined) return;
          const previousPreviewComment = prevData.commentsPreviewByPostId?.[
            input.postId
          ]?.find((c) => c.id === input.commentId);
          queryClient.setQueryData<{
            commentsPreviewByPostId?: Record<string, FeedComment[]>;
          }>(key, (current) => {
            if (!current?.commentsPreviewByPostId) return current;
            const preview = current.commentsPreviewByPostId[input.postId];
            if (!preview) return current;
            return {
              ...current,
              commentsPreviewByPostId: {
                ...current.commentsPreviewByPostId,
                [input.postId]: preview.map((c) =>
                  c.id === input.commentId
                    ? (previousPreviewComment ?? c)
                    : c,
                ),
              },
            };
          });
        });
      }
      // 走查 R8: 跟 commentMutation 一样的兜底——用户点赞完后立刻关 sheet，
      // mutation 失败时 mobileCommentSheetErrorMessage 已经不渲染了，optimistic
      // 翻回去用户也不知道为啥，加 page 级 notice 兜底。
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(
        error instanceof Error
          ? t(msg`评论点赞失败：${error.message}`)
          : t(msg`评论点赞失败，请稍后重试。`),
      );
    },
    onSuccess: (_, input) => {
      setNoticeTone("success");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`评论互动已更新。`));
      // fire-and-forget：await 会让 like-comment 按钮一直 disabled。
      // optimistic 已经翻了 likedByOwner/likeCount，invalidate 让 server 真值兜底
      // 一次（防止极端情况下两边 state drift）。
      void queryClient.invalidateQueries({
        queryKey: ["app-channels-home-decorations", baseUrl],
      });
      void queryClient.invalidateQueries({
        queryKey: ["app-feed-comments", baseUrl, input.postId],
      });
    },
  });

  const visiblePosts = channelsQuery.data?.posts ?? EMPTY_CHANNEL_POSTS;

  // 推荐流里有大量非好友角色的帖子，后端对这些 post 的 like / comment /
  // favorite / comment_like 都会 403 FEED_NOT_FRIEND。前端原本没有 gating，按
  // 钮照点 → 用户看到 403 而不是友好提示。这里集中拦在 mutate 前，提示一句
  // 后直接 return；share / view / not-interested / 转发 仍开放给非好友。
  function ensureCanInteract(post: { canInteract?: boolean } | undefined | null) {
    if (!post || post.canInteract === false) {
      setNoticeTone("info");
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(t(msg`需先加为好友才能互动。`));
      return false;
    }
    return true;
  }
  function ensureCommentPostCanInteract(postId: string) {
    const post = visiblePosts.find((p) => p.id === postId);
    return ensureCanInteract(post);
  }
  const desktopMissingRoutePostId =
    isDesktopLayout &&
    routeSelectedPostId &&
    !visiblePosts.some((post) => post.id === routeSelectedPostId)
      ? routeSelectedPostId
      : null;
  const desktopMissingRoutePostQuery = useQuery({
    queryKey: ["app-feed-post", baseUrl, desktopMissingRoutePostId],
    queryFn: async () => {
      if (!desktopMissingRoutePostId) {
        return null;
      }

      const post = await getFeedPost(desktopMissingRoutePostId, baseUrl);
      if (!post || post.surface !== "channels") {
        return null;
      }

      return post;
    },
    enabled: Boolean(desktopMissingRoutePostId),
  });
  const desktopWorkspacePosts = useMemo(() => {
    const routePost = desktopMissingRoutePostQuery.data;
    if (!routePost || !desktopMissingRoutePostId) {
      return visiblePosts;
    }

    if (visiblePosts.some((post) => post.id === routePost.id)) {
      return visiblePosts;
    }

    return [createDesktopChannelRoutePost(routePost), ...visiblePosts];
  }, [
    desktopMissingRoutePostId,
    desktopMissingRoutePostQuery.data,
    visiblePosts,
  ]);
  const desktopRoutePostPending =
    Boolean(desktopMissingRoutePostId) && desktopMissingRoutePostQuery.isLoading;
  const desktopSelectedPost = useMemo(
    () =>
      desktopWorkspacePosts.find((post) => post.id === desktopSelectedPostId) ??
      null,
    [desktopSelectedPostId, desktopWorkspacePosts],
  );
  const syncedRouteSelectedAuthorId =
    routeSelectedAuthorId &&
    desktopSelectedPost?.authorId === routeSelectedAuthorId
      ? routeSelectedAuthorId
      : undefined;
  const mobileCommentSheetPost = useMemo(
    () =>
      visiblePosts.find((post) => post.id === mobileCommentSheetPostId) ?? null,
    [mobileCommentSheetPostId, visiblePosts],
  );
  const mobileCommentsQuery = useQuery({
    queryKey: ["app-feed-comments", baseUrl, mobileCommentSheetPostId],
    queryFn: () => listFeedComments(mobileCommentSheetPostId!, baseUrl),
    enabled: Boolean(mobileCommentSheetPostId),
    placeholderData: mobileCommentSheetPostId
      ? getCommentsPreview(mobileCommentSheetPostId)
      : [],
  });
  const desktopCommentsQuery = useQuery({
    queryKey: ["app-feed-comments", baseUrl, desktopSelectedPostId],
    queryFn: () => listFeedComments(desktopSelectedPostId!, baseUrl),
    enabled: Boolean(isDesktopLayout && desktopSelectedPostId),
    placeholderData: desktopSelectedPostId
      ? getCommentsPreview(desktopSelectedPostId)
      : [],
  });
  const desktopAuthorProfileQuery = useQuery({
    queryKey: ["app-channel-author", baseUrl, syncedRouteSelectedAuthorId],
    queryFn: () => getChannelAuthorProfile(syncedRouteSelectedAuthorId!, baseUrl),
    enabled: Boolean(isDesktopLayout && syncedRouteSelectedAuthorId),
  });
  const channelSections = useMemo<
    Array<{ key: FeedChannelHomeSection; label: string; count: number }>
  >(
    () =>
      decorationsQuery.data?.sections ??
      channelsQuery.data?.sections ?? [
        { key: "recommended", label: t(msg`推荐`), count: 0 },
        { key: "friends", label: t(msg`朋友`), count: 0 },
        { key: "following", label: t(msg`关注`), count: 0 },
        { key: "live", label: t(msg`直播`), count: 0 },
      ],
    [decorationsQuery.data?.sections, channelsQuery.data?.sections, t],
  );
  // 只把"拉首屏数据"和"按 URL 定位帖"这两种"读"失败放进 errorMessage——
  // 这才是真正的 "视频号暂时不可用"。点赞 / 收藏 / 关注 / 减少推荐 / 评论
  // 这些点操作失败时整个 home 还能用，不应该让大状态卡盖住推荐流；它们的
  // 错误通过下方 setNotice 给一行轻量提示就好。
  // commentMutation 在评论面板里另有 inlineNotice 兜底，桌面端 errorMessage
  // 还会把 commentPanel 错单独拎出，这里也不重复进。
  // generateMutation 一直就显式排除——它失败 home 仍然能用。
  const errorMessage =
    (channelsQuery.isError && channelsQuery.error instanceof Error
      ? channelsQuery.error.message
      : null) ??
    (desktopMissingRoutePostId &&
    desktopMissingRoutePostQuery.isError &&
    desktopMissingRoutePostQuery.error instanceof Error
      ? desktopMissingRoutePostQuery.error.message
      : null);
  const mobileCommentSheetErrorMessage =
    (mobileCommentsQuery.isError && mobileCommentsQuery.error instanceof Error
      ? mobileCommentsQuery.error.message
      : null) ??
    (likeCommentMutation.isError &&
    likeCommentMutation.error instanceof Error &&
    likeCommentMutation.variables?.postId === mobileCommentSheetPostId
      ? likeCommentMutation.error.message
      : null) ??
    (commentMutation.isError &&
    commentMutation.error instanceof Error &&
    commentMutation.variables?.postId === mobileCommentSheetPostId
      ? commentMutation.error.message
      : null);
  const mobileCommentSheetRetryAction =
    mobileCommentsQuery.isError && mobileCommentSheetPostId
      ? {
          label: t(msg`重试读取评论`),
          onClick: () => {
            void mobileCommentsQuery.refetch();
          },
        }
      : likeCommentMutation.isError &&
          likeCommentMutation.error instanceof Error &&
          likeCommentMutation.variables?.postId === mobileCommentSheetPostId
        ? {
            label: t(msg`重试评论点赞`),
            onClick: () => {
              likeCommentMutation.mutate(likeCommentMutation.variables);
            },
          }
        : commentMutation.isError &&
            commentMutation.error instanceof Error &&
            commentMutation.variables?.postId === mobileCommentSheetPostId &&
            commentMutation.variables.text.trim()
          ? {
              label: commentMutation.variables.replyTarget
                ? t(msg`重试回复评论`)
                : t(msg`重试发送评论`),
              // postId / replyTarget 用旧的（用户改的是文本不是回复对象），
              // text 从 commentDrafts 现读现用——直接 mutate(variables) 会把
              // 失败那一刻的旧 text 又发一遍，但评论过长 / 被风控驳回时用户
              // 通常已经在草稿里缩短改写过，旧 text 会把刚改完的本意顶回去。
              onClick: () => {
                const variables = commentMutation.variables;
                if (!variables) return;
                // 用户失败后把草稿改回空再点重试——别替换 variables.text 让
                // mutationFn 抛 "请先输入评论内容"，把同一条红条又翻一遍。
                // 草稿空就退回到最初发送的那一份文本继续重试。
                const rawDraft = commentDrafts[variables.postId];
                const currentDraft = rawDraft?.trim()
                  ? rawDraft
                  : variables.text;
                commentMutation.mutate({
                  ...variables,
                  text: currentDraft,
                });
              },
            }
          : null;
  const desktopCommentPanelErrorMessage =
    (desktopCommentsQuery.isError && desktopCommentsQuery.error instanceof Error
      ? desktopCommentsQuery.error.message
      : null) ??
    (likeCommentMutation.isError &&
    likeCommentMutation.error instanceof Error &&
    likeCommentMutation.variables?.postId === desktopSelectedPostId
      ? likeCommentMutation.error.message
      : null) ??
    (commentMutation.isError &&
    commentMutation.error instanceof Error &&
    commentMutation.variables?.postId === desktopSelectedPostId
      ? commentMutation.error.message
      : null);
  const pendingLikePostId = likeMutation.isPending
    ? (likeMutation.variables?.postId ?? null)
    : null;
  // 同 like，收藏 toggle 也要锁住按钮直到 mutation 落地，避免 rapid click 串成多条
  // 并发请求把最终状态打乱。
  const pendingFavoritePostId = favoriteMutation.isPending
    ? (favoriteMutation.variables?.postId ?? null)
    : null;
  // follow 是按 authorId 维度，"+关注"按钮在同作者的多条 post 上都显示，并发同样
  // 会乱。锁住整个 authorId 维度。
  const pendingFollowAuthorId = followMutation.isPending
    ? (followMutation.variables?.authorId ?? null)
    : null;
  const pendingCommentPostId = commentMutation.isPending
    ? (commentMutation.variables?.postId ?? null)
    : null;
  const pendingLikeCommentId = likeCommentMutation.isPending
    ? (likeCommentMutation.variables?.commentId ?? null)
    : null;

  // useCallback 必要：onViewPost 作为 prop 进 DesktopChannelsWorkspace 的 useEffect 依赖，
  // 内联箭头函数会导致 effect 在父组件每次 re-render 都重跑，狂刷 viewFeedPost。
  const handleDesktopViewPost = useCallback(
    (postId: string) => {
      void viewFeedPost(postId, { progressSeconds: 3 }, baseUrl);
    },
    [baseUrl],
  );
  // 同上：mobile MobileChannelsViewport 里的 useEffect 把 onVisiblePost 当依赖，
  // 切 section / 父级任意 re-render 都会让 view POST 重发一次（实测切「朋友」tab
  // 一次激活同一 postId 17ms 内发了两次 /feed/:id/view）。
  const handleMobileViewPost = useCallback(
    (postId: string) => {
      void viewFeedPost(postId, { progressSeconds: 1 }, baseUrl);
    },
    [baseUrl],
  );

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

    void channelsQuery.refetch();
  }

  function handleRetryLoad() {
    void channelsQuery.refetch();
  }

  function handleEmptyStateAction() {
    if (navigateToRouteStateReturn()) {
      return;
    }

    // 这些 tab 的空态点"去推荐看看"才有意义——generateChannelPost 走
    // characters.findAllVisibleToOwner 随机一位 feedFrequency>0 的角色，
    // 既不保证落到通讯录里的朋友（friends tab）、也不会生成直播（live tab）、
    // 当然也不会自动产生关注（following tab）。统一切回推荐。
    if (
      activeSection === "following" ||
      activeSection === "friends" ||
      activeSection === "live"
    ) {
      handleSectionChange("recommended");
      return;
    }

    generateMutation.mutate();
  }

  useEffect(() => {
    const baseUrlChanged = previousBaseUrlRef.current !== baseUrl;
    previousBaseUrlRef.current = baseUrl;

    if (baseUrlChanged) {
      setCommentDrafts({});
      setNoticeActionLabel(null);
      setNoticeAction(null);
      setNotice(""); // i18n-ignore-line
    }

    setDesktopSelectedPostId(routeSelectedPostId);
    setDesktopReplyTarget(null);
    setMobileCommentSheetPostId(null);
    setMobileReplyTarget(null);
  }, [baseUrl, routeSelectedPostId]);

  useEffect(() => {
    const routeSection = routeState.section ?? "recommended";
    setActiveSection((current) =>
      current === routeSection ? current : routeSection,
    );
  }, [routeState.section]);

  useEffect(() => {
    if (!desktopSelectedPostId) {
      return;
    }

    if (desktopRoutePostPending) {
      return;
    }

    if (!desktopWorkspacePosts.some((post) => post.id === desktopSelectedPostId)) {
      setDesktopSelectedPostId(null);
      setDesktopReplyTarget(null);
    }
  }, [desktopRoutePostPending, desktopSelectedPostId, desktopWorkspacePosts]);

  useEffect(() => {
    if (!isDesktopLayout || !isDesktopChannelsRoute) {
      return;
    }

    // URL 是 section 的真理之源；如果 React state 还没追平 URL（effect 578 还没跑完），
    // 不要拿旧 state 反向写 URL，否则会把刚发生的 tab 切换覆盖掉。
    const urlSection = routeState.section ?? "recommended";
    if (urlSection !== activeSection) {
      return;
    }

    const nextHash = buildDesktopChannelsRouteHash({
      postId: desktopSelectedPostId,
      authorId: syncedRouteSelectedAuthorId,
      section: activeSection,
    });
    if (
      pathname === "/tabs/channels" &&
      (nextHash ?? "") === normalizedHash
    ) {
      return;
    }

    void navigate({
      to: "/tabs/channels",
      hash: nextHash,
      replace: true,
    });
  }, [
    activeSection,
    isDesktopChannelsRoute,
    syncedRouteSelectedAuthorId,
    normalizedHash,
    desktopSelectedPostId,
    isDesktopLayout,
    navigate,
    pathname,
    routeState.section,
  ]);

  useEffect(() => {
    if (isDesktopLayout || normalizedPathname !== "/discover/channels") {
      return;
    }

    const nextHash = buildDesktopChannelsRouteHash({
      postId:
        routeState.section === activeSection ? routeSelectedPostId : undefined,
      returnPath: safeReturnPath,
      returnHash: safeReturnHash,
      section: activeSection,
    });
    if ((nextHash ?? "") === normalizedHash) {
      return;
    }

    void navigate({
      to: "/discover/channels",
      hash: nextHash,
      replace: true,
    });
  }, [
    activeSection,
    isDesktopLayout,
    navigate,
    normalizedHash,
    normalizedPathname,
    routeSelectedPostId,
    routeState.section,
    safeReturnHash,
    safeReturnPath,
  ]);

  useEffect(() => {
    if (!mobileCommentSheetPostId) {
      return;
    }

    if (!visiblePosts.some((post) => post.id === mobileCommentSheetPostId)) {
      setMobileCommentSheetPostId(null);
      setMobileReplyTarget(null);
    }
  }, [mobileCommentSheetPostId, visiblePosts]);

  useEffect(() => {
    if (!mobileReplyTarget) {
      return;
    }

    if (mobileReplyTarget.postId !== mobileCommentSheetPostId) {
      setMobileReplyTarget(null);
    }
  }, [mobileCommentSheetPostId, mobileReplyTarget]);

  useEffect(() => {
    if (!desktopReplyTarget) {
      return;
    }

    if (desktopReplyTarget.postId !== desktopSelectedPostId) {
      setDesktopReplyTarget(null);
    }
  }, [desktopReplyTarget, desktopSelectedPostId]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(""); // i18n-ignore-line
      setNoticeActionLabel(null);
      setNoticeAction(null);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // 视频号转发：点击转发按钮 → 弹好友选择器 → 用户选完调
  // forwardFeedPostToChat（在 ChannelsForwardPicker 内部完成）。
  function handleSharePost(post: (typeof visiblePosts)[number]) {
    // 卡片正文那边都用 stripToolCallSyntax 过滤了 <tool_call> / <bracket> 残留；
    // 转发面板顶部的摘要也要过一遍，不然某些 AI 生成贴的原文里夹的工具调用语法
    // 会原样塞进转发预览，看着像乱码。
    const cleanText = stripToolCallSyntax(post.text ?? "");
    setForwardPickerPost({
      id: post.id,
      excerpt: `${post.authorName}：${cleanText}`.slice(0, 80),
    });
  }

  function toggleFavorite(post: (typeof visiblePosts)[number]) {
    if (!ensureCanInteract(post)) return;
    const sourceId = `channels-${post.id}`;
    const routeHash = buildDesktopChannelsRouteHash({
      postId: post.id,
      section: activeSection,
    });
    const alreadyFavorited = Boolean(post.ownerState?.hasFavorited);
    // 走查 R1：toggleFavorite 同时改 React Query 缓存 + 本地 desktop-favorites
    // localStorage。favoriteMutation.onError 只回滚缓存里的 hasFavorited / count，
    // 不动 localStorage 那份。若 POST/DELETE 失败，server 上 favorite 状态没变，
    // 卡片 UI 翻回原状，但「我 → 收藏」里却多了 / 少了这条，长期堆出脏记录。
    // 这里记下取消前的原记录 + 在 mutate 的 per-call onError 里逆向回滚。
    const previousFavoriteRecord = alreadyFavorited
      ? (readDesktopFavorites().find((item) => item.sourceId === sourceId) ?? null)
      : null;
    if (alreadyFavorited) {
      removeDesktopFavorite(sourceId);
    } else {
      upsertDesktopFavorite({
        id: `favorite-${sourceId}`,
        sourceId,
        category: "channels",
        title: post.authorName,
        description: post.text,
        meta: formatTimestamp(post.createdAt),
        to: `/tabs/channels${routeHash ? `#${routeHash}` : ""}`,
        badge: t(msg`视频号`),
        avatarName: post.authorName,
        avatarSrc: post.authorAvatar,
      });
    }

    favoriteMutation.mutate(
      {
        postId: post.id,
        favorited: alreadyFavorited,
      },
      {
        onError: () => {
          if (alreadyFavorited) {
            // 之前是「已收藏 → 取消收藏」分支，刚把记录删了，要把原记录加回去
            if (previousFavoriteRecord) {
              const { collectedAt: _unused, ...restored } =
                previousFavoriteRecord;
              void _unused;
              upsertDesktopFavorite(restored);
            }
          } else {
            // 之前是「未收藏 → 收藏」分支，刚 upsert 了一条，删掉
            removeDesktopFavorite(sourceId);
          }
        },
      },
    );
  }

  function toggleFollowAuthor(post: (typeof visiblePosts)[number]) {
    followMutation.mutate({
      authorId: post.authorId,
      following: Boolean(post.ownerState?.isFollowingAuthor),
    });
  }

  function hidePost(postId: string) {
    notInterestedMutation.mutate(postId);
  }

  function handleSectionChange(section: FeedChannelHomeSection) {
    if (section === activeSection) {
      return;
    }

    if (isDesktopLayout) {
      // 同步把 React state 切到新 section 并清掉旧 post 锚点，
      // 否则后面同步 URL 的 effect 会读到旧 state，把刚发生的 tab 切换覆盖回去。
      setActiveSection(section);
      setDesktopSelectedPostId(null);
      setDesktopReplyTarget(null);
      void navigate({
        to: "/tabs/channels",
        hash: buildDesktopChannelsRouteHash({
          section,
        }),
        replace: true,
      });
      return;
    }

    setActiveSection(section);
  }

  function openChannelAuthor(
    authorId: string,
    options?: {
      sourcePostId?: string | null;
    },
  ) {
    const sourcePostId =
      options?.sourcePostId ?? desktopSelectedPostId ?? routeSelectedPostId;
    const sourceHash = buildDesktopChannelsRouteHash({
      postId: sourcePostId,
      returnPath: safeReturnPath,
      returnHash: safeReturnHash,
      section: activeSection,
    });

    if (isDesktopLayout) {
      void navigate({
        to: "/tabs/channels",
        hash: buildDesktopChannelsRouteHash({
          postId: sourcePostId,
          authorId,
          section: activeSection,
        }),
      });
      return;
    }

    void navigate({
      to: "/channels/authors/$authorId",
      params: { authorId },
      hash: buildDesktopChannelsRouteHash({
        postId: sourcePostId,
        returnPath: pathname,
        returnHash: sourceHash,
        section: activeSection,
      }),
    });
  }

  function closeChannelAuthor() {
    void navigate({
      to: "/tabs/channels",
      hash: buildDesktopChannelsRouteHash({
        postId: desktopSelectedPostId,
        section: activeSection,
      }),
      replace: true,
    });
  }

  function openChannelAuthorPost(postId: string, authorId: string) {
    void navigate({
      to: "/tabs/channels",
      hash: buildDesktopChannelsRouteHash({
        postId,
        authorId,
        section: activeSection,
      }),
    });
  }

  function updateCommentDraft(postId: string, value: string) {
    setCommentDrafts((current) => ({
      ...current,
      [postId]: value,
    }));
  }

  function submitComment(
    postId: string,
    options?: {
      replyTarget?: {
        authorId: string;
        authorName: string;
        commentId: string;
        postId: string;
      } | null;
    },
  ) {
    if (!ensureCommentPostCanInteract(postId)) return;
    commentMutation.mutate({
      postId,
      replyTarget: options?.replyTarget ?? null,
      text: commentDrafts[postId] ?? "",
    });
  }

  if (isDesktopLayout && desktopRoutePostPending) {
    return (
      <RouteRedirectState
        title={t(msg`正在定位桌面视频号内容`)}
        description={t(
          msg`当前链接指向的内容不在推荐流里，正在补齐这条视频后再切进工作区。`,
        )}
        loadingLabel={t(msg`定位视频号内容...`)}
      />
    );
  }

  if (isDesktopLayout) {
    return (
      <Suspense
        fallback={
          <RouteRedirectState
            title={t(msg`正在打开桌面视频号`)}
            description={t(
              msg`正在载入桌面视频号工作区，马上显示当前频道内容。`,
            )}
            loadingLabel={t(msg`载入桌面视频号...`)}
          />
        }
      >
        <DesktopChannelsWorkspace
          activeSection={activeSection}
          authorProfile={desktopAuthorProfileQuery.data ?? null}
          authorProfileErrorMessage={
            desktopAuthorProfileQuery.isError &&
            desktopAuthorProfileQuery.error instanceof Error
              ? desktopAuthorProfileQuery.error.message
              : null
          }
          authorProfileLoading={desktopAuthorProfileQuery.isLoading}
          commentDrafts={commentDrafts}
          commentPendingPostId={pendingCommentPostId}
          errorMessage={errorMessage}
          isLoading={channelsQuery.isLoading}
          likePendingPostId={pendingLikePostId}
          posts={desktopWorkspacePosts}
          routeSelectedAuthorId={syncedRouteSelectedAuthorId}
          routeSelectedPostId={routeSelectedPostId}
          sections={channelSections}
          successNotice={notice}
          isPostFavorite={(postId) =>
            desktopWorkspacePosts.find((post) => post.id === postId)
              ?.ownerState?.hasFavorited ?? false
          }
          onCommentChange={updateCommentDraft}
          onCommentSubmit={(postId) =>
            submitComment(postId, { replyTarget: desktopReplyTarget })
          }
          onLike={(postId) => {
            if (!ensureCommentPostCanInteract(postId)) return;
            const post = desktopWorkspacePosts.find((p) => p.id === postId);
            likeMutation.mutate({
              postId,
              hasLiked: Boolean(post?.ownerState?.hasLiked),
            });
          }}
          onRefresh={() => generateMutation.mutate()}
          refreshPending={generateMutation.isPending}
          comments={desktopCommentsQuery.data ?? []}
          commentsErrorMessage={desktopCommentPanelErrorMessage}
          commentsLoading={desktopCommentsQuery.isLoading}
          commentReplyTarget={desktopReplyTarget}
          commentLikePendingId={pendingLikeCommentId}
          onCancelCommentReply={() => setDesktopReplyTarget(null)}
          onCloseAuthor={closeChannelAuthor}
          onOpenAuthor={openChannelAuthor}
          onOpenAuthorPost={openChannelAuthorPost}
          onToggleAuthorFollow={(authorId, following) =>
            followMutation.mutate({ authorId, following })
          }
          onSectionChange={handleSectionChange}
          onToggleFavorite={toggleFavorite}
          onLikeComment={(comment) => {
            if (!ensureCommentPostCanInteract(comment.postId)) return;
            likeCommentMutation.mutate({
              commentId: comment.id,
              postId: comment.postId,
            });
          }}
          onReplyToComment={(comment) =>
            setDesktopReplyTarget({
              authorId: comment.authorId,
              authorName: comment.authorName,
              commentId: comment.id,
              postId: comment.postId,
            })
          }
          onSelectedPostChange={setDesktopSelectedPostId}
          onViewPost={handleDesktopViewPost}
        />
      </Suspense>
    );
  }

  return (
    <AppPage className="space-y-0 px-0 pb-0 pt-0">
      <TabPageTopBar
        title={t(msg`视频号`)}
        subtitle={t(msg`内容推荐与视频动态`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            onClick={() => {
              navigateBackOrFallback(
                () => {
                  if (safeReturnPath) {
                    void navigate({
                      to: safeReturnPath,
                      ...(safeReturnHash ? { hash: safeReturnHash } : {}),
                    });
                    return;
                  }

                  void navigate({ to: "/tabs/discover" });
                },
                safeReturnPath ?? "/tabs/discover",
              );
            }}
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
            onClick={() => generateMutation.mutate()}
            variant="ghost"
            size="sm"
            className="h-8 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-canvas-elevated)] px-3.5 text-[12px] font-medium text-[color:var(--text-primary)] hover:bg-white"
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? t(msg`生成中...`) : t(msg`换一批`)}
          </Button>
        }
      >
        <div className="mt-1.5 flex items-center gap-1">
          {channelSections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => handleSectionChange(section.key)}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-3 text-[11px] transition",
                activeSection === section.key
                  ? "bg-[rgba(7,193,96,0.12)] font-medium text-[#07c160]"
                  : "border border-[color:var(--border-subtle)] bg-[color:var(--bg-canvas-elevated)] text-[color:var(--text-muted)]",
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      </TabPageTopBar>

      <div className="space-y-1.5 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-2.5">
        {notice ? (
          <InlineNotice
            className="rounded-[11px] px-2.5 py-1.5 text-[11px] leading-[1.35rem] shadow-none"
            tone={noticeTone}
          >
            {noticeTone === "info" &&
            (Boolean(noticeAction && noticeActionLabel) ||
              Boolean(safeReturnPath)) ? (
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">{notice}</span>
                <div className="flex items-center gap-1.5">
                  {noticeAction && noticeActionLabel ? (
                    <button
                      type="button"
                      onClick={noticeAction}
                      className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                    >
                      {noticeActionLabel}
                    </button>
                  ) : null}
                  {safeReturnPath ? (
                    // 只在确实有"上一页"可返回时显示这个按钮；之前一律 fallback 到
                    // "重试读取" 调 handleStatusBack（refetch home），但对像
                    // "视频号生成额度今日已用完" 这种 info 通知毫无意义——重读
                    // home 也不会让额度回来，反而让用户以为可以"再试一次"。
                    <button
                      type="button"
                      onClick={handleStatusBack}
                      className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-secondary)]"
                    >
                      {t(msg`返回上一页`)}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              notice
            )}
          </InlineNotice>
        ) : null}
        {errorMessage ? (
          <MobileChannelsStatusCard
            badge={t(msg`读取失败`)}
            description={errorMessage}
            title={t(msg`视频号暂时不可用`)}
            tone="danger"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                  onClick={handleRetryLoad}
                >
                  {t(msg`重试读取`)}
                </Button>
                {safeReturnPath ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={handleStatusBack}
                  >
                    {t(msg`返回上一页`)}
                  </Button>
                ) : null}
              </div>
            }
          />
        ) : null}
        {channelsQuery.isLoading ? (
          <MobileChannelsStatusCard
            badge={t(msg`读取中`)}
            title={t(msg`正在刷新视频号内容`)}
            description={t(msg`稍等一下，正在同步推荐流和互动状态。`)}
            tone="loading"
          />
        ) : null}

        {!channelsQuery.isLoading && !errorMessage && !visiblePosts.length ? (
          <MobileChannelsStatusCard
            badge={t(msg`视频号`)}
            title={
              activeSection === "following"
                ? t(msg`还没关注任何视频号`)
                : activeSection === "friends"
                  ? t(msg`朋友还没有视频号动态`)
                  : activeSection === "live"
                    ? t(msg`暂无正在直播`)
                    : t(msg`还没有内容`)
            }
            description={
              activeSection === "following"
                ? t(
                    msg`去推荐 tab 找一找感兴趣的作者，点 +关注 把他们留下来，新内容会在这里聚合显示。`,
                  )
                : activeSection === "friends"
                  ? t(
                      msg`等通讯录里的角色发新视频号动态，这里就会聚合显示。`,
                    )
                  : activeSection === "live"
                    ? t(msg`稍后再来看看，可能有角色开播。`)
                    : t(
                        msg`再生成一批内容后，这里会逐步形成更连续的视频推荐流。`,
                      )
            }
            action={
              <Button
                variant="primary"
                size="sm"
                className="h-8 rounded-full bg-[#07c160] px-3.5 text-[11px] text-white hover:bg-[#06ad56]"
                // 只有按钮实际行为是「换一批」时才跟 generateMutation.isPending 关：
                // - safeReturnPath 在 → 按钮是「返回上一页」，generate pending 不应该挡返回；
                // - following/friends/live → 按钮是「去推荐看看」，纯切 tab，也不挡。
                disabled={
                  !safeReturnPath &&
                  activeSection === "recommended" &&
                  generateMutation.isPending
                }
                onClick={handleEmptyStateAction}
              >
                {safeReturnPath
                  ? t(msg`返回上一页`)
                  : activeSection === "following" ||
                      activeSection === "friends" ||
                      activeSection === "live"
                    ? t(msg`去推荐看看`)
                    : generateMutation.isPending
                      ? t(msg`生成中...`)
                      : t(msg`换一批`)}
              </Button>
            }
          />
        ) : null}
        {!channelsQuery.isLoading && visiblePosts.length ? (
          <MobileChannelsViewport
            activeSection={activeSection}
            likePendingPostId={pendingLikePostId}
            favoritePendingPostId={pendingFavoritePostId}
            followPendingAuthorId={pendingFollowAuthorId}
            posts={visiblePosts}
            commentsPreviewByPostId={commentsPreviewByPostId}
            routeSelectedPostId={routeSelectedPostId}
            onLike={(postId) => {
              if (!ensureCommentPostCanInteract(postId)) return;
              const post = visiblePosts.find((p) => p.id === postId);
              likeMutation.mutate({
                postId,
                hasLiked: Boolean(post?.ownerState?.hasLiked),
              });
            }}
            onOpenAuthor={(post) =>
              openChannelAuthor(post.authorId, { sourcePostId: post.id })
            }
            onOpenComments={(post) => {
              setMobileCommentSheetPostId(post.id);
              setMobileReplyTarget(null);
            }}
            onNotInterested={hidePost}
            onShare={(post) => void handleSharePost(post)}
            onToggleFollowAuthor={toggleFollowAuthor}
            onToggleFavorite={toggleFavorite}
            onVisiblePost={handleMobileViewPost}
          />
        ) : null}
      </div>
      <MobileChannelCommentsSheet
        comments={mobileCommentsQuery.data ?? []}
        draft={
          mobileCommentSheetPost
            ? (commentDrafts[mobileCommentSheetPost.id] ?? "")
            : ""
        }
        errorActionLabel={mobileCommentSheetRetryAction?.label}
        errorMessage={mobileCommentSheetErrorMessage}
        isLoading={mobileCommentsQuery.isLoading}
        likePendingCommentId={pendingLikeCommentId}
        open={Boolean(mobileCommentSheetPost)}
        post={mobileCommentSheetPost}
        replyTarget={mobileReplyTarget}
        submitPending={pendingCommentPostId === mobileCommentSheetPost?.id}
        onCancelReply={() => setMobileReplyTarget(null)}
        onClose={() => {
          setMobileCommentSheetPostId(null);
          setMobileReplyTarget(null);
        }}
        onDraftChange={(value) => {
          if (!mobileCommentSheetPost) {
            return;
          }

          updateCommentDraft(mobileCommentSheetPost.id, value);
        }}
        onErrorAction={mobileCommentSheetRetryAction?.onClick}
        onLikeComment={(comment) => {
          if (!ensureCommentPostCanInteract(comment.postId)) return;
          likeCommentMutation.mutate({
            commentId: comment.id,
            postId: comment.postId,
          });
        }}
        onReply={(comment) =>
          setMobileReplyTarget({
            authorId: comment.authorId,
            authorName: comment.authorName,
            commentId: comment.id,
            postId: comment.postId,
          })
        }
        onSubmit={() => {
          if (!mobileCommentSheetPost) {
            return;
          }

          submitComment(mobileCommentSheetPost.id, {
            replyTarget: mobileReplyTarget,
          });
        }}
      />
      <ChannelsForwardPicker
        open={Boolean(forwardPickerPost)}
        postId={forwardPickerPost?.id ?? null}
        postExcerpt={forwardPickerPost?.excerpt}
        baseUrl={baseUrl}
        onClose={() => setForwardPickerPost(null)}
        onForwarded={(target) => {
          setNoticeTone("success");
          setNoticeActionLabel(null);
          setNoticeAction(null);
          setNotice(t(msg`已转发给 ${target.name}。`));
          // 让"我点过转发"的小角标 / shareCount 立即体现
          void queryClient.invalidateQueries({
            queryKey: ["app-channels-home", baseUrl],
          });
        }}
        onForwardFailed={(input) => {
          // 走查 R9：picker 在 mutation pending 时不挡关闭，用户点完好友
          // 立刻关 picker，失败时 picker 内的红条已经不渲染，page 级 notice 兜底。
          setNoticeTone("info");
          setNoticeActionLabel(null);
          setNoticeAction(null);
          setNotice(t(msg`转发给 ${input.targetName} 失败：${input.message}`));
        }}
      />
    </AppPage>
  );
}

function MobileChannelMediaSurface({
  post,
  active,
  userUnmuted,
  onUnlock,
}: {
  post: FeedPostListItem;
  active: boolean;
  userUnmuted: boolean;
  onUnlock: () => void;
}) {
  const t = useRuntimeTranslator();
  const audioAsset = post.media?.find((asset) => asset.kind === "audio");
  const videoAsset = post.media?.find((asset) => asset.kind === "video");

  if (post.mediaType === "audio" && (audioAsset || post.mediaUrl)) {
    const images = (post.media ?? []).filter(
      (asset): asset is Extract<typeof asset, { kind: "image" }> =>
        asset.kind === "image",
    );
    // 兜底：历史 audio 帖只有封面，把它当成单图沉浸式背景
    const fallbackPoster = audioAsset?.posterUrl ?? post.coverUrl ?? null;
    return (
      <ChannelAudioPictorial
        title={
          audioAsset?.title ?? post.title ?? `${post.authorName}·${t(msg`音乐`)}`
        }
        audioUrl={audioAsset?.url ?? post.mediaUrl ?? ""}
        images={images.map((asset) => asset.url)}
        fallbackPosterUrl={fallbackPoster}
        active={active}
        userUnmuted={userUnmuted}
        onUnlock={onUnlock}
      />
    );
  }

  if (post.mediaType === "video" && (videoAsset?.url || post.mediaUrl)) {
    const rawVideoUrl = videoAsset?.url ?? post.mediaUrl ?? undefined;
    const rawPosterUrl = videoAsset?.posterUrl ?? post.coverUrl ?? undefined;
    return (
      <ChannelVideoSurface
        videoUrl={rawVideoUrl}
        posterUrl={rawPosterUrl}
        active={active}
        userUnmuted={userUnmuted}
        onUnlock={onUnlock}
      />
    );
  }

  // 图集帖：mediaType=image 后端确实在 inferFeedMediaType 里会返回。
  // 之前直接走兜底"暂无可播放内容"黑屏；现在复用 audio 的 pictorial 视图
  // 走多图滑动，关掉音频。封面优先用 post.coverUrl，其次第一张 image。
  const imageAssets = (post.media ?? []).filter(
    (asset): asset is Extract<typeof asset, { kind: "image" }> =>
      asset.kind === "image",
  );
  if (
    post.mediaType === "image" &&
    (imageAssets.length > 0 || post.coverUrl || post.mediaUrl)
  ) {
    const fallbackPoster =
      post.coverUrl ?? imageAssets[0]?.url ?? post.mediaUrl ?? null;
    return (
      <ChannelAudioPictorial
        title={post.title ?? post.authorName}
        audioUrl=""
        images={imageAssets.map((asset) => asset.url)}
        fallbackPosterUrl={fallbackPoster}
        active={active}
        userUnmuted={userUnmuted}
        onUnlock={onUnlock}
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] w-full items-center justify-center bg-black px-6 text-center">
      <div>
        <div className="text-[16px] font-semibold text-white">
          {t(msg`暂无可播放内容`)}
        </div>
        <div className="mt-2 text-[13px] leading-6 text-white/72">
          {t(msg`稍后再来看看`)}
        </div>
      </div>
    </div>
  );
}

// 底部进度条 + 拖动 seek：音视频共用。
// 视觉：贴卡片底部、细线（默认 3px，按下拉宽到 6px + 圆形 thumb），白色填充已播放部分。
// 交互：pointer events 统一处理鼠标 / 触屏 / 笔。setPointerCapture 让手指滑出条外也跟手。
// 阻止 touch / click 冒泡，避免触发外层 ChannelAudioPictorial 的 swipe / tap-to-pause。
function MediaProgressBar({
  mediaRef,
  active,
}: {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  active: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const scrubProgressRef = useRef(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    const sync = () => {
      if (scrubbingRef.current) return;
      const d = media.duration;
      if (d > 0 && Number.isFinite(d)) {
        setProgress(media.currentTime / d);
      }
    };
    media.addEventListener("timeupdate", sync);
    media.addEventListener("loadedmetadata", sync);
    media.addEventListener("durationchange", sync);
    sync();
    return () => {
      media.removeEventListener("timeupdate", sync);
      media.removeEventListener("loadedmetadata", sync);
      media.removeEventListener("durationchange", sync);
    };
  }, [mediaRef]);

  // 卡片切走时进度条归零，下次进入避免显示上一首的位置
  useEffect(() => {
    if (!active) setProgress(0);
  }, [active]);

  const computeRatio = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const r = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, r));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 某些环境 setPointerCapture 会抛——忽略即可，仍能通过 move/up 事件继续 scrub
    }
    scrubbingRef.current = true;
    setScrubbing(true);
    const r = computeRatio(event.clientX);
    scrubProgressRef.current = r;
    setProgress(r);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    event.stopPropagation();
    const r = computeRatio(event.clientX);
    scrubProgressRef.current = r;
    setProgress(r);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    event.stopPropagation();
    scrubbingRef.current = false;
    setScrubbing(false);
    const media = mediaRef.current;
    if (media && media.duration > 0 && Number.isFinite(media.duration)) {
      media.currentTime = scrubProgressRef.current * media.duration;
    }
  };

  // 触屏 / 鼠标 / 合成 click 都要拦下来，避免外层 tap-to-pause / swipe 误触
  const stopTouch = (event: React.TouchEvent<HTMLDivElement>) =>
    event.stopPropagation();
  const stopClick = (event: React.MouseEvent<HTMLDivElement>) =>
    event.stopPropagation();

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 z-20 touch-none px-3 py-2.5"
      style={{ bottom: "max(env(safe-area-inset-bottom,0px), 0px)" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
      onClick={stopClick}
    >
      <div
        ref={trackRef}
        className={cn(
          "relative w-full rounded-full bg-white/30 transition-[height]",
          scrubbing ? "h-1.5" : "h-[3px]",
        )}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${progress * 100}%` }}
        />
        {scrubbing ? (
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `${progress * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

// 视频号"图文视频"沉浸式渲染：全卡背景图 + 左右滑切配图 + dots + 音频自动播。
// 历史音乐帖没有多图（images=[]）时，使用 fallbackPosterUrl 当唯一背景，禁用滑动。
//
// 交互参考抖音 / 微信视频号：无显式静音 / 暂停按钮；首次点击解除静音 + 保持播放，
// 之后点击切换 play/pause；暂停态显示居中大 Play 图标作为状态提示。
function ChannelAudioPictorial({
  title,
  audioUrl,
  images,
  fallbackPosterUrl,
  active,
  userUnmuted,
  onUnlock,
}: {
  title: string;
  audioUrl: string;
  images: string[];
  fallbackPosterUrl: string | null;
  active: boolean;
  userUnmuted: boolean;
  onUnlock: () => void;
}) {
  const t = useRuntimeTranslator();
  const displayImages =
    images.length > 0
      ? images
      : fallbackPosterUrl
        ? [fallbackPosterUrl]
        : [];
  const [imageIndex, setImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);
  // 走查 R12 #1：touchend 处理完 tap 后浏览器还会合成一次 click，原 handleClick
  // 仅靠 touchStartXRef !== null 拦不住——touchend 里已经把它清成 null，
  // 合成 click 跑下来又会再 handleTap() 一次，等于点一下 → 一次 pause→一次 play
  // （或反之），用户 tap 想暂停永远暂停不下来，首次 tap 想解除静音也会立刻被
  // 反向 toggle 回去。touchend 走过 tap 后把这个 flag 置 1，吞掉紧跟着的合成 click。
  const suppressNextClickRef = useRef(false);
  // 走查 R13：竖向滑（用户想往下翻到下一张卡）会进 touchstart/touchmove/touchend：
  // handleTouchMove 只在横向位移超阈值时 setSwipeHandledRef，竖向情况下没被标记，
  // touchend 走完 wasSwipe=false 分支 → handleTap() → audio 莫名其妙暂停。
  // 真机上滑动到下一张快滚走时 IntersectionObserver 立刻把 activePostId 切走、
  // 老卡的 useEffect 把 audio.pause() 兜底回去，肉眼看不出来；但在 *同一张卡内*
  // 用户只是稍微往下拖一截（snap-mandatory 会回弹），audio 就真的被 tap 暂停了，
  // 用户没法理解为什么"我什么都没点"音乐就停。任何方向超过 10px 都视为非 tap。
  const movedBeyondTapRef = useRef(false);

  // 进入 active 时播放，离开时暂停 + 复位（保证全局只有一条 audio 在响）。
  // 注意：userUnmuted 不是这里的依赖——否则用户主动暂停后再切静音，会被
  // 重新强制 play()，违反暂停意图。muted 同步交给下方独立 effect。
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (active && audioUrl) {
      audio.muted = !userUnmuted;
      const promise = audio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {
          audio.muted = true;
          audio.play().catch(() => undefined);
        });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, audioUrl]);

  // mute 切换仅同步 audio.muted，不重新 play
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = !userUnmuted;
  }, [userUnmuted]);

  // 切贴时重置图片索引
  useEffect(() => {
    if (!active) setImageIndex(0);
  }, [active]);

  // tab 切到后台时主动 pause，回前台时按"切走前是否在播"决定是否 resume——
  // desktop Chrome 默认背景标签里 HTML5 audio 不会自动暂停，视频号 BGM 会
  // 一直跟着用户去别的标签里响，电池/数据/隐私都不友好。
  // 只对当前 active 卡处理；非 active 卡反正已经 pause 了。
  useEffect(() => {
    if (!active || !audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    let wasPlayingBeforeHide = false;
    const onVisibilityChange = () => {
      if (document.hidden) {
        wasPlayingBeforeHide = !audio.paused;
        if (wasPlayingBeforeHide) audio.pause();
      } else if (wasPlayingBeforeHide) {
        audio.play().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, audioUrl]);

  const canSwipe = displayImages.length > 1;

  const goNext = () => {
    if (!canSwipe) return;
    setImageIndex((i) => (i + 1 >= displayImages.length ? 0 : i + 1));
  };
  const goPrev = () => {
    if (!canSwipe) return;
    setImageIndex((i) => (i - 1 < 0 ? displayImages.length - 1 : i - 1));
  };

  // 点击屏幕处理：首次点解除静音 + 强制 play；之后切 play/pause。
  const handleTap = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!userUnmuted) {
      onUnlock();
      audio.muted = false;
      if (audio.paused) audio.play().catch(() => undefined);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    swipeHandledRef.current = false;
    movedBeyondTapRef.current = false;
  };
  const handleTouchMove = (event: React.TouchEvent) => {
    if (swipeHandledRef.current) return;
    const touch = event.touches[0];
    if (!touch || touchStartXRef.current == null || touchStartYRef.current == null) {
      return;
    }
    const dx = touch.clientX - touchStartXRef.current;
    const dy = touch.clientY - touchStartYRef.current;
    // 任何方向超过 10px 就算"用户在滑而不是点"——iOS/Android tap 阈值都在这附近，
    // touchend 时拒绝走 handleTap，避免竖向滚动顺手把 audio 暂停 / 解除静音。
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      movedBeyondTapRef.current = true;
    }
    // 横向位移占主导且超阈值 → 切图；竖向占主导 → 让外层 snap-y 接管
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipeHandledRef.current = true;
      if (dx < 0) goNext();
      else goPrev();
    }
  };
  const handleTouchEnd = () => {
    const wasSwipe = swipeHandledRef.current;
    const movedBeyondTap = movedBeyondTapRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    if (!wasSwipe && !movedBeyondTap) {
      // 纯点击：切播放/暂停（首次顺带解除静音）
      // 标记：本次合成 click 要被吞掉，否则下面 handleClick 会再跑一次 handleTap
      suppressNextClickRef.current = true;
      handleTap();
    }
    // swipeHandledRef / movedBeyondTapRef 不在这里清——下面 onClick 还要看；
    // 都改在 touchStart 重置。
  };
  // 桌面鼠标场景兜底：触屏 touchend 后浏览器仍会合成 click，但 swipe
  // 期间 click 多数浏览器会自动取消；这里只为非触屏鼠标点击服务。
  const handleClick = (event: React.MouseEvent) => {
    if (event.detail === 0) return; // 由键盘等触发的 synthetic click 忽略
    // touch 路径已经在 touchend 里跑过 handleTap；suppress flag 吃掉对应的合成 click。
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (swipeHandledRef.current) return;
    // touch 路径下大幅滑动浏览器通常不会再 fire 合成 click，但同样兜底拦一下，
    // 避免某些设备上的边缘行为重新触发 handleTap。
    if (movedBeyondTapRef.current) return;
    handleTap();
  };

  const currentImage = displayImages[imageIndex];

  return (
    <div
      className="relative h-full min-h-[calc(100dvh-12rem)] w-full overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={isPlaying ? t(msg`暂停`) : t(msg`播放`)}
    >
      {currentImage ? (
        <img
          key={currentImage}
          src={resolveAppMediaUrl(currentImage)}
          alt={title}
          draggable={false}
          // active 卡可见，其余卡都堆在下方 snap-y 列表里不可见；
          // 没有 lazy 时 ~20 张专辑封面同时拉，公网隧道下首屏明显堆积。
          loading={active ? "eager" : "lazy"}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1f2533] to-[#0a0c10]">
          <Music2 size={56} className="text-white/40" />
        </div>
      )}

      {/* 桌面/平板鼠标用左右大箭头 */}
      {canSwipe ? (
        <>
          <button
            type="button"
            aria-label={t(msg`上一张`)}
            onClick={(event) => {
              event.stopPropagation();
              goPrev();
            }}
            className="group absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white/80 backdrop-blur-sm transition hover:bg-black/50 md:flex"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            aria-label={t(msg`下一张`)}
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            className="group absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white/80 backdrop-blur-sm transition hover:bg-black/50 md:flex"
          >
            <ArrowLeft size={20} className="rotate-180" />
          </button>
        </>
      ) : null}

      {/* 暂停状态指示：居中大 Play 图标。
          图集帖（audioUrl=""）没有播放/暂停语义，否则用户点一下解除静音后就一直挂着 Play 图标。 */}
      {audioUrl && active && userUnmuted && !isPlaying ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <Play size={32} className="text-white" fill="white" />
          </div>
        </div>
      ) : null}

      {/* 底部居中 dots */}
      {canSwipe ? (
        <div className="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5"
          style={{ bottom: "max(env(safe-area-inset-bottom,0px), 16rem)" }}
        >
          {displayImages.map((_, idx) => (
            <span
              key={idx}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === imageIndex
                  ? "w-5 bg-white"
                  : "w-1.5 bg-white/45",
              )}
            />
          ))}
        </div>
      ) : null}

      {/* 隐藏音频元素：实际播放走 useEffect 控制。
          仅 active 卡挂 src + preload metadata；其它卡 src 留空避免 25+ 卡
          一起触发 mp3 metadata 拉取（实测一次 /discover/channels 进入会并发
          27 条 minimax-music.mp3，离开时全 ERR_ABORTED，纯浪费带宽与公网隧道
          RTT，移动端公网下首屏会卡顿）。 */}
      <audio
        ref={audioRef}
        src={active && audioUrl ? resolveAppMediaUrl(audioUrl) : undefined}
        loop
        preload={active ? "metadata" : "none"}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* 图集帖（audioUrl="") 没东西可 seek，进度条会一直停在 0% 又占点击区——直接不渲染。 */}
      {audioUrl ? (
        <MediaProgressBar mediaRef={audioRef} active={active} />
      ) : null}
    </div>
  );
}

// 视频沉浸式播放：active 时自动播 + muted 跟 userUnmuted；离开暂停 + 复位。
// 交互参考抖音 / 微信视频号：无显式静音 / 暂停按钮；首次点击解除静音 + 保持播放，
// 之后点击切换 play/pause；暂停态显示居中大 Play 图标作为状态提示。
function ChannelVideoSurface({
  videoUrl,
  posterUrl,
  active,
  userUnmuted,
  onUnlock,
}: {
  videoUrl: string | undefined;
  posterUrl: string | undefined;
  active: boolean;
  userUnmuted: boolean;
  onUnlock: () => void;
}) {
  const t = useRuntimeTranslator();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 同 audio：userUnmuted 不当依赖，避免用户暂停后被强制 replay。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && videoUrl) {
      video.muted = !userUnmuted;
      const promise = video.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {
          video.muted = true;
          video.play().catch(() => undefined);
        });
      }
    } else {
      video.pause();
      video.currentTime = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = !userUnmuted;
  }, [userUnmuted]);

  // 同 audio：tab 切到后台时主动 pause，回前台按切走前状态恢复。
  useEffect(() => {
    if (!active || !videoUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let wasPlayingBeforeHide = false;
    const onVisibilityChange = () => {
      if (document.hidden) {
        wasPlayingBeforeHide = !video.paused;
        if (wasPlayingBeforeHide) video.pause();
      } else if (wasPlayingBeforeHide) {
        video.play().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, videoUrl]);

  const handleTap = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!userUnmuted) {
      onUnlock();
      video.muted = false;
      if (video.paused) video.play().catch(() => undefined);
      return;
    }
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  return (
    <div
      className="relative h-full min-h-[calc(100dvh-12rem)] w-full bg-black"
      onClick={handleTap}
      role="button"
      tabIndex={0}
      aria-label={isPlaying ? t(msg`暂停`) : t(msg`播放`)}
    >
      {/* 仅 active 卡挂 src；其它卡只显 poster，避免页面挂 N 个 <video>
          自动拉 metadata（每条几百 KB）。视频源切换由 active 翻转 + 上面
          useEffect 的 .play() 触发，poster 始终可见保持视觉。 */}
      <video
        ref={videoRef}
        key={videoUrl}
        src={active && videoUrl ? resolveAppMediaUrl(videoUrl) : undefined}
        poster={posterUrl ? resolveAppMediaUrl(posterUrl) : undefined}
        playsInline
        loop
        preload={active ? "auto" : "none"}
        controls={false}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="pointer-events-none h-full min-h-[calc(100dvh-12rem)] w-full object-cover"
      />
      {active && userUnmuted && !isPlaying ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <Play size={32} className="text-white" fill="white" />
          </div>
        </div>
      ) : null}

      <MediaProgressBar mediaRef={videoRef} active={active} />
    </div>
  );
}

function MobileChannelsStatusCard({
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
      className={cn(
        "rounded-[16px] border px-3.5 py-4 text-center shadow-none",
        tone === "danger"
          ? "border-[color:var(--border-danger)] bg-[linear-gradient(180deg,rgba(255,245,245,0.96),rgba(254,242,242,0.94))]"
          : "border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]",
      )}
    >
      <div
        className={cn(
          "mx-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.04em]",
          tone === "danger"
            ? "bg-[rgba(220,38,38,0.08)] text-[color:var(--state-danger-text)]"
            : "bg-[rgba(7,193,96,0.1)] text-[#07c160]",
        )}
      >
        {badge}
      </div>
      {loading ? (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black/15 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-black/25 animate-pulse [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-[#8ecf9d] animate-pulse [animation-delay:240ms]" />
        </div>
      ) : null}
      <div className="mt-2.5 text-[14px] font-medium text-[color:var(--text-primary)]">
        {title}
      </div>
      <p className="mx-auto mt-1.5 max-w-[17rem] text-[11px] leading-[1.35rem] text-[color:var(--text-secondary)]">
        {description}
      </p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </section>
  );
}

function createDesktopChannelRoutePost(
  post: FeedPostWithComments,
): FeedPostListItem {
  return {
    ...post,
    commentsPreview: post.comments,
  };
}

type MobileChannelsViewportProps = {
  activeSection: FeedChannelHomeSection;
  likePendingPostId: string | null;
  favoritePendingPostId: string | null;
  followPendingAuthorId: string | null;
  posts: FeedPostListItem[];
  commentsPreviewByPostId?: Record<string, FeedComment[]>;
  routeSelectedPostId: string | null;
  onLike: (postId: string) => void;
  onOpenAuthor: (post: FeedPostListItem) => void;
  onOpenComments: (post: FeedPostListItem) => void;
  onNotInterested: (postId: string) => void;
  onShare: (post: FeedPostListItem) => void;
  onToggleFollowAuthor: (post: FeedPostListItem) => void;
  onToggleFavorite: (post: FeedPostListItem) => void;
  onVisiblePost: (postId: string) => void;
};

function MobileChannelsViewport({
  activeSection,
  likePendingPostId,
  favoritePendingPostId,
  followPendingAuthorId,
  posts,
  commentsPreviewByPostId,
  routeSelectedPostId,
  onLike,
  onOpenAuthor,
  onOpenComments,
  onNotInterested,
  onShare,
  onToggleFollowAuthor,
  onToggleFavorite,
  onVisiblePost,
}: MobileChannelsViewportProps) {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  // 抖音风：用户首次点屏幕解除静音后，整页保持解除静音（单向，不再回到 muted）
  const [userUnmuted, setUserUnmuted] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 切 tab 时把滚动复位到顶部 + active 重置：之前用户在 推荐 tab 滚到第 5 张，
  // 切去 朋友 tab，如果 朋友 tab 有缓存（isLoading=false），viewport 不会 unmount，
  // scrollTop 留在原位，新 tab 的内容从中间显示，非常错乱。切到新 tab 就当成
  // 「从头开始看」，体感对齐抖音 / 视频号。
  // 不依赖 posts，因为 posts 数组身份在 home 刷新时也会变（点赞 / 关注的
  // optimistic + invalidate），那时不该 reset 滚动。
  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    if (node.scrollTop !== 0) {
      node.scrollTop = 0;
    }
    setActivePostId(null);
  }, [activeSection]);

  // 首次有数据时 pick 第一条作为 active；之后 activePostId 由 IntersectionObserver
  // 维护。注意：如果 activePostId 指向的 post 被删（"减少推荐"乐观 filter 掉），
  // 不要回退到 posts[0]——用户可能滚到了第 5 张，posts[0] 跟他看的不是一回事，
  // 强切回去会让最顶上那条音频替换掉他正在看的卡片的音频。留 stale 一帧让
  // observer 重算 → setActivePostId(实际可见的卡)。极端情况 (observer 不 fire) 下
  // 才退化到 posts[0]，用 setTimeout 兜底。
  const fallbackTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!posts.length) {
      setActivePostId(null);
      return;
    }

    if (!activePostId) {
      setActivePostId(posts[0]?.id ?? null);
      return;
    }

    if (!posts.some((post) => post.id === activePostId)) {
      // 留 350ms 让 IntersectionObserver 在新布局里 fire 一次；超时还没拿到
      // 真正的可见卡，再退化到 posts[0]。
      if (fallbackTimerRef.current != null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null;
        setActivePostId((current) => {
          // 这期间 observer 已经 fire 把 activePostId 换成存在的 post → 别覆盖
          if (current && posts.some((p) => p.id === current)) return current;
          return posts[0]?.id ?? null;
        });
      }, 350);
      return () => {
        if (fallbackTimerRef.current != null) {
          window.clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
      };
    }
  }, [activePostId, posts]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const nextEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          )[0];
        const nextPostId = nextEntry?.target.getAttribute("data-post-id");
        if (nextPostId) {
          setActivePostId(nextPostId);
        }
      },
      {
        threshold: [0.45, 0.65, 0.85],
        rootMargin: "-10% 0px -14% 0px",
      },
    );

    observerRef.current = observer;
    cardRefs.current.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const registerCardRef = (postId: string, node: HTMLElement | null) => {
    const previous = cardRefs.current.get(postId);
    if (previous && previous !== node) {
      observerRef.current?.unobserve(previous);
    }

    if (node) {
      cardRefs.current.set(postId, node);
      observerRef.current?.observe(node);
    } else {
      cardRefs.current.delete(postId);
    }
  };
  // 每张卡传给 <article ref={...}> 的回调，必须按 postId 稳定。
  // 原来用 `(node) => registerCardRef(post.id, node)` 内联 arrow，每次父级 re-render
  // 都是新引用，React 会先把旧回调以 null 调用一次再以 element 调新回调，等于
  // 每次 re-render 把这张卡 unobserve + observe 一遍。视频号 home 上 IntersectionObserver
  // 维护的就是「当前居中的卡」，重复 unobserve/observe 期间它可能漏掉一次
  // intersection 事件——表现是滑过去音频没自动切。useRef 缓存按 postId 缓存稳定回调。
  const cardRefCallbacksRef = useRef(
    new Map<string, (node: HTMLElement | null) => void>(),
  );
  const getCardRefCallback = (postId: string) => {
    let cb = cardRefCallbacksRef.current.get(postId);
    if (!cb) {
      cb = (node) => registerCardRef(postId, node);
      cardRefCallbacksRef.current.set(postId, cb);
    }
    return cb;
  };
  // 防 cardRefCallbacksRef 长期累积 stale postId：每次 posts 变化时把不在
  // 当前 posts 里的回调清掉。
  useEffect(() => {
    const liveIds = new Set(posts.map((p) => p.id));
    cardRefCallbacksRef.current.forEach((_, key) => {
      if (!liveIds.has(key)) {
        cardRefCallbacksRef.current.delete(key);
      }
    });
  }, [posts]);

  // 进入页面时按 URL 的 #postId 把指定卡滚到顶部一次。
  // 不要把 posts 整体当 deps：home 一刷新（点赞 invalidate / generate / decorations）
  // posts 数组身份就变，这个 effect 会重跑 scrollIntoView，把用户从他正在看的位置
  // 拽回 routeSelectedPostId。只在 routeSelectedPostId 变化、或目标 post 刚刚出现
  // 在 posts 里时滚一次。
  // 用 hasRouteTargetInPosts 而不是 posts.length / posts：channelsQuery 慢（公网
  // 隧道下 500-800ms）时，effect 第一次跑 cardRefs 为空，原来的 20 RAF (~330ms)
  // 轮询会兜底失败 → routeSelectedPostId 没变后续永不重跑。改成 posts 里出现目标
  // 时（hasTarget false→true）就再触发一次，覆盖 API 慢的场景。
  const scrolledRouteIdRef = useRef<string | null>(null);
  const hasRouteTargetInPosts = routeSelectedPostId
    ? posts.some((post) => post.id === routeSelectedPostId)
    : false;
  useEffect(() => {
    if (!routeSelectedPostId) {
      scrolledRouteIdRef.current = null;
      return;
    }
    if (scrolledRouteIdRef.current === routeSelectedPostId) {
      return;
    }
    if (!hasRouteTargetInPosts) {
      // 目标还没在 posts 里——别 RAF 浪费帧，等下次 hasRouteTargetInPosts 翻 true 再跑。
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const targetNode = cardRefs.current.get(routeSelectedPostId);
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "start" });
        setActivePostId(routeSelectedPostId);
        scrolledRouteIdRef.current = routeSelectedPostId;
        return;
      }
      attempts += 1;
      // ~20 帧（≈330ms）兜底，避开"卡片刚 mount 但 ref 还没注册"的渲染窗
      if (attempts < 20) {
        window.requestAnimationFrame(tryScroll);
      }
    };
    window.requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
  }, [routeSelectedPostId, hasRouteTargetInPosts]);

  // 视频号是 snap-y 短视频流，用户经常一甩划过 5-10 张卡。原来 activePostId
  // 一变就立刻 POST /feed/:id/view，背后会做 owner-interaction findOneBy + 落库
  // + （首次）viewCount/watchCount 自增，rapid swipe 时实测一秒能打掉 6-8 次没人
  // 真在看的"观看"。加 600ms 防抖：用户在某条上停留够久才算 view，扫过的卡不发。
  useEffect(() => {
    if (!activePostId) {
      return;
    }
    const postId = activePostId;
    const timer = window.setTimeout(() => {
      onVisiblePost(postId);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activePostId, onVisiblePost]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-[calc(100dvh-9.6rem)] snap-y snap-mandatory space-y-2 overflow-y-auto overscroll-contain scroll-pb-2 pb-2"
    >
      {posts.map((post) => (
        <MobileChannelsCard
          key={post.id}
          activeSection={activeSection}
          active={activePostId === post.id}
          favorite={Boolean(post.ownerState?.hasFavorited)}
          likePending={likePendingPostId === post.id}
          favoritePending={favoritePendingPostId === post.id}
          followPending={followPendingAuthorId === post.authorId}
          post={post}
          commentsPreview={
            commentsPreviewByPostId?.[post.id] ?? post.commentsPreview ?? []
          }
          setCardRef={getCardRefCallback(post.id)}
          userUnmuted={userUnmuted}
          onUnlock={() => setUserUnmuted(true)}
          onLike={() => onLike(post.id)}
          onOpenAuthor={() => onOpenAuthor(post)}
          onOpenComments={() => onOpenComments(post)}
          onNotInterested={() => onNotInterested(post.id)}
          onShare={() => onShare(post)}
          onToggleFollowAuthor={() => onToggleFollowAuthor(post)}
          onToggleFavorite={() => onToggleFavorite(post)}
        />
      ))}
    </div>
  );
}

type MobileChannelsCardProps = {
  activeSection: FeedChannelHomeSection;
  active: boolean;
  favorite: boolean;
  likePending: boolean;
  favoritePending: boolean;
  followPending: boolean;
  post: FeedPostListItem;
  commentsPreview: FeedComment[];
  setCardRef: (node: HTMLElement | null) => void;
  userUnmuted: boolean;
  onUnlock: () => void;
  onLike: () => void;
  onOpenAuthor: () => void;
  onOpenComments: () => void;
  onNotInterested: () => void;
  onShare: () => void;
  onToggleFollowAuthor: () => void;
  onToggleFavorite: () => void;
};

function MobileChannelsCard({
  activeSection,
  active,
  favorite,
  likePending,
  favoritePending,
  followPending,
  post,
  commentsPreview,
  setCardRef,
  userUnmuted,
  onUnlock,
  onLike,
  onOpenAuthor,
  onOpenComments,
  onNotInterested,
  onShare,
  onToggleFollowAuthor,
  onToggleFavorite,
}: MobileChannelsCardProps) {
  const t = useRuntimeTranslator();
  return (
    <article
      ref={setCardRef}
      data-post-id={post.id}
      className="snap-start scroll-mt-2 overflow-hidden rounded-[18px] border border-[color:var(--border-subtle)] bg-white shadow-none"
    >
      <div className="relative min-h-[calc(100dvh-12rem)] bg-[#0f1115]">
        <MobileChannelMediaSurface
          post={post}
          active={active}
          userUnmuted={userUnmuted}
          onUnlock={onUnlock}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0))]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.88))]" />

        <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5">
          <div className="rounded-full bg-[rgba(15,23,42,0.62)] px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-white">
            {getChannelsSectionBadge(activeSection, t)}
          </div>
        </div>

        <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
          <div className="flex flex-col items-center gap-2.5">
            <ActionRailButton
              active={Boolean(post.ownerState?.hasLiked)}
              label={likePending ? t(msg`处理中`) : String(post.likeCount)}
              ariaLabel={
                post.ownerState?.hasLiked
                  ? t(msg`取消点赞，当前 ${post.likeCount} 赞`)
                  : t(msg`点赞，当前 ${post.likeCount} 赞`)
              }
              // 视频号点赞改成 toggle 后，rapid click 容易让多个 mutation 并发：
              // 点 → unlike → 点 → like → 点 → unlike，三条请求并行回 server，
              // 谁先成功谁先落库，最终状态可能跟用户最后一次点击的"意图"对不上。
              // 锁住按钮直到当前 mutation 落地，避免叠死。
              disabled={likePending}
              onClick={onLike}
            >
              <ThumbsUp
                size={17}
                className={
                  post.ownerState?.hasLiked ? "fill-current" : undefined
                }
              />
            </ActionRailButton>
            <ActionRailButton
              label={String(post.commentCount)}
              ariaLabel={t(msg`打开评论，当前 ${post.commentCount} 条`)}
              onClick={onOpenComments}
            >
              <MessageCircleMore size={17} />
            </ActionRailButton>
            <ActionRailButton
              active={favorite}
              label={
                favoritePending
                  ? t(msg`处理中`)
                  : favorite
                    ? t(msg`已收藏`)
                    : t(msg`收藏`)
              }
              disabled={favoritePending}
              onClick={onToggleFavorite}
            >
              {favorite ? (
                <Bookmark size={17} className="fill-current" />
              ) : (
                <Bookmark size={17} />
              )}
            </ActionRailButton>
            <ActionRailButton label={t(msg`分享`)} onClick={onShare}>
              <Share2 size={17} />
            </ActionRailButton>
            <ActionRailButton
              label={t(msg`减少推荐`)}
              onClick={onNotInterested}
            >
              <EyeOff size={17} />
            </ActionRailButton>
          </div>
        </div>

        {/*
          外层 inset-x-0 是 100% 宽，pointer-events 默认会接管整条底部带状区域；
          但内层只用了 max-w-[calc(100%-4.25rem)] 来视觉避让右侧 action rail，
          留出的 68px 右侧空白条仍然在外层 hit 范围里 —— 它会盖到 action rail
          底部两颗按钮（分享 / 减少推荐）的点击区，导致用户怎么点都点不到。
          外层 pointer-events-none + 内层 auto，让"无内容的空白条"不挡事件。
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3.5 pb-3.5">
          <div className="pointer-events-auto max-w-[calc(100%-4.25rem)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAuthor}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <AvatarChip
                  name={post.authorName}
                  src={post.authorAvatar}
                  size="wechat"
                />
                <div className="min-w-0 flex-1 text-white">
                  <div className="truncate text-[12px] font-medium">
                    {post.authorName}
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/70">
                    {t(
                      msg`${formatTimestamp(post.createdAt)} · 视频号动态`,
                    )}
                  </div>
                </div>
              </button>
              {post.authorId !== SELF_CHARACTER_ID ? (
                // 「我自己」是用户的代理角色，关注 / 取消关注自己没语义；前后端
                // 都没禁——但后端 followChannelAuthor 对 owner===authorId 才
                // no-op，char-default-self 不是 owner.id，会真插一行 follow 记录，
                // 视觉上落到 "已关注" 来回切看着很怪。直接在 UI 隐掉。
                <button
                  type="button"
                  onClick={onToggleFollowAuthor}
                  // rapid click 会让 follow / unfollow 同时在路上，状态可能跟最后一次
                  // 点击意图对不上；锁到 mutation 落地。
                  disabled={followPending}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-70",
                    post.ownerState?.isFollowingAuthor
                      ? "border border-white/20 bg-white/10 text-white/72"
                      : "bg-[#07c160] text-white",
                  )}
                >
                  {followPending
                    ? t(msg`处理中...`)
                    : post.ownerState?.isFollowingAuthor
                      ? t(msg`已关注`)
                      : t(msg`+关注`)}
                </button>
              ) : null}
            </div>
            {post.title ? (
              <div className="mt-2 text-[13px] font-medium text-white">
                {post.title}
              </div>
            ) : null}
            {(() => {
              // 视频号 audio post 后端常把 title 和 text 都填成 "X·音乐"，
              // 标题和正文重复出现没意义；只在两者不一致时才渲染正文。
              const cleanText = stripToolCallSyntax(post.text);
              if (!cleanText || cleanText === post.title) {
                return null;
              }
              return (
                <ExpandableText
                  text={cleanText}
                  className="mt-1"
                  textClassName="text-[12px] leading-[1.35rem] text-white"
                  toggleClassName="text-[11px] text-white/82"
                />
              );
            })()}
            {post.topicTags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-white/72">
                {post.topicTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[rgba(255,255,255,0.12)] px-2 py-1"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-2 text-[9px] text-white/65">
              {formatChannelMeta(post, t)}
            </div>
            <div className="mt-2 rounded-[16px] bg-[rgba(255,255,255,0.12)] px-2.5 py-2 text-[10px] leading-4 text-white/86 backdrop-blur">
              {commentsPreview.length ? (
                <>
                  <div className="mb-1 text-[9px] uppercase tracking-[0.03em] text-white/60">
                    {t(msg`最近评论`)}
                  </div>
                  <div className="space-y-1">
                    {commentsPreview.slice(0, 2).map((comment) => (
                      <div key={comment.id}>
                        <span className="font-medium">
                          {comment.authorName}
                        </span>
                        {`：${stripToolCallSyntax(comment.text)}`}
                      </div>
                    ))}
                  </div>
                </>
              ) : post.commentCount > 0 ? (
                // home 主接口先返回，decorations 第二个并行请求才带 commentsPreview。
                // 在 decorations 落地前，commentCount > 0 的卡如果显示"还没有评论"
                // 会和 action rail 上"143 评论"的小角标自相矛盾——给个占位提示。
                <span className="text-white/70">
                  {t(msg`正在载入最近评论...`)}
                </span>
              ) : (
                <span>{t(msg`还没有评论，先聊一句。`)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border-subtle)] bg-white px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[color:var(--text-muted)]">
          <span>
            {post.mediaType === "video"
              ? t(msg`短片`)
              : post.mediaType === "audio"
                ? t(msg`音乐`)
                : post.mediaType === "image"
                  ? t(msg`图集`)
                  : t(msg`内容卡片`)}
          </span>
          <span>{t(msg`${post.likeCount} 赞`)}</span>
          <span>{t(msg`${post.commentCount} 评论`)}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenComments}
          className="h-8 rounded-full border-[color:var(--border-subtle)] bg-[#f8f8f8] px-3 text-[11px] text-[color:var(--text-primary)] shadow-none"
        >
          {t(msg`打开评论`)}
        </Button>
      </div>
    </article>
  );
}

function ActionRailButton({
  children,
  label,
  ariaLabel,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  label: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className="flex flex-col items-center gap-1 text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.62)] backdrop-blur transition-colors",
          active && "bg-[#07c160] shadow-[0_10px_24px_rgba(7,193,96,0.14)]",
        )}
      >
        {children}
      </span>
      <span className="text-[9px]">{label}</span>
    </button>
  );
}

function MobileChannelCommentsSheet({
  comments,
  draft,
  errorActionLabel,
  errorMessage,
  isLoading,
  likePendingCommentId,
  open,
  post,
  replyTarget,
  submitPending,
  onCancelReply,
  onClose,
  onDraftChange,
  onErrorAction,
  onLikeComment,
  onReply,
  onSubmit,
}: {
  comments: FeedComment[];
  draft: string;
  errorActionLabel?: string;
  errorMessage?: string | null;
  isLoading: boolean;
  likePendingCommentId: string | null;
  open: boolean;
  post: FeedPostListItem | null;
  replyTarget: {
    authorId: string;
    authorName: string;
    commentId: string;
    postId: string;
  } | null;
  submitPending: boolean;
  onCancelReply: () => void;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onErrorAction?: () => void;
  onLikeComment: (comment: FeedComment) => void;
  onReply: (comment: FeedComment) => void;
  onSubmit: () => void;
}) {
  const t = useRuntimeTranslator();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const previousCommentCountRef = useRef(0);
  const commentAuthorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    comments.forEach((comment) => {
      map.set(comment.id, comment.authorName);
    });
    return map;
  }, [comments]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Sheet 关闭时重置自动滚动 flag，下次再打开重新跑一次。previousCommentCountRef
  // 也复位以便下次打开时不会把首次 0→N 数据到位误判成"用户刚刚发了一条评论"。
  useEffect(() => {
    if (!open) {
      hasAutoScrolledRef.current = false;
      previousCommentCountRef.current = 0;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [open, replyTarget?.commentId]);

  // 视频号评论按 createdAt ASC 排（最老的在最上面，回复链路顺着对话读起来才连贯），
  // 但 yuanzui0728 这条 post 已经积了 142 条评论：用户打开评论面板第一眼看到的
  // 是 5 天前的旧评论，要手动滑到底部才能看到刚刚的对话。WeChat 视频号 / TikTok
  // 都是默认把视图落到「最新」位置。
  //  - 打开 sheet 且 comments 第一次到位（hasAutoScrolledRef）→ 跳到底部
  //  - 用户在 sheet 里发了新评论（commentCount 变大）→ 也跟着滚到底，体感对齐"发送即看到"
  // 用 scrollTop = scrollHeight 而不是 scrollIntoView 末条，避免在 sheet 容器
  // 之外（外层 body）产生连带滚动。
  useEffect(() => {
    if (!open || isLoading) {
      return;
    }
    if (!comments.length) {
      previousCommentCountRef.current = 0;
      return;
    }

    const node = scrollContainerRef.current;
    if (!node) return;

    const previousCount = previousCommentCountRef.current;
    const growth = comments.length > previousCount;
    if (!hasAutoScrolledRef.current || growth) {
      hasAutoScrolledRef.current = true;
      previousCommentCountRef.current = comments.length;
      // RAF 一次：确保 list 已经 layout，scrollHeight 取到稳定值
      window.requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      });
    } else {
      previousCommentCountRef.current = comments.length;
    }
  }, [open, comments, isLoading]);

  if (!open || !post) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.14)]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t(msg`关闭评论面板`)}
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col overflow-hidden rounded-t-[20px] border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] pt-2 shadow-[0_-14px_28px_rgba(15,23,42,0.10)]">
        <div className="flex justify-center pb-1.5">
          <div className="h-1 w-10 rounded-full bg-[rgba(148,163,184,0.45)]" />
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[14px] font-medium text-[#111827]">
                {t(msg`评论`)}
              </div>
              <div className="rounded-full bg-[rgba(7,193,96,0.1)] px-2 py-0.5 text-[10px] font-medium text-[#07c160]">
                {t(msg`${post.commentCount} 条`)}
              </div>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-[1.35rem] text-[#6b7280]">
              {(() => {
                const cleanText = stripToolCallSyntax(post.text);
                if (post.title) {
                  return cleanText && cleanText !== post.title
                    ? `${post.title} · ${cleanText}`
                    : post.title;
                }
                return cleanText;
              })()}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#6b7280] transition active:bg-[color:var(--surface-card-hover)]"
          >
            <X size={15} />
          </button>
        </div>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        >
          {errorMessage ? (
            <InlineNotice
              tone="warning"
              className="rounded-[14px] border-[color:var(--border-danger)] bg-white"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">{errorMessage}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {errorActionLabel && onErrorAction ? (
                    <button
                      type="button"
                      onClick={onErrorAction}
                      className="rounded-full border border-[rgba(220,38,38,0.14)] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:var(--state-danger-text)]"
                    >
                      {errorActionLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[10px] font-medium text-[#6b7280]"
                  >
                    {t(msg`返回视频号`)}
                  </button>
                </div>
              </div>
            </InlineNotice>
          ) : null}
          {isLoading && !comments.length ? (
            <div className="rounded-[16px] border border-[color:var(--border-subtle)] bg-white px-4 py-5 text-center text-[12px] text-[#6b7280]">
              {t(msg`正在读取评论...`)}
            </div>
          ) : null}
          {!isLoading && !comments.length ? (
            <div className="rounded-[16px] border border-dashed border-[color:var(--border-subtle)] bg-white px-4 py-5 text-center text-[12px] leading-6 text-[#6b7280]">
              {t(msg`还没有评论，先发第一句。`)}
            </div>
          ) : null}
          {comments.length ? (
            <div className="space-y-3">
              {comments.map((comment) => {
                // 优先用后端 serializeComment 给的 replyToAuthorName——本地
                // commentAuthorNameMap 只能反查到当前已显示的 comments；如果被
                // 回复的根评论在分页之外 / 已删 / 已隐，本地 map 是空，"回复 X"
                // 整段就漏掉了。后端的 lookup map 是整个 post 全量评论 + 单条
                // reply 新建时临时灌入，覆盖面更广，优先取后端值。
                const replyTargetName = comment.replyToCommentId
                  ? (comment.replyToAuthorName ??
                      commentAuthorNameMap.get(comment.replyToCommentId) ??
                      null)
                  : null;

                return (
                  <div
                    key={comment.id}
                    className="rounded-[16px] border border-[color:var(--border-subtle)] bg-white px-3.5 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <AvatarChip
                        name={comment.authorName}
                        src={comment.authorAvatar}
                        size="wechat"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="truncate font-medium text-[#111827]">
                            {comment.authorName}
                          </span>
                          <span className="text-[#9ca3af]">
                            {formatTimestamp(comment.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 text-[12px] leading-6 text-[#111827]">
                          {replyTargetName ? (
                            <span className="text-[#6b7280]">
                              {t(msg`回复 ${replyTargetName}`)}
                              {"："}
                            </span>
                          ) : null}
                          {stripToolCallSyntax(comment.text)}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-[11px] text-[#6b7280]">
                          <button
                            type="button"
                            onClick={() => onReply(comment)}
                            className="transition active:text-[#111827]"
                          >
                            {t(msg`回复`)}
                          </button>
                          <button
                            type="button"
                            disabled={
                              comment.likedByOwner ||
                              likePendingCommentId === comment.id
                            }
                            onClick={() => onLikeComment(comment)}
                            className={cn(
                              "inline-flex items-center gap-1 transition",
                              comment.likedByOwner
                                ? "text-[#07c160]"
                                : "active:text-[#111827]",
                            )}
                          >
                            <ThumbsUp size={12} />
                            {likePendingCommentId === comment.id
                              ? t(msg`处理中`)
                              : comment.likedByOwner
                                ? t(msg`已赞 ${comment.likeCount}`)
                                : t(msg`赞 ${comment.likeCount}`)}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="border-t border-[color:var(--border-subtle)] bg-white px-4 pb-2 pt-3">
          {replyTarget ? (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-[12px] bg-[rgba(7,193,96,0.08)] px-3 py-2 text-[11px] text-[#166534]">
              <div className="truncate">
                {t(msg`正在回复 ${replyTarget.authorName}`)}
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                className="text-[#166534] transition active:opacity-70"
              >
                {t(msg`取消`)}
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={
                replyTarget
                  ? t(msg`回复 ${replyTarget.authorName}...`)
                  : t(msg`说点什么...`)
              }
              // 走查 R11：服务端 assertCommentText 上限 500 字（UTF-16 length），
              // 之前 textarea 没卡，用户写 600 字提交才看到「评论最多 500 字。」
              // 红条，已经粘贴/打字写好的内容要手动删一段。maxLength 让浏览器
              // 在输入阶段就硬截断，移动端原生输入法也会跟着不再让用户多敲。
              maxLength={500}
              className="min-h-[72px] flex-1 rounded-[16px] border-[color:var(--border-subtle)] bg-[#f7f7f7] px-3 py-2 text-[13px] shadow-none focus:border-[rgba(7,193,96,0.2)] focus:bg-white"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!draft.trim() || submitPending}
              onClick={onSubmit}
              className="mb-1 h-10 rounded-full bg-[#07c160] px-4 text-[12px] text-white shadow-none hover:bg-[#06ad56]"
            >
              {submitPending ? t(msg`发送中...`) : t(msg`发送`)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatChannelMeta(
  post: FeedPostListItem,
  t: ReturnType<typeof useRuntimeTranslator>,
) {
  // 注意：不要在这里拼 topicTags——上面已经把 tags 渲染成圆角小标签，
  // 再在 meta 行里追加 "#音乐" 会和最上面的 chip 重复。
  const pieces = [t(msg`${post.viewCount ?? 0} 播放`)];

  if (typeof post.durationMs === "number" && post.durationMs > 0) {
    const seconds = Math.max(1, Math.round(post.durationMs / 1000));
    pieces.push(t(msg`${seconds} 秒`));
  }

  return pieces.join(" · ");
}
