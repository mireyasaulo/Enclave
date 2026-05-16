import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getConversations,
  getFeed,
  getFriends,
  getMoments,
  getOfficialAccountArticles,
  listCharacters,
  listOfficialAccounts,
  searchConversationMessages,
  searchGroupMessages,
} from "@yinjie/contracts";
import { sanitizeDisplayedChatText } from "../../lib/chat-text";
import {
  formatConversationTimestamp,
  formatMessageTimestamp,
  formatTimestamp,
  parseTimestamp,
} from "../../lib/format";
import { getConversationOpenFallback } from "../../lib/conversation-preview";
import {
  getConversationThreadLabel,
  getConversationThreadPath,
  getConversationThreadType,
  isPersistedGroupConversation,
} from "../../lib/conversation-route";
import { useAppRuntimeConfig } from "../../runtime/runtime-config-store";
import {
  shouldHideSearchableChatMessage,
  useLocalChatMessageActionState,
} from "../chat/local-chat-message-actions";
import { buildDesktopContactsRouteHash } from "../contacts/contacts-route-state";
import { getFriendDisplayName } from "../contacts/contact-utils";
import { translateExpertDomain } from "../../lib/character-i18n";
import { buildDesktopChatThreadPath } from "../desktop/chat/desktop-chat-route-state";
import {
  emptySearchScopeCounts,
  type SearchCategory,
  type SearchMessageGroup,
  type SearchOfficialAccountGroup,
  type SearchResultItem,
} from "./search-types";
import { useSearchQuickLinks } from "./search-quick-links";
import {
  buildSearchMatchCounts,
  buildSearchPreview,
  filterSearchResults,
  groupSearchResults,
  sortSearchResults,
  normalizeSearchKeyword,
} from "./search-utils";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

// 远端消息搜索 fan-out 是按 conversation 一个 HTTP（searchConversationMessages /
// searchGroupMessages），74 个会话每多按一个键就是一整轮 N 倍并发。AbortSignal
// 没接通 contracts，老 in-flight 请求即使被 react-query 丢弃也还是会跑完 RTT，
// 公网隧道一旦慢一点连接池立刻被排满。本地数据（会话标题 / 联系人 / 朋友圈 /
// 广场动态 / 收藏）依然用即时的 normalizedSearchText 同步过滤，保留实时反馈；
// 只把远程消息检索 debounce 一下即可。和 desktop-search-launcher 里同名常量
// 一致 280ms。
const REMOTE_SEARCH_DEBOUNCE_MS = 280;

type SearchMessageRow = {
  conversationId: string;
  conversationTitle: string;
  conversationType: "direct" | "group";
  conversationSource?: "conversation" | "group";
  messageId: string;
  senderName: string;
  text: string;
  createdAt: string;
};

function buildDesktopOfficialAccountSearchPath(
  accountId: string,
  articleId?: string,
) {
  const hash = buildDesktopContactsRouteHash({
    pane: "official-accounts",
    accountId,
    articleId,
    officialMode: "accounts",
    showWorldCharacters: false,
  });

  return hash ? `/tabs/contacts#${hash}` : "/tabs/contacts";
}

