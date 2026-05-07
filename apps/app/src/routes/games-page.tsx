import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  getConversations,
  sendGroupMessage,
  type ConversationListItem,
} from "@yinjie/contracts";
import { AppPage, Button, InlineNotice, cn } from "@yinjie/ui";
import { ArrowLeft, ChevronRight, Copy, Play, Share2 } from "lucide-react";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { RouteRedirectState } from "../components/route-redirect-state";
import {
  gameCenterEvents,
  gameCenterFeaturedGameIds,
  gameCenterFriendActivities,
  gameCenterGames,
  gameCenterHotRankings,
  gameCenterNewRankings,
  getGameCenterGame,
  getGameCenterEventStatusLabel,
  getGameCenterToneStyle,
  type GameCenterCategoryId,
  type GameCenterGame,
} from "../features/games/game-center-data";
import { ParkingWarGame } from "../features/games/parking-war/parking-war-game";
import { useGameCenterState } from "../features/games/use-game-center-state";
import { emitChatMessage, joinConversationRoom } from "../lib/socket";
import { isPersistedGroupConversation } from "../lib/conversation-route";
import {
  pushMobileHandoffRecord,
  resolveMobileHandoffLink,
} from "../features/shell/mobile-handoff-storage";
import { buildGameInvitePath } from "../features/games/game-invite-route";
import { AvatarChip } from "../components/avatar-chip";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { parseTimestamp } from "../lib/format";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { normalizePathname } from "../lib/normalize-pathname";
import { searchStringToObject } from "../lib/route-search";
import { shareWithNativeShell } from "../runtime/mobile-bridge";
import {
  isMobileWebShareSurface,
  isNativeMobileShareSurface,
} from "../runtime/mobile-share-surface";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";
import {
  buildMobileGamesRouteSearch,
  parseMobileGamesRouteSearch,
} from "../features/games/mobile-games-route-state";

const DesktopGamesWorkspace = lazy(async () => {
  const mod = await import("../features/desktop/games/desktop-games-workspace");
  return { default: mod.DesktopGamesWorkspace };
});

function resolveGames(ids: string[]) {
  return ids
    .map((id) => getGameCenterGame(id))
    .filter((game): game is GameCenterGame => Boolean(game));
}

function resolveDefaultGameSelection() {
  return gameCenterFeaturedGameIds[0] ?? "signal-squad";
}

export function GamesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDesktopLayout = useDesktopLayout();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const nativeMobileShareSupported = isNativeMobileShareSurface({
    isDesktopLayout,
  });
  const mobileWebCopyFallback = isMobileWebShareSurface({
    isDesktopLayout,
  });
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const ownerId = useWorldOwnerStore((state) => state.id);
  const locationSearch = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const routeState = useMemo(
    () => parseMobileGamesRouteSearch(locationSearch),
    [locationSearch],
  );
  const {
    activeGameId,
    eventActionStatusById,
    lastInviteConversationPathByActivityId,
    lastInviteConversationTitleByActivityId,
    friendInviteSentAtByActivityId,
    friendInviteStatusByActivityId,
    launchCountById,
    lastOpenedAtById,
    pinnedGameIds,
    recentGameIds,
    dismissActiveGame,
    applyEventAction,
    applyFriendInvite,
    markInviteDelivered,
    launchGame,
    togglePinned,
  } = useGameCenterState();
  const [activeCategory, setActiveCategory] =
    useState<GameCenterCategoryId>("featured");
  const selectedGameFromSearch = routeState.gameId ?? null;
  const inviteActivityFromSearch = useMemo(
    () =>
      routeState.inviteId
        ? gameCenterFriendActivities.find(
            (item) => item.id === routeState.inviteId,
          ) ?? null
        : null,
    [routeState.inviteId],
  );
  const [selectedGameId, setSelectedGameId] = useState(
    selectedGameFromSearch ?? resolveDefaultGameSelection(),
  );
  const [activeInviteActivityId, setActiveInviteActivityId] = useState<
    string | null
  >(inviteActivityFromSearch?.id ?? null);
  const [successNotice, setSuccessNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "info">("success");
  const [noticeActionState, setNoticeActionState] = useState<{
    label: string;
    message: string;
    onAction: () => void;
  } | null>(null);
  const normalizedPathname = normalizePathname(pathname);
  const isDesktopGamesRoute =
    normalizedPathname === "/tabs/games" ||
    normalizedPathname === "/games" ||
    normalizedPathname === "/discover/games";
  const normalizedDesktopReturnPath =
    isDesktopLayout &&
    (routeState.returnPath === "/games" ||
      routeState.returnPath === "/discover/games")
      ? "/tabs/games"
      : routeState.returnPath;
  const safeReturnPath =
    normalizedDesktopReturnPath &&
    !isDesktopOnlyPath(normalizedDesktopReturnPath)
      ? normalizedDesktopReturnPath
      : undefined;
  const safeReturnHash = safeReturnPath ? routeState.returnHash : undefined;
  const activeInviteActivity = useMemo(
    () =>
      activeInviteActivityId
        ? (gameCenterFriendActivities.find(
            (item) => item.id === activeInviteActivityId,
          ) ?? null)
        : null,
    [activeInviteActivityId],
  );

  const conversationsQuery = useQuery({
    queryKey: ["app-conversations", baseUrl],
    queryFn: () => getConversations(baseUrl),
    enabled: Boolean(ownerId),
  });

  useEffect(() => {
    if (!getGameCenterGame(selectedGameId)) {
      setSelectedGameId(gameCenterFeaturedGameIds[0] ?? "signal-squad");
    }
  }, [selectedGameId]);

  useEffect(() => {
    if (!successNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessNotice("");
      setNoticeActionState(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  useEffect(() => {
    const nextSelectedGameId =
      selectedGameFromSearch ?? resolveDefaultGameSelection();

    setSelectedGameId((current) =>
      current === nextSelectedGameId ? current : nextSelectedGameId,
    );
  }, [selectedGameFromSearch]);

  useEffect(() => {
    const nextInviteActivityId = inviteActivityFromSearch?.id ?? null;
    setActiveInviteActivityId((current) =>
      current === nextInviteActivityId ? current : nextInviteActivityId,
    );
  }, [inviteActivityFromSearch?.id]);

  useEffect(() => {
    if (!activeInviteActivityId) {
      return;
    }

    const activity = gameCenterFriendActivities.find(
      (item) => item.id === activeInviteActivityId,
    );
    if (activity && activity.gameId === selectedGameId) {
      return;
    }

    setActiveInviteActivityId(null);
  }, [activeInviteActivityId, selectedGameId]);

  useEffect(() => {
    if (inviteActivityFromSearch) {
      setNoticeTone("info");
      setSuccessNotice(
        `已带上 ${inviteActivityFromSearch.friendName} 的组局邀约，可继续查看 ${getGameCenterGame(inviteActivityFromSearch.gameId)?.name ?? "当前游戏"}。`,
      );
    }
  }, [inviteActivityFromSearch]);

  useEffect(() => {
    if (!isDesktopLayout || !isDesktopGamesRoute || !selectedGameId) {
      return;
    }

    const nextSearch = buildMobileGamesRouteSearch({
      gameId: selectedGameId,
      inviteId:
        activeInviteActivity?.gameId === selectedGameId
          ? activeInviteActivity?.id
          : undefined,
      returnPath: safeReturnPath,
      returnHash: safeReturnHash,
    });

    if (
      pathname === "/tabs/games" &&
      (locationSearch || "") === (nextSearch || "")
    ) {
      return;
    }

    void navigate({
      to: "/tabs/games",
      search: searchStringToObject(nextSearch),
      replace: true,
    });
  }, [
    activeInviteActivity?.gameId,
    activeInviteActivity?.id,
    isDesktopGamesRoute,
    isDesktopLayout,
    locationSearch,
    navigate,
    pathname,
    safeReturnHash,
    safeReturnPath,
    selectedGameId,
  ]);

  useEffect(() => {
    if (
      isDesktopLayout ||
      normalizedPathname !== "/discover/games" ||
      !selectedGameId
    ) {
      return;
    }

    const nextSearch = buildMobileGamesRouteSearch({
      gameId: selectedGameId,
      inviteId:
        activeInviteActivity?.gameId === selectedGameId
          ? activeInviteActivity?.id
          : undefined,
      returnPath: safeReturnPath,
      returnHash: safeReturnHash,
    });

    if ((locationSearch || "") === (nextSearch || "")) {
      return;
    }

    void navigate({
      to: pathname,
      search: searchStringToObject(nextSearch),
      replace: true,
    });
  }, [
    activeInviteActivity?.gameId,
    activeInviteActivity?.id,
    isDesktopLayout,
    locationSearch,
    navigate,
    pathname,
    normalizedPathname,
    safeReturnHash,
    safeReturnPath,
    selectedGameId,
  ]);

  const featuredGames = resolveGames(gameCenterFeaturedGameIds);
  const selectedGame =
    getGameCenterGame(selectedGameId) ?? featuredGames[0] ?? gameCenterGames[0];
  const recentGames = resolveGames(recentGameIds);
  const myGames =
    recentGames.length > 0 ? recentGames : featuredGames.slice(0, 6);
  const bannerGame = featuredGames[0] ?? selectedGame;
  const featuredRest = featuredGames.slice(1);
  const inviteConversationCandidates = useMemo(
    () =>
      [...(conversationsQuery.data ?? [])]
        .sort(
          (left, right) =>
            (parseTimestamp(right.lastActivityAt) ?? 0) -
            (parseTimestamp(left.lastActivityAt) ?? 0),
        )
        .slice(0, 5),
    [conversationsQuery.data],
  );

  const sendGroupInviteMutation = useMutation({
    mutationFn: (input: { conversationId: string; text: string }) =>
      sendGroupMessage(
        input.conversationId,
        {
          text: input.text,
        },
        baseUrl,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["app-conversations", baseUrl],
      });
    },
  });

  function handleLaunchGame(gameId: string) {
    const game = getGameCenterGame(gameId);
    launchGame(gameId);
    setSelectedGameId(gameId);
    if (gameId === "yinjie-farm") {
      void navigate({ to: "/tabs/games/yinjie-farm" });
      return;
    }
    setNoticeTone("success");
    setSuccessNotice(
      `${game?.name ?? "该游戏"} 已加入最近玩过。首期先以游戏中心内容工作区承接，后续再接小游戏容器。`,
    );
  }

  function handleTogglePinnedGame(gameId: string) {
    const game = getGameCenterGame(gameId);
    const pinned = pinnedGameIds.includes(gameId);
    togglePinned(gameId);
    setNoticeTone("success");
    setSuccessNotice(
      `${game?.name ?? "该游戏"} 已${pinned ? "取消固定常玩" : "固定到常玩"}。`,
    );
  }

  function handleCompleteEventAction(eventId: string) {
    const event = gameCenterEvents.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    const nextStatus =
      event.actionKind === "reminder"
        ? "reminder_set"
        : event.actionKind === "join"
          ? "joined"
          : "task_started";

    applyEventAction(eventId, nextStatus);
    setSelectedGameId(event.relatedGameId);
    setNoticeTone("success");
    setSuccessNotice(
      `${event.title} 已标记为${getGameCenterEventStatusLabel(event)}。`,
    );
  }

  function handleInviteFriend(activityId: string) {
    const activity = gameCenterFriendActivities.find(
      (item) => item.id === activityId,
    );
    if (!activity) {
      return;
    }

    const game = getGameCenterGame(activity.gameId);
    const alreadyInvited = Boolean(friendInviteStatusByActivityId[activityId]);
    applyFriendInvite(activityId, "invited");
    setSelectedGameId(activity.gameId);
    setNoticeTone("success");
    setSuccessNotice(
      alreadyInvited
        ? `已再次邀请 ${activity.friendName} 一起玩${game?.name ?? "当前游戏"}。`
        : `已向 ${activity.friendName} 发出一起玩${game?.name ?? "当前游戏"} 的邀约。`,
    );
  }

  function handleOpenInviteToChat(activityId: string) {
    const activity = gameCenterFriendActivities.find(
      (item) => item.id === activityId,
    );
    if (!activity) {
      return;
    }

    setSelectedGameId(activity.gameId);
    setActiveInviteActivityId((current) =>
      current === activityId ? null : activityId,
    );
  }

  function buildInviteMessage(
    activity: (typeof gameCenterFriendActivities)[number],
    game: GameCenterGame | null,
  ) {
    return [
      "【组局邀约】",
      `${activity.friendName} 正在玩《${game?.name ?? "当前游戏"}》`,
      activity.status,
      "要不要一起上？",
    ].join(" ");
  }

  function resolveConversationPath(conversation: ConversationListItem) {
    return isPersistedGroupConversation(conversation)
      ? `/group/${conversation.id}`
      : `/chat/${conversation.id}`;
  }

  async function handleSendInviteToConversation(
    activityId: string,
    conversationId: string,
  ) {
    const activity = gameCenterFriendActivities.find(
      (item) => item.id === activityId,
    );
    const conversation = inviteConversationCandidates.find(
      (item) => item.id === conversationId,
    );

    if (!activity || !conversation) {
      return;
    }

    const game = getGameCenterGame(activity.gameId);
    const text = buildInviteMessage(activity, game);
    const conversationPath = buildGameInvitePath(
      resolveConversationPath(conversation),
      {
        gameId: activity.gameId,
        inviteId: activity.id,
        returnPath: safeReturnPath,
        returnHash: safeReturnHash,
      },
    );

    if (isPersistedGroupConversation(conversation)) {
      await sendGroupInviteMutation.mutateAsync({
        conversationId: conversation.id,
        text,
      });
    } else {
      const characterId = conversation.participants[0];
      if (!characterId) {
        setNoticeTone("info");
        setSuccessNotice("这条单聊还没有可用的角色目标，暂时无法投递邀约。");
        return;
      }

      joinConversationRoom({ conversationId: conversation.id });
      emitChatMessage({
        conversationId: conversation.id,
        characterId,
        text,
      });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["app-conversations", baseUrl],
        });
      }, 500);
    }

    markInviteDelivered(
      activityId,
      conversation.id,
      conversationPath,
      conversation.title,
    );
    setSelectedGameId(activity.gameId);
    setActiveInviteActivityId(null);
    setNoticeTone("success");
    setSuccessNotice(
      `已把 ${activity.friendName} 的组局邀约发到 ${conversation.title}。`,
    );
  }

  function handleOpenDeliveredConversation(activityId: string) {
    const path = lastInviteConversationPathByActivityId[activityId];
    const title = lastInviteConversationTitleByActivityId[activityId];
    if (!path) {
      setNoticeTone("info");
      setSuccessNotice("这条组局邀约还没有可回跳的会话。");
      return;
    }

    void navigate({ to: path });
    setNoticeTone("success");
    setSuccessNotice(
      title ? `正在回到 ${title}。` : "正在回到最近投递的会话。",
    );
  }

  async function handleCopyInviteToMobile(activityId: string) {
    const activity = gameCenterFriendActivities.find(
      (item) => item.id === activityId,
    );
    if (!activity) {
      return;
    }

    const game = getGameCenterGame(activity.gameId);
    const path = `/discover/games?game=${activity.gameId}&invite=${activity.id}`;
    const link = resolveMobileHandoffLink(path);

    if (nativeMobileShareSupported) {
      const shared = await shareWithNativeShell({
        title: `${activity.friendName} 的组局邀约`,
        text: `${activity.friendName} 正在玩 ${game?.name ?? "当前游戏"}，邀请你一起玩。\n${link}`,
        url: link,
      });

      if (shared) {
        setNoticeTone("success");
        setNoticeActionState(null);
        setSuccessNotice("已打开系统分享面板。");
        return;
      }

      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        setNoticeTone("info");
        setNoticeActionState({
          label: "重试分享",
          message: "当前设备暂时无法打开系统分享，请稍后重试。",
          onAction: () => {
            void handleCopyInviteToMobile(activityId);
          },
        });
        setSuccessNotice("当前设备暂时无法打开系统分享，请稍后重试。");
        return;
      }

      try {
        await navigator.clipboard.writeText(link);
        applyFriendInvite(activityId, "invited");
        setSelectedGameId(activity.gameId);
        setNoticeTone("success");
        setNoticeActionState(null);
        setSuccessNotice("系统分享暂时不可用，已复制组局链接。");
      } catch {
        setNoticeActionState({
          label: "重试分享",
          message: "系统分享失败，请稍后重试。",
          onAction: () => {
            void handleCopyInviteToMobile(activityId);
          },
        });
        setNoticeTone("info");
        setSuccessNotice("系统分享失败，请稍后重试。");
      }
      return;
    }

    if (mobileWebCopyFallback) {
      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        setNoticeTone("info");
        setNoticeActionState({
          label: "重试复制",
          message: "当前环境暂不支持复制组局链接。",
          onAction: () => {
            void handleCopyInviteToMobile(activityId);
          },
        });
        setSuccessNotice("当前环境暂不支持复制组局链接。");
        return;
      }

      try {
        await navigator.clipboard.writeText(link);
        applyFriendInvite(activityId, "invited");
        setSelectedGameId(activity.gameId);
        setNoticeTone("success");
        setNoticeActionState(null);
        setSuccessNotice("组局链接已复制。");
      } catch {
        setNoticeActionState({
          label: "重试复制",
          message: "复制组局链接失败，请稍后重试。",
          onAction: () => {
            void handleCopyInviteToMobile(activityId);
          },
        });
        setNoticeTone("info");
        setSuccessNotice("复制组局链接失败，请稍后重试。");
      }
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setNoticeTone("info");
      setNoticeActionState({
        label: "重试复制到手机",
        message: "当前环境暂不支持复制到手机。",
        onAction: () => {
          void handleCopyInviteToMobile(activityId);
        },
      });
      setSuccessNotice("当前环境暂不支持复制到手机。");
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      applyFriendInvite(activityId, "invited");
      setSelectedGameId(activity.gameId);
      pushMobileHandoffRecord({
        category: "games",
        description: `${activity.friendName} 正在玩 ${game?.name ?? "当前游戏"}，把这条组局邀约发到手机继续跟进。`,
        label: `${activity.friendName} 组局邀约`,
        path,
      });
      setNoticeTone("success");
      setNoticeActionState(null);
      setSuccessNotice(`已把 ${activity.friendName} 的组局邀约复制到手机。`);
    } catch {
      setNoticeActionState({
        label: "重试复制到手机",
        message: "复制到手机失败，请稍后重试。",
        onAction: () => {
          void handleCopyInviteToMobile(activityId);
        },
      });
      setNoticeTone("info");
      setSuccessNotice("复制到手机失败，请稍后重试。");
    }
  }

  async function handleCopyGameToMobile(gameId: string) {
    const game = getGameCenterGame(gameId);
    const path = buildGameInvitePath("/discover/games", { gameId });
    const link = resolveMobileHandoffLink(path);

    if (nativeMobileShareSupported) {
      const shared = await shareWithNativeShell({
        title: `${game?.name ?? "游戏中心"} 入口`,
        text: `${game?.name ?? "游戏中心"}\n${link}`,
        url: link,
      });

      if (shared) {
        setNoticeTone("success");
        setNoticeActionState(null);
        setSuccessNotice("已打开系统分享面板。");
        return;
      }

      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        setNoticeTone("info");
        setNoticeActionState({
          label: "重试分享",
          message: "当前设备暂时无法打开系统分享，请稍后重试。",
          onAction: () => {
            void handleCopyGameToMobile(gameId);
          },
        });
        setSuccessNotice("当前设备暂时无法打开系统分享，请稍后重试。");
        return;
      }

      try {
        await navigator.clipboard.writeText(link);
        setNoticeTone("success");
        setNoticeActionState(null);
        setSuccessNotice("系统分享暂时不可用，已复制入口链接。");
      } catch {
        setNoticeActionState({
          label: "重试分享",
          message: "系统分享失败，请稍后重试。",
          onAction: () => {
            void handleCopyGameToMobile(gameId);
          },
        });
        setNoticeTone("info");
        setSuccessNotice("系统分享失败，请稍后重试。");
      }
      return;
    }

    if (mobileWebCopyFallback) {
      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        setNoticeTone("info");
        setNoticeActionState({
          label: "重试复制",
          message: "当前环境暂不支持复制入口链接。",
          onAction: () => {
            void handleCopyGameToMobile(gameId);
          },
        });
        setSuccessNotice("当前环境暂不支持复制入口链接。");
        return;
      }

      try {
        await navigator.clipboard.writeText(link);
        setNoticeTone("success");
        setNoticeActionState(null);
        setSuccessNotice("入口链接已复制。");
      } catch {
        setNoticeActionState({
          label: "重试复制",
          message: "复制入口链接失败，请稍后重试。",
          onAction: () => {
            void handleCopyGameToMobile(gameId);
          },
        });
        setNoticeTone("info");
        setSuccessNotice("复制入口链接失败，请稍后重试。");
      }
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setNoticeTone("info");
      setNoticeActionState({
        label: "重试复制到手机",
        message: "当前环境暂不支持复制到手机。",
        onAction: () => {
          void handleCopyGameToMobile(gameId);
        },
      });
      setSuccessNotice("当前环境暂不支持复制到手机。");
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      pushMobileHandoffRecord({
        category: "games",
        description: `把 ${game?.name ?? "游戏中心"} 的入口发到手机继续，保留最近玩过和活动状态。`,
        label: `${game?.name ?? "游戏中心"} 接力`,
        path,
      });
      setNoticeTone("success");
      setNoticeActionState(null);
      setSuccessNotice(`${game?.name ?? "该游戏"} 已复制到手机接力链接。`);
    } catch {
      setNoticeActionState({
        label: "重试复制到手机",
        message: "复制到手机失败，请稍后重试。",
        onAction: () => {
          void handleCopyGameToMobile(gameId);
        },
      });
      setNoticeTone("info");
      setSuccessNotice("复制到手机失败，请稍后重试。");
    }
  }

  function handleBack() {
    navigateBackOrFallback(() => {
      if (safeReturnPath) {
        void navigate({
          to: safeReturnPath,
          ...(safeReturnHash ? { hash: safeReturnHash } : {}),
        });
        return;
      }

      void navigate({ to: "/tabs/discover" });
    });
  }

  if (isDesktopLayout) {
    return (
      <Suspense
        fallback={
          <RouteRedirectState
            title="正在打开桌面游戏"
            description="正在载入桌面游戏工作区，马上显示当前游戏中心内容。"
            loadingLabel="载入桌面游戏中心..."
          />
        }
      >
        <DesktopGamesWorkspace
          activeCategory={activeCategory}
          activeGameId={activeGameId}
          activeInviteActivityId={activeInviteActivityId}
          eventActionStatusById={eventActionStatusById}
          friendInviteSentAtByActivityId={friendInviteSentAtByActivityId}
          friendInviteStatusByActivityId={friendInviteStatusByActivityId}
          lastInviteConversationPathByActivityId={
            lastInviteConversationPathByActivityId
          }
          lastInviteConversationTitleByActivityId={
            lastInviteConversationTitleByActivityId
          }
          inviteConversationCandidates={inviteConversationCandidates}
          inviteConversationCandidatesLoading={conversationsQuery.isLoading}
          launchCountById={launchCountById}
          pinnedGameIds={pinnedGameIds}
          recentGameIds={recentGameIds}
          selectedGameId={selectedGameId}
          lastOpenedAtById={lastOpenedAtById}
          successNotice={successNotice}
          noticeTone={noticeTone}
          onCategoryChange={setActiveCategory}
          onCompleteEventAction={handleCompleteEventAction}
          onCopyInviteToMobile={handleCopyInviteToMobile}
          onOpenInviteToChat={handleOpenInviteToChat}
          onOpenDeliveredConversation={handleOpenDeliveredConversation}
          onSendInviteToConversation={handleSendInviteToConversation}
          onInviteFriend={handleInviteFriend}
          onCopyGameToMobile={handleCopyGameToMobile}
          onDismissActiveGame={dismissActiveGame}
          onLaunchGame={handleLaunchGame}
          onSelectGame={setSelectedGameId}
          onTogglePinnedGame={handleTogglePinnedGame}
        />
      </Suspense>
    );
  }

  if (!selectedGame) {
    return (
      <AppPage className="space-y-0 px-0 pb-0 pt-0">
        {/* 暂时隐藏「功能开发中」蒙板 */}
      </AppPage>
    );
  }

  const statusBackLabel = safeReturnPath ? "返回上一页" : null;
  const isParkingActive =
    selectedGame.id === "parking-war" && activeGameId === "parking-war";
  const friendActivities = gameCenterFriendActivities.filter((activity) =>
    Boolean(getGameCenterGame(activity.gameId)),
  );

  function handleSelectAndLaunch(gameId: string) {
    setSelectedGameId(gameId);
    handleLaunchGame(gameId);
  }

  return (
    <AppPage className="space-y-0 bg-white px-0 pb-0 pt-0">
      <TabPageTopBar
        title="游戏"
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-white px-4 pb-2 pt-2 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full border-0 bg-transparent text-[color:var(--text-primary)] active:bg-black/[0.05]"
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
            onClick={() => void handleCopyGameToMobile(selectedGame.id)}
            aria-label={
              nativeMobileShareSupported ? "分享当前游戏" : "复制游戏入口"
            }
          >
            {nativeMobileShareSupported ? (
              <Share2 size={17} />
            ) : (
              <Copy size={17} />
            )}
          </Button>
        }
      />

      <div className="bg-white pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        {myGames.length > 0 ? (
          <div className="border-b border-[color:var(--border-faint)] bg-white">
            <SectionHeader title="我的游戏" />
            <div className="flex gap-4 overflow-x-auto px-4 pb-3 pt-1">
              {myGames.map((game) => (
                <GameIconTile
                  key={`my-${game.id}`}
                  game={game}
                  onClick={() => handleSelectAndLaunch(game.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {bannerGame ? (
          <div className="border-b border-[color:var(--border-faint)] bg-white px-4 py-3">
            <BannerCard
              game={bannerGame}
              onLaunch={() => handleSelectAndLaunch(bannerGame.id)}
            />
          </div>
        ) : null}

        {successNotice ? (
          <div className="bg-white px-4 pt-3">
            <InlineNotice
              className="rounded-[10px] px-3 py-2 text-[12px] leading-[1.35rem] shadow-none"
              tone={noticeTone}
            >
              {noticeTone === "info" &&
              ((noticeActionState &&
                noticeActionState.message === successNotice) ||
                statusBackLabel) ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1">{successNotice}</span>
                  <div className="flex items-center gap-1.5">
                    {noticeActionState &&
                    noticeActionState.message === successNotice ? (
                      <button
                        type="button"
                        onClick={noticeActionState.onAction}
                        className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[11px] font-medium text-[color:var(--text-secondary)]"
                      >
                        {noticeActionState.label}
                      </button>
                    ) : null}
                    {statusBackLabel ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="shrink-0 rounded-full border border-[rgba(15,23,42,0.08)] bg-white px-2 py-0.5 text-[11px] font-medium text-[color:var(--text-secondary)]"
                      >
                        {statusBackLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                successNotice
              )}
            </InlineNotice>
          </div>
        ) : null}

        {isParkingActive ? (
          <div className="border-b border-[color:var(--border-faint)] bg-white px-4 py-3">
            <div className="overflow-hidden rounded-[16px] border border-[color:var(--border-subtle)]">
              <ParkingWarGame variant="embedded" onExit={dismissActiveGame} />
            </div>
          </div>
        ) : null}

        {friendActivities.length > 0 ? (
          <div className="border-b border-[color:var(--border-faint)] bg-white">
            <SectionHeader title="好友在玩" />
            <ul className="bg-white">
              {friendActivities.map((activity) => {
                const game = getGameCenterGame(activity.gameId);
                if (!game) return null;
                return (
                  <FriendActivityRow
                    key={activity.id}
                    activity={activity}
                    game={game}
                    invited={Boolean(
                      friendInviteStatusByActivityId[activity.id],
                    )}
                    onSelect={() => setSelectedGameId(game.id)}
                    onInvite={() => handleInviteFriend(activity.id)}
                  />
                );
              })}
            </ul>
          </div>
        ) : null}

        {featuredRest.length > 0 ? (
          <div className="border-b border-[color:var(--border-faint)] bg-white">
            <SectionHeader title="精选小游戏" trailing="更多" />
            <ul className="bg-white">
              {featuredRest.map((game) => (
                <GameListRow
                  key={`featured-${game.id}`}
                  game={game}
                  onLaunch={() => handleSelectAndLaunch(game.id)}
                  onSelect={() => setSelectedGameId(game.id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-b border-[color:var(--border-faint)] bg-white">
          <SectionHeader title="热门小游戏" trailing="更多" />
          <ul className="bg-white">
            {gameCenterHotRankings.map((entry) => {
              const game = getGameCenterGame(entry.gameId);
              if (!game) return null;
              return (
                <GameListRow
                  key={`hot-${entry.gameId}`}
                  game={game}
                  onLaunch={() => handleSelectAndLaunch(game.id)}
                  onSelect={() => setSelectedGameId(game.id)}
                />
              );
            })}
          </ul>
        </div>

        <div className="bg-white">
          <SectionHeader title="新游榜" trailing="更多" />
          <ul className="bg-white">
            {gameCenterNewRankings.map((entry) => {
              const game = getGameCenterGame(entry.gameId);
              if (!game) return null;
              return (
                <GameListRow
                  key={`new-${entry.gameId}`}
                  game={game}
                  onLaunch={() => handleSelectAndLaunch(game.id)}
                  onSelect={() => setSelectedGameId(game.id)}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </AppPage>
  );
}

function SectionHeader({
  title,
  trailing,
  onTrailingClick,
}: {
  title: string;
  trailing?: string;
  onTrailingClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-4 text-[14px] font-medium text-[color:var(--text-primary)]">
      <span>{title}</span>
      {trailing ? (
        <button
          type="button"
          onClick={onTrailingClick}
          className="inline-flex items-center gap-0.5 text-[12px] font-normal text-[color:var(--text-muted)] active:text-[color:var(--text-secondary)]"
        >
          {trailing}
          <ChevronRight size={13} />
        </button>
      ) : null}
    </div>
  );
}

function GameAvatar({
  game,
  size = "md",
}: {
  game: GameCenterGame;
  size?: "sm" | "md" | "lg";
}) {
  const tone = getGameCenterToneStyle(game.tone);
  const sizeClass =
    size === "sm"
      ? "h-10 w-10 rounded-[10px] text-[15px]"
      : size === "lg"
        ? "h-14 w-14 rounded-[14px] text-[20px]"
        : "h-[52px] w-[52px] rounded-[14px] text-[18px]";
  const initial = [...game.name][0] ?? "?";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        sizeClass,
        tone.iconClassName,
      )}
    >
      {initial}
    </div>
  );
}

function GameIconTile({
  game,
  onClick,
}: {
  game: GameCenterGame;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-14 shrink-0 flex-col items-center gap-1.5 text-center"
    >
      <GameAvatar game={game} size="md" />
      <span className="w-full truncate text-[11px] leading-tight text-[color:var(--text-secondary)]">
        {game.name}
      </span>
    </button>
  );
}

function BannerCard({
  game,
  onLaunch,
}: {
  game: GameCenterGame;
  onLaunch: () => void;
}) {
  const tone = getGameCenterToneStyle(game.tone);
  return (
    <button
      type="button"
      onClick={onLaunch}
      className={cn(
        "relative block w-full overflow-hidden rounded-[14px] text-left shadow-none",
        tone.heroCardClassName,
      )}
      style={{ aspectRatio: "2 / 1" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-0 left-8 h-24 w-24 rounded-full bg-black/10 blur-3xl" />
      </div>
      <div className="relative flex h-full flex-col justify-between p-4">
        <div>
          <div className="inline-flex rounded-full border border-white/18 bg-white/15 px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] text-white/85">
            {game.badge}
          </div>
          <div className="mt-2 text-[18px] font-semibold leading-tight text-white">
            {game.name}
          </div>
          <div className="mt-1 line-clamp-1 text-[12px] leading-snug text-white/82">
            {game.slogan}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/72">{game.playersLabel}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[color:var(--text-primary)]">
            <Play size={13} />
            开始
          </span>
        </div>
      </div>
    </button>
  );
}

function GameListRow({
  game,
  onLaunch,
  onSelect,
  trailingLabel = "开始",
}: {
  game: GameCenterGame;
  onLaunch: () => void;
  onSelect?: () => void;
  trailingLabel?: string;
}) {
  const visibleTags = game.tags.slice(0, 2);
  return (
    <li className="flex items-center gap-3 border-b border-[color:var(--border-faint)] px-4 py-3 last:border-b-0">
      <button
        type="button"
        onClick={onSelect ?? onLaunch}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <GameAvatar game={game} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-[color:var(--text-primary)]">
            {game.name}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[12px] text-[color:var(--text-muted)]">
            {game.slogan}
          </div>
          {visibleTags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-[color:var(--bg-canvas-muted,rgba(0,0,0,0.04))] px-1.5 py-px text-[10px] text-[color:var(--text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        onClick={onLaunch}
        className="h-7 shrink-0 rounded-full bg-[#07C160] px-4 text-[12px] font-medium text-white active:bg-[#06ad57]"
      >
        {trailingLabel}
      </button>
    </li>
  );
}

function FriendActivityRow({
  activity,
  game,
  invited,
  onSelect,
  onInvite,
}: {
  activity: (typeof gameCenterFriendActivities)[number];
  game: GameCenterGame;
  invited: boolean;
  onSelect: () => void;
  onInvite: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-[color:var(--border-faint)] px-4 py-3 last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <AvatarChip
          name={activity.friendName}
          src={activity.friendAvatar}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-[color:var(--text-primary)]">
            {activity.friendName}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[12px] text-[color:var(--text-muted)]">
            正在玩 {game.name} · {activity.status}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onInvite}
        className={cn(
          "h-7 shrink-0 rounded-full px-4 text-[12px] font-medium",
          invited
            ? "border border-[color:var(--border-subtle)] bg-white text-[color:var(--text-secondary)]"
            : "bg-[#07C160] text-white active:bg-[#06ad57]",
        )}
      >
        {invited ? "已邀约" : "邀请"}
      </button>
    </li>
  );
}