export function useSearchIndex(
  searchText: string,
  activeCategory: SearchCategory,
  isDesktopLayout: boolean,
) {
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const localMessageActionState = useLocalChatMessageActionState();
  // 上游 search-page 已经对 input 做过 useDeferredValue（移动端实时绑定每键），
  // 这里再 deferred 一次只会让 normalizedSearchText 比 UI 滞后一帧、卡片高亮跟
  // 命中条目错位。直接用 prop 值参与 query / filter 即可。
  const normalizedSearchText = normalizeSearchKeyword(searchText);
  const [debouncedRemoteKeyword, setDebouncedRemoteKeyword] = useState(
    normalizedSearchText,
  );
  useEffect(() => {
    if (!normalizedSearchText) {
      // 清空时立即同步——避免 staleTime 内一直挂着旧 keyword 的远端数据，
      // 也避免"空 keyword 状态"延迟出现。
      setDebouncedRemoteKeyword("");
      return;
    }
    // 桌面 search-page 用 committedSearchText（Enter / 点提交才更新），上游
    // 已经做了"一次输入只 fire 一次"的节流；再 debounce 280ms 就是凭空给用户
    // 加的延迟，按 Enter 后等小半秒才出结果。只有移动端是实时绑定每键，才有
    // N 倍 fan-out 的问题需要 debounce 抹掉。
    if (isDesktopLayout) {
      setDebouncedRemoteKeyword(normalizedSearchText);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedRemoteKeyword(normalizedSearchText);
    }, REMOTE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedSearchText, isDesktopLayout]);
  const {
    favoriteSearchResults,
    miniProgramSearchResults,
    recentFavorites,
    recentMiniPrograms,
  } = useSearchQuickLinks(searchText, isDesktopLayout);

  const conversationsQuery = useQuery({
    queryKey: ["app-conversations", baseUrl],
    queryFn: () => getConversations(baseUrl),
  });
  const friendsQuery = useQuery({
    queryKey: ["app-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
  });
  const charactersQuery = useQuery({
    queryKey: ["app-characters", baseUrl],
    queryFn: () => listCharacters(baseUrl),
  });
  const officialAccountsQuery = useQuery({
    queryKey: ["app-official-accounts", baseUrl],
    queryFn: () => listOfficialAccounts(baseUrl),
  });
  const momentsQuery = useQuery({
    queryKey: ["app-moments", baseUrl],
    queryFn: () => getMoments(baseUrl),
  });
  const feedQuery = useQuery({
    // 原来搜索这边只 getFeed(1, 20)——其它分类索引都拉全量
    // (getMoments / getFriends 等)，唯独广场动态被切到 20，老帖永远
    // 搜不到。这里跟 discover-page 共用同一份 200 条缓存（同 queryKey
    // + 同 queryFn），既补全索引，又不多发一次 HTTP。发帖 / 点赞 /
    // 评论各处的 invalidateQueries 会顺势刷新这份缓存。
    queryKey: ["app-feed", baseUrl],
    queryFn: () => getFeed(1, 200, baseUrl),
  });

  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data],
  );
  const officialAccounts = useMemo(
    () => officialAccountsQuery.data ?? [],
    [officialAccountsQuery.data],
  );
  // 之前把 lastActivityAt 拼进 queryKey：用户正在输入搜索词时，任一会话来一条
  // 新消息 → lastActivityAt 翻新 → conversationsSearchKey 翻新 → 74 个会话的
  // /message-search 全部 invalidate，整个搜索结果列表瞬时被丢弃。新增的那条
  // 消息走完整 chat-list refetch 链路就够了，搜索结果不需要跟着 churn。只用
  // source:id 当稳定的"搜索集合"指纹。
  const conversationsSearchKey = useMemo(
    () =>
      conversations
        .map((item) => `${item.source ?? item.type}:${item.id}`)
        .join("|"),
    [conversations],
  );
  // 公众号文章索引同理：lastPublishedAt 变了不应该把"keyword 命中的旧搜索"
  // 整批 invalidate，只用 account.id 当指纹。
  const officialAccountsSearchKey = useMemo(
    () => officialAccounts.map((item) => item.id).join("|"),
    [officialAccounts],
  );

  const messageSearchIndexQuery = useQuery({
    queryKey: [
      "app-search-message-index",
      baseUrl,
      conversationsSearchKey,
      debouncedRemoteKeyword,
    ],
    enabled: Boolean(debouncedRemoteKeyword) && conversations.length > 0,
    staleTime: 60_000,
    // 没有 placeholderData：每次用户多打一个字 normalizedSearchText 变 →
    // queryKey 变 → useQuery.data 退回 undefined → globalMessageResults 整段
    // 清空 → 界面上"聊天记录"分组瞬时消失再回填，重复输入 / 拼音输入法选字
    // 阶段尤其抖。keepPreviousData 让上一次命中条目保留在屏幕上、用 staleness
    // 暗示用户结果在追赶。
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const settledResults = await Promise.allSettled(
        conversations.map(async (conversation) => {
          const response = isPersistedGroupConversation(conversation)
            ? await searchGroupMessages(
                conversation.id,
                {
                  keyword: debouncedRemoteKeyword,
                  limit: 8,
                },
                baseUrl,
              )
            : await searchConversationMessages(
                conversation.id,
                {
                  keyword: debouncedRemoteKeyword,
                  limit: 8,
                },
                baseUrl,
              );

          return response.items.map((message) => ({
            conversationId: conversation.id,
            conversationTitle: conversation.title,
            conversationType: getConversationThreadType(conversation),
            conversationSource: conversation.source,
            messageId: message.messageId,
            senderName: message.senderName,
            text: message.previewText || t(msg`这条消息没有可展示文本。`),
            createdAt: message.createdAt,
          }));
        }),
      );

      return settledResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ) as SearchMessageRow[];
    },
  });
  const officialAccountArticlesQuery = useQuery({
    queryKey: [
      "app-search-official-account-articles",
      baseUrl,
      officialAccountsSearchKey,
    ],
    enabled: Boolean(normalizedSearchText) && officialAccounts.length > 0,
    staleTime: 60_000,
    // 同 messageSearchIndexQuery：keyword 一变 queryKey 变，没 placeholderData
    // 的话上一批文章命中瞬时消失。
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const settledResults = await Promise.allSettled(
        officialAccounts.map(async (account) => {
          const articles = await getOfficialAccountArticles(
            account.id,
            baseUrl,
          );
          return articles.map((article) => ({ account, article }));
        }),
      );

      return settledResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
    },
  });

  const indexedResults = useMemo<SearchResultItem[]>(() => {
    const friendMap = new Map(
      (friendsQuery.data ?? []).map((item) => [item.character.id, item]),
    );

    const conversationResults: SearchResultItem[] = conversations.map(
      (conversation) => {
        const conversationLabel = getConversationThreadLabel(conversation);
        const lastMessageVisible =
          !conversation.lastMessage ||
          !shouldHideSearchableChatMessage(
            conversation.lastMessage.id,
            localMessageActionState,
          );
        const lastMessageText = lastMessageVisible
          ? sanitizeDisplayedChatText(conversation.lastMessage?.text ?? "")
          : "";

        return {
          id: `conversation-${conversation.id}`,
          category: "messages",
          title: conversation.title,
          description:
            lastMessageText || getConversationOpenFallback(conversation),
          meta: `${conversationLabel} · ${formatConversationTimestamp(conversation.lastActivityAt)}`,
          keywords: [
            conversation.title,
            lastMessageVisible ? conversation.lastMessage?.text : "",
            lastMessageVisible ? conversation.lastMessage?.senderName : "",
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          to: isDesktopLayout
            ? buildDesktopChatThreadPath({
                conversationId: conversation.id,
              })
            : getConversationThreadPath(conversation),
          badge: conversationLabel,
          avatarName: conversation.title,
          sortTime: parseTimestamp(conversation.lastActivityAt) ?? 0,
        };
      },
    );

    const globalMessageResults: SearchResultItem[] = (
      messageSearchIndexQuery.data ?? []
    )
      .filter(
        (message) =>
          !shouldHideSearchableChatMessage(
            message.messageId,
            localMessageActionState,
          ),
      )
      .map((message) => ({
        id: `message-${message.messageId}`,
        category: "messages",
        title: message.conversationTitle,
        description: t(msg`${message.senderName}：${buildSearchPreview(
          message.text || t(msg`这条消息没有可展示文本。`),
          normalizedSearchText,
        )}`),
        meta: t(msg`聊天记录 · ${formatMessageTimestamp(message.createdAt)}`),
        keywords: [message.conversationTitle, message.senderName, message.text]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        to: isDesktopLayout
          ? buildDesktopChatThreadPath({
              conversationId: message.conversationId,
              messageId: message.messageId,
            })
          : getConversationThreadPath({
              id: message.conversationId,
              type: message.conversationType,
              source: message.conversationSource,
            }),
        hash: isDesktopLayout ? undefined : `chat-message-${message.messageId}`,
        badge:
          getConversationThreadType({
            type: message.conversationType,
            source: message.conversationSource,
          }) === "group"
            ? t(msg`群聊记录`)
            : t(msg`单聊记录`),
        avatarName: message.conversationTitle,
        sortTime: parseTimestamp(message.createdAt) ?? 0,
      }));

    const contactResults: SearchResultItem[] = (charactersQuery.data ?? []).map(
      (character) => {
        const friend = friendMap.get(character.id);
        const remarkName = friend?.friendship.remarkName?.trim() ?? "";
        const displayName = friend
          ? getFriendDisplayName(friend)
          : character.name;
        const tagText = friend?.friendship.tags?.join(" ") ?? "";
        // expertDomains 既有英文 token（reasoning / vision / medicine 等）也有
        // 中文条目（中文互联网、阿里云 等）。raw token 用于英文搜索，translated
        // 形式用于中文搜索——只覆盖默认 locale，但能挡掉大部分「设了擅长领域
        // 但搜不到」的尴尬。
        const expertDomainText = character.expertDomains
          ?.map((token) => `${token} ${translateExpertDomain(t, token)}`)
          .join(" ") ?? "";
        // 有备注名时原 description 只显示「昵称：[原名]」——一旦命中的是 bio /
        // currentActivity / 擅长领域等 keywords 字段，用户在卡片上根本看不出
        // 为什么这个联系人出现在结果里。把内容快照拼到昵称后面，让命中原因可
        // 视化。
        const contentSnippet =
          character.bio ||
          character.currentActivity ||
          character.relationship ||
          "";
        const description =
          displayName !== character.name
            ? contentSnippet
              ? t(msg`昵称：${character.name} · ${contentSnippet}`)
              : t(msg`昵称：${character.name}`)
            : contentSnippet || t(msg`查看联系人资料与聊天入口。`);

        return {
          id: `contact-${character.id}`,
          category: "contacts",
          title: displayName,
          description,
          meta: friend
            ? t(msg`通讯录联系人 · ${character.relationship}`)
            : t(msg`世界角色 · ${character.relationship}`),
          keywords: [
            displayName,
            character.name,
            remarkName,
            character.relationship,
            character.bio,
            character.currentActivity,
            character.currentStatus,
            character.personality,
            character.region,
            expertDomainText,
            tagText,
            friend?.friendship.region,
            friend?.friendship.source,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          to: `/character/${character.id}`,
          badge: friend ? t(msg`联系人`) : t(msg`角色`),
          avatarName: displayName,
          avatarSrc: character.avatar,
          sortTime: friend ? 2 : 1,
        };
      },
    );

    const officialAccountResults: SearchResultItem[] = officialAccounts.map(
      (account) => ({
        id: `official-${account.id}`,
        category: "officialAccounts",
        title: account.name,
        description:
          account.recentArticle?.title ||
          account.description ||
          t(msg`查看公众号资料与最近文章。`),
        meta: `${account.accountType === "service" ? t(msg`服务号`) : t(msg`订阅号`)} · @${
          account.handle
        }`,
        keywords: [
          account.name,
          account.handle,
          account.description,
          account.recentArticle?.title,
          account.recentArticle?.summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        to: isDesktopLayout
          ? buildDesktopOfficialAccountSearchPath(account.id)
          : `/official-accounts/${account.id}`,
        badge: account.accountType === "service" ? t(msg`服务号`) : t(msg`订阅号`),
        avatarName: account.name,
        avatarSrc: account.avatar,
        sortTime: parseTimestamp(account.lastPublishedAt) ?? 0,
      }),
    );
    const officialAccountArticleResults: SearchResultItem[] = (
      officialAccountArticlesQuery.data ?? []
    ).map(({ account, article }) => ({
      id: `official-article:${account.id}:${article.id}`,
      category: "officialAccounts",
      title: article.title,
      description: article.summary || t(msg`来自 ${account.name} 的公众号文章`),
      meta: t(msg`公众号文章 · ${account.name} · ${formatTimestamp(article.publishedAt)}`),
      keywords: [
        account.name,
        account.handle,
        article.title,
        article.summary,
        article.authorName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      to: isDesktopLayout
        ? buildDesktopOfficialAccountSearchPath(account.id, article.id)
        : `/official-accounts/articles/${article.id}`,
      badge: t(msg`公众号文章`),
      avatarName: account.name,
      avatarSrc: account.avatar,
      sortTime: parseTimestamp(article.publishedAt) ?? 0,
    }));

    const momentResults: SearchResultItem[] = (momentsQuery.data ?? []).map(
      (moment) => {
        // 无文字的图/视频/音频动态——直接显示空 description 的话搜索卡
        // 内容区是一块空白。退到 location 或按 contentType / media 数量
        // 给个含义提示。仅影响显示，keywords 不变。
        const descriptionFallback = moment.location?.trim()
          ? t(msg`📍 ${moment.location.trim()}`)
          : moment.contentType === "video"
            ? t(msg`[视频动态]`)
            : moment.contentType === "audio_card"
              ? t(msg`[音乐动态]`)
              : moment.contentType === "live_photo"
                ? t(msg`[实况照片]`)
                : moment.media.length
                  ? t(msg`[${moment.media.length} 张图片]`)
                  : t(msg`查看这条朋友圈动态。`);
        return ({
        id: `moment-${moment.id}`,
        category: "moments",
        title: moment.authorName,
        description: moment.text.trim() || descriptionFallback,
        meta: t(msg`朋友圈 · ${formatTimestamp(moment.postedAt)}`),
        keywords: [
          moment.authorName,
          moment.text,
          moment.location,
          // 点赞者名字也算「这条朋友圈跟某个 AI 有关」的依据：用户搜某
          // 个 AI 的名字想找它的互动痕迹，如果它只点了赞没评论，原来
          // 整条 moment 都搜不到。
          ...moment.likes.map((item) => item.authorName),
          ...moment.comments.map((item) => `${item.authorName} ${item.text}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        to: isDesktopLayout ? "/tabs/moments" : "/discover/moments",
        hash: buildSearchMomentHash(moment.id),
        badge: t(msg`朋友圈`),
        avatarName: moment.authorName,
        avatarSrc: moment.authorAvatar,
        sortTime: parseTimestamp(moment.postedAt) ?? 0,
      });
      },
    );

    const feedResults: SearchResultItem[] = (feedQuery.data?.posts ?? []).map(
      (post) => {
        const postTitle = post.title?.trim();
        const postText = post.text.trim();
        // 同朋友圈：纯媒体动态 text 为空，搜出来卡片内容区一片空白。
        // 优先用 post.title（文章风格 feed 帖子的标题），再退到媒体类型
        // 提示。仅影响显示，keywords 自己覆盖完整。
        const descriptionFallback = postTitle
          ? postTitle
          : post.mediaType === "video"
            ? t(msg`[视频动态]`)
            : post.mediaType === "audio"
              ? t(msg`[音乐动态]`)
              : post.media.length
                ? t(msg`[${post.media.length} 张图片]`)
                : t(msg`查看这条广场动态。`);
        return ({
          id: `feed-${post.id}`,
          category: "feed",
          title: post.authorName,
          description: postText || descriptionFallback,
          meta: t(msg`广场动态 · ${formatTimestamp(post.createdAt)}`),
          keywords: [
            post.authorName,
            postTitle,
            post.text,
            // 话题标签——按 # 标签搜要能命中
            post.topicTags?.join(" "),
            ...post.commentsPreview.map(
              (item) => `${item.authorName} ${item.text}`,
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          to: isDesktopLayout ? "/tabs/feed" : "/discover/feed",
          hash: buildSearchFeedHash(post.id),
          badge: t(msg`广场动态`),
          avatarName: post.authorName,
          avatarSrc: post.authorAvatar,
          sortTime: parseTimestamp(post.createdAt) ?? 0,
        });
      },
    );

    return [
      ...conversationResults,
      ...globalMessageResults,
      ...contactResults,
      ...favoriteSearchResults,
      ...officialAccountResults,
      ...officialAccountArticleResults,
      ...miniProgramSearchResults,
      ...momentResults,
      ...feedResults,
    ];
  }, [
    charactersQuery.data,
    conversations,
    feedQuery.data?.posts,
    friendsQuery.data,
    favoriteSearchResults,
    localMessageActionState,
    messageSearchIndexQuery.data,
    miniProgramSearchResults,
    momentsQuery.data,
    normalizedSearchText,
    officialAccountArticlesQuery.data,
    officialAccounts,
    isDesktopLayout,
  ]);

  const messageGroups = useMemo<SearchMessageGroup[]>(() => {
    if (!normalizedSearchText) {
      return [] as SearchMessageGroup[];
    }

    const conversationResults = indexedResults.filter(
      (item) =>
        item.category === "messages" && item.id.startsWith("conversation-"),
    );
    const conversationResultById = new Map(
      conversationResults.map((item) => [
        item.id.replace(/^conversation-/, ""),
        item,
      ]),
    );
    const messageResults = filterSearchResults(
      indexedResults.filter(
        (item) =>
          item.category === "messages" && item.id.startsWith("message-"),
      ),
      normalizedSearchText,
      "messages",
    );
    const groupedMessages = new Map<string, SearchResultItem[]>();

    for (const item of messageResults) {
      const conversationId = resolveMessageConversationId(item.to);
      if (!conversationId) {
        continue;
      }

      const current = groupedMessages.get(conversationId);
      if (current) {
        current.push(item);
        continue;
      }

      groupedMessages.set(conversationId, [item]);
    }

    return Array.from(groupedMessages.entries())
      .map(([conversationId, messages]) => {
        const header = conversationResultById.get(conversationId);
        if (!header) {
          return null;
        }

        // 后端 searchConversationMessages / searchGroupMessages 单次返回上限 8
        // 条 / 会话（见上面 messageSearchIndexQuery 里的 limit: 8）。这里别再
        // slice(0, 3)——drilldown 视图（查看全部聊天记录）依赖完整命中条数，
        // 不然「查看全部」点进去每个会话仍然只显示 3 条，跟"全部"的语义对不
        // 上。preview 视图（全部结果聚合页）由 desktop-search-workspace 自己
        // 再切一次。
        const sortedMessages = [...messages].sort(
          (left, right) => right.sortTime - left.sortTime,
        );
        return {
          id: `message-group-${conversationId}`,
          header,
          totalHits: sortedMessages.length,
          messages: sortedMessages,
          sortTime: Math.max(
            header.sortTime,
            sortedMessages[0]?.sortTime ?? header.sortTime,
          ),
        };
      })
      .filter((item): item is SearchMessageGroup => Boolean(item))
      .sort((left, right) => {
        if (left.sortTime !== right.sortTime) {
          return right.sortTime - left.sortTime;
        }

        return sortSearchResults(
          left.header,
          right.header,
          normalizedSearchText,
        );
      });
  }, [indexedResults, normalizedSearchText]);

  const officialAccountGroups = useMemo<SearchOfficialAccountGroup[]>(() => {
    if (!normalizedSearchText) {
      return [] as SearchOfficialAccountGroup[];
    }

    const officialAccountResults = indexedResults.filter(
      (item) =>
        item.category === "officialAccounts" &&
        item.id.startsWith("official-") &&
        !item.id.startsWith("official-article:"),
    );
    const officialAccountResultById = new Map(
      officialAccountResults.map((item) => [
        item.id.replace(/^official-/, ""),
        item,
      ]),
    );
    const articleResults = filterSearchResults(
      indexedResults.filter(
        (item) =>
          item.category === "officialAccounts" &&
          item.id.startsWith("official-article:"),
      ),
      normalizedSearchText,
      "officialAccounts",
    );
    const groupedArticles = new Map<string, SearchResultItem[]>();

    for (const item of articleResults) {
      const accountId = resolveOfficialAccountId(item.id);
      if (!accountId) {
        continue;
      }

      const current = groupedArticles.get(accountId);
      if (current) {
        current.push(item);
        continue;
      }

      groupedArticles.set(accountId, [item]);
    }

    return Array.from(groupedArticles.entries())
      .map(([accountId, articles]) => {
        const header = officialAccountResultById.get(accountId);
        if (!header) {
          return null;
        }

        return {
          id: `official-account-group-${accountId}`,
          header,
          totalHits: articles.length,
          articles: [...articles]
            .sort((left, right) => right.sortTime - left.sortTime)
            .slice(0, 3),
          sortTime: Math.max(
            header.sortTime,
            articles[0]?.sortTime ?? header.sortTime,
          ),
        };
      })
      .filter((item): item is SearchOfficialAccountGroup => Boolean(item))
      .sort((left, right) => {
        if (left.sortTime !== right.sortTime) {
          return right.sortTime - left.sortTime;
        }

        return sortSearchResults(
          left.header,
          right.header,
          normalizedSearchText,
        );
      });
  }, [indexedResults, normalizedSearchText]);

  const allMatchedResults = useMemo(
    () => filterSearchResults(indexedResults, normalizedSearchText, "all"),
    [indexedResults, normalizedSearchText],
  );

  const filteredResults = useMemo(
    () =>
      activeCategory === "all"
        ? allMatchedResults
        : filterSearchResults(indexedResults, normalizedSearchText, activeCategory),
    [activeCategory, allMatchedResults, indexedResults, normalizedSearchText],
  );

  const groupedResults = useMemo(
    () => groupSearchResults(allMatchedResults),
    [allMatchedResults],
  );

  const matchedCounts = useMemo(
    () => buildSearchMatchCounts(allMatchedResults),
    [allMatchedResults],
  );

  const scopeCounts = useMemo(
    () => ({
      conversations: conversations.length,
      contacts: (charactersQuery.data ?? []).length,
      favorites: favoriteSearchResults.length,
      officialAccounts: (officialAccountsQuery.data ?? []).length,
      miniPrograms: miniProgramSearchResults.length,
      moments: (momentsQuery.data ?? []).length,
      feed: (feedQuery.data?.posts ?? []).length,
    }),
    [
      charactersQuery.data,
      conversations.length,
      feedQuery.data?.posts,
      favoriteSearchResults.length,
      miniProgramSearchResults.length,
      momentsQuery.data,
      officialAccountsQuery.data,
    ],
  );

  const loading =
    conversationsQuery.isLoading ||
    friendsQuery.isLoading ||
    charactersQuery.isLoading ||
    officialAccountsQuery.isLoading ||
    momentsQuery.isLoading ||
    feedQuery.isLoading;

  const error =
    extractErrorMessage(conversationsQuery.error) ||
    extractErrorMessage(friendsQuery.error) ||
    extractErrorMessage(charactersQuery.error) ||
    extractErrorMessage(officialAccountsQuery.error) ||
    extractErrorMessage(officialAccountArticlesQuery.error) ||
    extractErrorMessage(momentsQuery.error) ||
    extractErrorMessage(feedQuery.error) ||
    extractErrorMessage(messageSearchIndexQuery.error);

  function retryLoad() {
    void conversationsQuery.refetch();
    void friendsQuery.refetch();
    void charactersQuery.refetch();
    void officialAccountsQuery.refetch();
    void momentsQuery.refetch();
    void feedQuery.refetch();

    if (normalizedSearchText) {
      void officialAccountArticlesQuery.refetch();
      void messageSearchIndexQuery.refetch();
    }
  }

  return {
    error,
    filteredResults,
    groupedResults,
    hasKeyword: Boolean(normalizedSearchText),
    loading,
    matchedCounts,
    messageGroups,
    officialAccountGroups,
    normalizedSearchText,
    recentFavorites,
    recentMiniPrograms,
    retryLoad,
    // 加了 placeholderData 之后 isLoading 在拿到首次数据后就一直是 false（react
    // -query v5：data 存在即非 isPending）；只有 isFetching 才忠实反映"当前
    // keyword 是否还在背景里重跑"。banner「正在补全全局聊天记录索引」依赖这条
    // 才能在每一次 keyword 变更期间正确出现。
    //
    // 又加上 normalizedSearchText !== debouncedRemoteKeyword 是为了 cover debounce
    // 等待期：用户刚打完字 0~280ms 内 query 还没被 enable，isFetching=false，但
    // 显然"远端结果还没追上来"——这段时间也要让 banner 在线，否则用户瞄一眼以
    // 为搜完了，结果再过 200ms 又跳出来一批，体验上像"结果在跳"。
    searchingMessages:
      Boolean(normalizedSearchText) &&
      (normalizedSearchText !== debouncedRemoteKeyword ||
        messageSearchIndexQuery.isFetching),
    scopeCounts: loading ? emptySearchScopeCounts : scopeCounts,
  };
}

function buildSearchMomentHash(momentId: string) {
  const params = new URLSearchParams();
  params.set("moment", momentId);
  return params.toString();
}

function buildSearchFeedHash(postId: string) {
  const params = new URLSearchParams();
  params.set("post", postId);
  return params.toString();
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

function resolveMessageConversationId(to: string) {
  // 移动端：/chat/<id> 或 /group/<id>
  const pathMatch = to.match(/\/(?:chat|group)\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  // 桌面端：buildDesktopChatThreadPath 产出 /tabs/chat#conversationId=<id>&messageId=<...>
  // 之前只匹配 path 段，桌面布局下 messageGroups 永远为空 → 消息命中无法分组到会话卡。
  const hashIndex = to.indexOf("#");
  if (hashIndex !== -1) {
    const hashPart = to.slice(hashIndex + 1);
    const params = new URLSearchParams(hashPart);
    const conversationId = params.get("conversationId")?.trim();
    if (conversationId) {
      return conversationId;
    }
  }

  return null;
}

function resolveOfficialAccountId(resultId: string) {
  const match = resultId.match(/^official-article:([^:]+):/);
  return match?.[1] ?? null;
}
