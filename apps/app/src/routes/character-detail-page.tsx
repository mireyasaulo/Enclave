import { useEffect, useMemo, useState, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Star } from "lucide-react";
import {
  blockCharacter,
  deleteFriend,
  getBlockedCharacters,
  getCharacter,
  getConversations,
  getFriendRequests,
  getFriends,
  getOrCreateConversation,
  markFollowupRecommendationChatStarted,
  markFollowupRecommendationFriendRequestPending,
  sendFriendRequest,
  setCharacterDefaultVoiceReply,
  setConversationMuted,
  setConversationPinned,
  setFriendStarred,
  unblockCharacter,
  updateFriendProfile,
  type UpdateFriendProfileRequest,
} from "@yinjie/contracts";
import {
  AppPage,
  Button,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  cn,
} from "@yinjie/ui";
import { AvatarChip } from "../components/avatar-chip";
import { EmptyState } from "../components/empty-state";
import { InlineNoticeActionButton } from "../components/inline-notice-action-button";
import { SparkBadge } from "../components/spark-badge";
import { DigitalHumanEntryNotice } from "../features/chat/digital-human-entry-notice";
import { buildMobileChatRouteHash } from "../features/chat/mobile-chat-route-state";
import { useDigitalHumanEntryGuard } from "../features/chat/use-digital-human-entry-guard";
import { MobileDetailsActionSheet } from "../features/chat-details/mobile-details-action-sheet";
import { ContactDetailPane } from "../features/contacts/contact-detail-pane";
import { invalidateFriendDisplayQueries } from "../features/contacts/invalidate-friend-display";
import {
  buildCharacterDetailRouteHash,
  parseCharacterDetailRouteState,
} from "../features/contacts/character-detail-route-state";
import { buildDesktopContactsRouteHash } from "../features/contacts/contacts-route-state";
import {
  buildDesktopChatRouteHash,
  buildDesktopChatThreadPath,
} from "../features/desktop/chat/desktop-chat-route-state";
import { buildMobileFriendRequestsRouteHash } from "../features/contacts/mobile-friend-requests-route-state";
import { buildMobileFriendMomentsRouteHash } from "../features/moments/mobile-friend-moments-route-state";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { useCappedPending } from "../hooks/use-capped-pending";
import { isPersistedGroupConversation } from "../lib/conversation-route";
import { formatTimestamp } from "../lib/format";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { buildPublicShareUrl } from "../lib/share-url";
import { buildYinjieId } from "../lib/yinjie-id";
import { shareWithNativeShell } from "../runtime/mobile-bridge";
import { isNativeMobileShareSurface } from "../runtime/mobile-share-surface";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  translateCharacterActivity,
  translateCharacterBio,
  translateExpertDomains,
} from "../lib/character-i18n";

const CHARACTER_DETAIL_BLOCK_REASON = "character_detail_block";

type FriendProfileFormState = {
  remarkName: string;
  tags: string;
};

async function buildDesktopAddFriendRouteHashOnDemand(input: {
  keyword: string;
  characterId?: string;
  openCompose?: boolean;
  recommendationId?: string;
}) {
  const { buildDesktopAddFriendRouteHash } =
    await import("../features/contacts/add-friend-route-state");
  return buildDesktopAddFriendRouteHash(input);
}

async function buildDesktopFriendMomentsRouteHashOnDemand(input: {
  momentId?: string;
  source?: "character-detail";
  returnPath?: string;
  returnHash?: string;
}) {
  const { buildDesktopFriendMomentsRouteHash } =
    await import("../features/moments/friend-moments-route-state");
  return buildDesktopFriendMomentsRouteHash(input);
}

async function buildDesktopContactsRouteHashOnDemand(input: {
  characterId?: string;
  isFriend: boolean;
}) {
  const { buildDesktopContactsRouteHash } =
    await import("../features/contacts/contacts-route-state");
  return buildDesktopContactsRouteHash({
    pane: input.isFriend ? "friend" : "world-character",
    characterId: input.characterId,
    showWorldCharacters: !input.isFriend,
  });
}

export function CharacterDetailPage() {
  const t = translateRuntimeMessage;
  const { characterId } = useParams({ from: "/character/$characterId" });
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const hash = useRouterState({ select: (state) => state.location.hash });
  const queryClient = useQueryClient();
  const runtimeConfig = useAppRuntimeConfig();
  const isDesktopLayout = useDesktopLayout();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const ownerName = useWorldOwnerStore((state) => state.username) ?? t(msg`我`);
  const nativeMobileShareSupported = isNativeMobileShareSurface({
    isDesktopLayout,
  });
  const [notice, setNotice] = useState<{
    tone: "success" | "info" | "warning";
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [mobileSheetAction, setMobileSheetAction] = useState<
    "call" | "block" | "delete" | null
  >(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const { entryNotice, guardVideoEntry, resetEntryGuard } =
    useDigitalHumanEntryGuard({
      baseUrl,
    });
  const [profileForm, setProfileForm] = useState<FriendProfileFormState>({
    remarkName: "",
    tags: "",
  });
  const routeState = useMemo(
    () => parseCharacterDetailRouteState(hash),
    [hash],
  );
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const recommendationId = routeState.recommendationId;
  const safeMobileReturnPath =
    routeState.returnPath && !isDesktopOnlyPath(routeState.returnPath)
      ? routeState.returnPath
      : undefined;
  const safeMobileReturnHash = safeMobileReturnPath
    ? routeState.returnHash
    : undefined;
  const mobileCurrentRouteHash = useMemo(
    () =>
      buildCharacterDetailRouteHash({
        recommendationId,
        returnPath: safeMobileReturnPath,
        returnHash: safeMobileReturnHash,
      }),
    [recommendationId, safeMobileReturnHash, safeMobileReturnPath],
  );

  const characterQuery = useQuery({
    queryKey: ["app-character", baseUrl, characterId],
    queryFn: () => getCharacter(characterId, baseUrl),
  });
  const friendsQuery = useQuery({
    queryKey: ["app-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
  });
  const isAlreadyFriend = useMemo(
    () =>
      (friendsQuery.data ?? []).some(
        (item) => item.character.id === characterId,
      ),
    [characterId, friendsQuery.data],
  );
  // 走查 R1：character-detail 进来时如果已经是好友（绝大多数从消息 tab→详情进入
  // 都是这条路径），底部按钮直接渲染「发消息 / 音视频通话」，friendRequestsQuery
  // 的结果只在 "添加到通讯录" / "等待对方通过" / "查看好友申请" 三种非好友状态下
  // 使用。原来无条件 enabled 让每个名片打开都触发一次 /social/friend-requests
  // 全量查询，毫无价值地多一次后台往返。已确认是好友就 skip；friendsQuery 还在
  // loading / 报错时仍允许拉，保证非好友态下 UI 能拿到 inbound/outbound 状态。
  const friendRequestsQuery = useQuery({
    queryKey: ["app-friend-requests", baseUrl, "all"],
    queryFn: () => getFriendRequests(baseUrl, { direction: "all" }),
    enabled: !isAlreadyFriend,
  });
  const blockedQuery = useQuery({
    queryKey: ["app-chat-details-blocked", baseUrl],
    queryFn: () => getBlockedCharacters(baseUrl),
  });
  const conversationsQuery = useQuery({
    queryKey: ["app-conversations", baseUrl],
    queryFn: () => getConversations(baseUrl),
    enabled: isDesktopLayout,
  });

  useEffect(() => {
    if (
      characterQuery.isLoading ||
      !isMissingCharacterError(characterQuery.error, characterId)
    ) {
      return;
    }

    if (routeState.returnPath && !isDesktopOnlyPath(routeState.returnPath)) {
      void navigate({
        to: routeState.returnPath,
        ...(routeState.returnHash ? { hash: routeState.returnHash } : {}),
        replace: true,
      });
      return;
    }

    void navigate({ to: "/tabs/contacts", replace: true });
  }, [
    characterId,
    characterQuery.error,
    characterQuery.isLoading,
    navigate,
    routeState.returnHash,
    routeState.returnPath,
  ]);

  const character = characterQuery.data;
  const friendship = useMemo(
    () =>
      (friendsQuery.data ?? []).find(
        (item) => item.character.id === characterId,
      )?.friendship ?? null,
    [characterId, friendsQuery.data],
  );
  const selectedConversation = useMemo(
    () =>
      (conversationsQuery.data ?? []).find(
        (item) =>
          !isPersistedGroupConversation(item) &&
          item.participants.includes(characterId),
      ) ?? null,
    [characterId, conversationsQuery.data],
  );
  const commonGroups = useMemo(
    () =>
      (conversationsQuery.data ?? [])
        .filter(
          (item) =>
            isPersistedGroupConversation(item) &&
            item.participants.includes(characterId),
        )
        .map((item) => ({
          id: item.id,
          name: item.title,
        })),
    [characterId, conversationsQuery.data],
  );
  const isFriend = Boolean(friendship);
  const isBlocked = (blockedQuery.data ?? []).some(
    (item) => item.characterId === characterId,
  );
  const pendingFriendRequest = (friendRequestsQuery.data ?? []).find(
    (item) => item.characterId === characterId && item.status === "pending",
  );
  const hasInboundFriendRequest =
    !!pendingFriendRequest && !pendingFriendRequest.acceptAt;
  const hasOutboundFriendRequest =
    !!pendingFriendRequest && !!pendingFriendRequest.acceptAt;
  const hasPendingFriendRequest =
    hasInboundFriendRequest || hasOutboundFriendRequest;
  const unsetLabel = t(msg`未设置`);
  const worldContactLabel = t(msg`世界联系人`);
  const worldRoleLabel = t(msg`世界角色`);
  const friendInfoLabel = t(msg`朋友信息`);
  const detailInfoLabel = t(msg`详细资料`);
  const loadingFriendProfileLabel = t(msg`正在读取朋友资料...`);
  const loadingFriendProfileTitle = t(msg`正在读取朋友资料`);
  const loadingFriendProfileDescription = t(
    msg`稍等一下，正在同步这个联系人的资料和关系状态。`,
  );
  const unavailableContactBadge = t(msg`联系人`);
  const unavailableContactProfileTitle = t(msg`联系人资料暂时不可用`);
  const missingCharacterTitle = t(msg`角色不存在`);
  const missingCharacterDescription = t(
    msg`这个资料暂时不可用，返回通讯录再试一次。`,
  );
  const missingCharacterRetryPreviousDescription = t(
    msg`这个资料暂时不可用，可以先重试读取，或返回上一页后再试。`,
  );
  const missingCharacterRetryContactsDescription = t(
    msg`这个资料暂时不可用，可以先重试读取，或返回通讯录后再试。`,
  );
  const retryLoadLabel = t(msg`重试读取`);
  const backButtonLabel = t(msg`返回`);
  const backToPreviousPageLabel = t(msg`返回上一页`);
  const backToContactsLabel = t(msg`返回通讯录`);
  const loadingBadgeLabel = t(msg`读取中`);
  const viewCharacterProfileLabel = t(msg`查看角色资料`);
  const videoConnectingLabel = t(msg`正在接通视频...`);
  const voiceConnectingLabel = t(msg`正在接通语音...`);
  const openingLabel = t(msg`正在打开...`);
  const connectingLabel = t(msg`正在接通...`);
  const sendMessageLabel = t(msg`发消息`);
  const voiceCallLabel = t(msg`语音通话`);
  const audioVideoCallLabel = t(msg`音视频通话`);
  const viewFriendRequestLabel = t(msg`查看好友申请`);
  const awaitingAcceptanceLabel = t(msg`等待对方通过`);
  const sendingLabel = t(msg`发送中...`);
  const addToContactsLabel = t(msg`添加到通讯录`);
  const profileSectionTitle = t(msg`资料`);
  const settingsRemarkTagsLabel = t(msg`设置备注和标签`);
  const remarkLabel = t(msg`备注`);
  const remarkPlaceholder = t(msg`给朋友设置备注名`);
  const tagsLabel = t(msg`标签`);
  const tagsPlaceholder = t(msg`用逗号分隔，例如：同事，策展`);
  const cancelLabel = t(msg`取消`);
  const savingLabel = t(msg`保存中...`);
  const saveLabel = t(msg`保存`);
  const regionLabel = t(msg`地区`);
  const sourceLabel = t(msg`来源`);
  const metInWorldLabel = t(msg`世界内自然认识`);
  const momentsLabel = t(msg`朋友圈`);
  const momentsValueLabel = t(msg`查看这位角色最近的朋友圈`);
  const recommendToFriendLabel = t(msg`推荐给朋友`);
  const openSystemShareLabel = t(msg`打开系统分享面板`);
  const copyCardLabel = t(msg`复制这张隐界名片`);
  const moreInfoTitle = t(msg`更多资料`);
  const recentInteractionLabel = t(msg`最近互动`);
  const commonGroupsLabel = t(msg`共同群聊`);
  const currentStatusLabel = t(msg`当前状态`);
  const expertiseLabel = t(msg`擅长领域`);
  const bioLabel = t(msg`角色简介`);
  const noMoreIntroLabel = t(msg`暂时没有更多介绍。`);
  const friendPermissionsTitle = t(msg`朋友权限`);
  const relationshipManagementTitle = t(msg`关系管理`);
  const starredFriendLabel = t(msg`设为星标朋友`);
  const updatingLabel = t(msg`正在更新...`);
  const restoreNormalContactLabel = t(msg`恢复正常联系`);
  const stopReceivingInteractionLabel = t(msg`不再接收对方互动`);
  const deleteContactLabel = t(msg`删除联系人`);
  const deletingLabel = t(msg`正在删除...`);
  const removeFromContactsLabel = t(msg`从通讯录移除`);
  const remarkName = friendship?.remarkName?.trim() ?? "";
  const displayName = remarkName || character?.name || detailInfoLabel;
  const signature =
    character?.currentStatus?.trim() ||
    translateCharacterBio(t, character?.bio) ||
    t(msg`这个角色还没有个性签名。`);
  const expertiseSummary = character?.expertDomains?.length
    ? translateExpertDomains(t, character.expertDomains, "join")
    : unsetLabel;
  const activitySummary =
    translateCharacterActivity(t, character?.currentActivity) ||
    character?.relationship?.trim() ||
    t(msg`暂无状态`);
  const tagSummary = friendship?.tags?.length
    ? friendship.tags.join("、")
    : unsetLabel;

  const navigateToDesktopContactsSelection = ({
    replace = false,
    isFriend: nextIsFriend = isFriend,
  }: {
    replace?: boolean;
    isFriend?: boolean;
  } = {}) => {
    void buildDesktopContactsRouteHashOnDemand({
      characterId,
      isFriend: nextIsFriend,
    })
      .then((desktopHash) => {
        void navigate({
          to: "/tabs/contacts",
          hash: desktopHash,
          replace,
        });
      })
      .catch(() => {
        void navigate({ to: "/tabs/contacts", replace });
      });
  };

  const navigateToRouteStateReturn = ({
    replace = false,
  }: {
    replace?: boolean;
  } = {}) => {
    if (!routeState.returnPath) {
      return false;
    }

    if (!isDesktopLayout && isDesktopOnlyPath(routeState.returnPath)) {
      return false;
    }

    void navigate({
      to: routeState.returnPath,
      ...(routeState.returnHash ? { hash: routeState.returnHash } : {}),
      replace,
    });
    return true;
  };
  const renderMobileErrorBackAction = () => (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-7 shrink-0 rounded-full border-[color:var(--border-subtle)] bg-white px-3 text-[10px]"
      onClick={() => {
        if (navigateToRouteStateReturn()) {
          return;
        }

        void navigate({ to: "/tabs/contacts" });
      }}
    >
      {safeMobileReturnPath ? backToPreviousPageLabel : backToContactsLabel}
    </Button>
  );
  const renderMobileRetryCharacterLoadAction = () => (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-7 shrink-0 rounded-full border-[color:var(--border-subtle)] bg-white px-3 text-[10px]"
      onClick={() => {
        void characterQuery.refetch();
      }}
    >
      {retryLoadLabel}
    </Button>
  );

  // 切角色才清状态；如果只是同一角色的 friendship 重新拉回来，不要把刚弹出的
  // 成功提示和正在编辑的备注/标签输入框一并冲掉。
  useEffect(() => {
    setNotice(null);
    setMobileSheetAction(null);
    setIsEditingProfile(false);
    resetEntryGuard();
  }, [characterId, resetEntryGuard]);

  // 走查 Round 1：friendship.tags 是数组，每次 friendsQuery 重新拉就换一份引用，
  // 之前把 tags 作为 deps 直接放进上面的 effect → 后台刷新时 setNotice(null) 把
  // updateProfileMutation onSuccess 刚弹的"朋友资料已更新"瞬间吃掉，正在编辑的
  // 备注/标签输入框也被强行关闭并清空。改成只在非编辑态时把表单同步成服务器值，
  // 同时把 tags 数组扁平成字符串当 dep，避免引用抖动。
  const friendshipTagsKey = friendship?.tags?.join("，") ?? "";
  useEffect(() => {
    if (isEditingProfile) {
      return;
    }
    setProfileForm({
      remarkName: friendship?.remarkName ?? "",
      tags: friendshipTagsKey,
    });
  }, [characterId, friendship?.remarkName, friendshipTagsKey, isEditingProfile]);

  const startChatMutation = useMutation({
    mutationFn: async () => {
      if (!character) {
        return null;
      }

      return getOrCreateConversation({ characterId }, baseUrl);
    },
    onSuccess: async (conversation) => {
      if (!conversation) {
        return;
      }

      if (recommendationId) {
        await markFollowupRecommendationChatStarted(
          recommendationId,
          baseUrl,
        ).catch(() => undefined);
      }
      void navigate({
        to: isDesktopLayout
          ? buildDesktopChatThreadPath({
              conversationId: conversation.id,
            })
          : "/chat/$conversationId",
        params: isDesktopLayout
          ? undefined
          : { conversationId: conversation.id },
        hash: isDesktopLayout
          ? undefined
          : buildMobileChatRouteHash({
              returnPath: `/character/${characterId}`,
              returnHash: mobileCurrentRouteHash || undefined,
            }),
      });
    },
  });
  const openCallMutation = useMutation({
    mutationFn: async (kind: "voice" | "video") => {
      if (!character) {
        return null;
      }

      const conversation = await getOrCreateConversation(
        { characterId },
        baseUrl,
      );

      return {
        conversation,
        kind,
      };
    },
    onSuccess: (result) => {
      if (!result?.conversation) {
        return;
      }

      void navigate({
        to: isDesktopLayout
          ? "/tabs/chat"
          : result.kind === "voice"
            ? "/chat/$conversationId/voice-call"
            : "/chat/$conversationId/video-call",
        params: isDesktopLayout
          ? undefined
          : { conversationId: result.conversation.id },
        hash: isDesktopLayout
          ? buildDesktopChatRouteHash({
              conversationId: result.conversation.id,
              callAction: result.kind,
            })
          : buildMobileChatRouteHash({
              returnPath: `/character/${characterId}`,
              returnHash: mobileCurrentRouteHash || undefined,
            }),
      });
    },
  });
  const sendFriendRequestMutation = useMutation({
    mutationFn: async () => {
      const request = await sendFriendRequest(
        {
          characterId,
          greeting: t(msg`${ownerName} 想把你加到通讯录里。`),
          autoAccept: recommendationId ? false : true,
        },
        baseUrl,
      );
      if (recommendationId) {
        await markFollowupRecommendationFriendRequestPending(
          recommendationId,
          { friendRequestId: request.id },
          baseUrl,
        ).catch(() => undefined);
      }
      return request;
    },
    onSuccess: async () => {
      setNotice({
        tone: "success",
        message: recommendationId
          ? t(msg`好友申请已发送。`)
          : t(msg`已添加到通讯录。`),
      });
      // 走查 R1：app-friends-quick-start 全代码库无 useQuery 订阅，纯死 invalidate；
      // app-group-friends 在 create-group-page 已经统一到 app-friends，这里同样无订阅。
      // 都删掉，留下真正在用的三条。
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["app-friend-requests", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app-friends", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app-conversations", baseUrl],
        }),
      ]);
    },
  });
  const sendFriendRequestDisplayedPending = useCappedPending(
    sendFriendRequestMutation.isPending,
    500,
  );
  const setStarredMutation = useMutation({
    mutationFn: (starred: boolean) =>
      setFriendStarred(characterId, { starred }, baseUrl),
    onSuccess: async (_, starred) => {
      setNotice({
        tone: "success",
        message: starred ? t(msg`已设为星标朋友。`) : t(msg`已取消星标朋友。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-friends", baseUrl],
      });
    },
  });
  const setDefaultVoiceReplyMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      setCharacterDefaultVoiceReply(characterId, enabled, baseUrl),
    onSuccess: async (_, enabled) => {
      setNotice({
        tone: "success",
        message: enabled
          ? t(msg`已开启默认语音回复（消耗 token plan 配额）。`)
          : t(msg`已关闭默认语音回复。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-character", baseUrl, characterId],
      });
    },
  });
  const pinMutation = useMutation({
    mutationFn: async (pinned: boolean) => {
      const conversationId =
        selectedConversation &&
        !isPersistedGroupConversation(selectedConversation)
          ? selectedConversation.id
          : (await getOrCreateConversation({ characterId }, baseUrl)).id;

      return setConversationPinned(conversationId, { pinned }, baseUrl);
    },
    onSuccess: async (_, pinned) => {
      setNotice({
        tone: "success",
        message: pinned ? t(msg`聊天已置顶。`) : t(msg`聊天已取消置顶。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-conversations", baseUrl],
      });
    },
  });
  const muteMutation = useMutation({
    mutationFn: async (muted: boolean) => {
      const conversationId =
        selectedConversation &&
        !isPersistedGroupConversation(selectedConversation)
          ? selectedConversation.id
          : (await getOrCreateConversation({ characterId }, baseUrl)).id;

      return setConversationMuted(conversationId, { muted }, baseUrl);
    },
    onSuccess: async (_, muted) => {
      setNotice({
        tone: "success",
        message: muted
          ? t(msg`已开启消息免打扰。`)
          : t(msg`已关闭消息免打扰。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-conversations", baseUrl],
      });
    },
  });
  const updateProfileMutation = useMutation({
    mutationFn: (payload: UpdateFriendProfileRequest) =>
      updateFriendProfile(characterId, payload, baseUrl),
    onSuccess: async () => {
      setNotice({
        tone: "success",
        message: t(msg`朋友资料已更新。`),
      });
      setIsEditingProfile(false);
      await invalidateFriendDisplayQueries(queryClient, baseUrl);
    },
  });
  const blockMutation = useMutation({
    mutationFn: async (blocked: boolean) => {
      if (blocked) {
        await unblockCharacter({ characterId }, baseUrl);
        return;
      }

      await blockCharacter(
        {
          characterId,
          reason: CHARACTER_DETAIL_BLOCK_REASON,
        },
        baseUrl,
      );
    },
    onSuccess: async (_, blocked) => {
      setNotice({
        tone: "success",
        message: blocked ? t(msg`已移出黑名单。`) : t(msg`已加入黑名单。`),
      });
      // 走查 R3：blockCharacter 后端把 friendship.status 改成 'blocked' 且
      // 把 isStarred 一并清掉，getFriends() 此后不再返回这条 friendship。但
      // 这里 onSuccess 只 invalidate 黑名单相关三条 query，app-friends/
      // app-conversations 都没动。结果：用户在好友名片上点「加入黑名单」之后页
      // 面仍按"朋友"状态渲染（顶部"朋友信息" / 底部"发消息+音视频通话" / 星标
      // 还亮着），要离开再进来才修。unblock 非 default 居民时友谊行被整行 remove，
      // 同样会留下脏的 friendsQuery 缓存。一起 invalidate 进来。
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["app-chat-details-blocked", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app-contacts-blocked", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app-chat-blocked-characters", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app-friends", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["app-conversations", baseUrl],
        }),
      ]);
    },
  });
  const deleteFriendMutation = useMutation({
    mutationFn: () => deleteFriend(characterId, baseUrl),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-friends", baseUrl] }),
        queryClient.invalidateQueries({
          queryKey: ["app-conversations", baseUrl],
        }),
      ]);
      if (navigateToRouteStateReturn({ replace: true })) {
        return;
      }

      if (isDesktopLayout) {
        navigateToDesktopContactsSelection({ isFriend: false });
        return;
      }

      void navigate({ to: "/tabs/contacts" });
    },
  });

  const handleBack = () => {
    const expectedPreviousPath = safeMobileReturnPath ?? "/tabs/contacts";
    navigateBackOrFallback(
      () => {
        if (navigateToRouteStateReturn()) {
          return;
        }

        if (isDesktopLayout) {
          navigateToDesktopContactsSelection();
          return;
        }

        void navigate({ to: "/tabs/contacts" });
      },
      expectedPreviousPath,
    );
  };

  // 走查 R2：手机端备注/标签编辑表单的「保存」按钮只看 isPending 决定 disabled，
  // 即便用户没动过任何字符也会发一次 updateFriendProfile。后端会照样写 friendship
  // + 触发 cyber_avatar.captureSignal 这一整路审计/数字人 signal。点了「设置备注和
  // 标签」只是想关一下面板的人会无意识地刷一次后台 IO。对比一下"normalize 后"的
  // remarkName 和 tags，跟服务器值完全等价就 setIsEditingProfile(false) 直接关
  // 面板，跟桌面 DesktopContactTextEditDialog 的 confirmDisabled 行为对齐。
  const handleSaveProfile = async () => {
    const nextRemarkName = profileForm.remarkName.trim() || null;
    const nextTags = profileForm.tags
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const currentRemarkName = friendship?.remarkName?.trim() || null;
    const currentTags = friendship?.tags ?? [];
    const tagsUnchanged =
      nextTags.length === currentTags.length &&
      nextTags.every((tag, index) => tag === currentTags[index]);
    if (nextRemarkName === currentRemarkName && tagsUnchanged) {
      setIsEditingProfile(false);
      return;
    }
    await updateProfileMutation.mutateAsync({
      remarkName: nextRemarkName,
      tags: nextTags,
    });
  };

  const handleVoiceCall = () => {
    setNotice(null);
    setMobileSheetAction(null);
    openCallMutation.mutate("voice");
  };

  const handleVideoCall = () => {
    setNotice(null);
    setMobileSheetAction(null);
    if (!guardVideoEntry()) {
      return;
    }
    openCallMutation.mutate("video");
  };
  const handleShareCharacterCard = async () => {
    if (!character) {
      return;
    }

    const profilePath = `/character/${character.id}`;
    const profileUrl = buildPublicShareUrl(profilePath);
    const profileSummary = [
      t(msg`${displayName} 的隐界名片`),
      character.relationship?.trim() || worldContactLabel,
      t(msg`隐界号：${buildYinjieId(character.id)}`),
      profileUrl,
    ].join("\n");

    if (nativeMobileShareSupported) {
      const shared = await shareWithNativeShell({
        title: t(msg`${displayName} 的隐界名片`),
        text: profileSummary,
        url: profileUrl,
      });

      if (shared) {
        setNotice({
          tone: "success",
          message: t(msg`已打开系统分享面板。`),
        });
        return;
      }
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setNotice({
        tone: "info",
        message: nativeMobileShareSupported
          ? t(msg`当前设备暂时无法打开系统分享，请稍后重试。`)
          : t(msg`当前环境暂不支持复制名片。`),
        actionLabel: nativeMobileShareSupported
          ? t(msg`重试分享`)
          : t(msg`重试复制`),
        onAction: () => {
          void handleShareCharacterCard();
        },
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(profileSummary);
      setNotice({
        tone: "success",
        message: nativeMobileShareSupported
          ? t(msg`系统分享暂时不可用，已复制名片摘要。`)
          : t(msg`名片摘要已复制。`),
      });
    } catch {
      setNotice({
        tone: "info",
        message: nativeMobileShareSupported
          ? t(msg`系统分享失败，请稍后重试。`)
          : t(msg`复制名片失败，请稍后重试。`),
        actionLabel: nativeMobileShareSupported
          ? t(msg`重试分享`)
          : t(msg`重试复制`),
        onAction: () => {
          void handleShareCharacterCard();
        },
      });
    }
  };
  const handleBlockAction = () => {
    if (isDesktopLayout) {
      const confirmed = window.confirm(
        isBlocked
          ? t(msg`确认把这个角色移出黑名单吗？`)
          : t(msg`加入黑名单后，将不再接收这个角色的互动。确认继续吗？`),
      );
      if (!confirmed) {
        return;
      }

      blockMutation.mutate(isBlocked);
      return;
    }

    setMobileSheetAction("block");
  };
  const handleDeleteFriendAction = () => {
    if (isDesktopLayout) {
      if (!window.confirm(t(msg`确认删除这个联系人吗？`))) {
        return;
      }

      deleteFriendMutation.mutate();
      return;
    }

    setMobileSheetAction("delete");
  };
  const handleAddToContacts = () => {
    if (hasInboundFriendRequest) {
      if (isDesktopLayout) {
        void navigate({
          to: "/tabs/contacts",
          hash: buildDesktopContactsRouteHash({
            pane: "new-friends",
            showWorldCharacters: false,
          }),
        });
        return;
      }

      void navigate({
        to: "/friend-requests",
        hash: buildMobileFriendRequestsRouteHash({
          returnPath: pathname,
          returnHash: mobileCurrentRouteHash || undefined,
        }),
      });
      return;
    }

    if (isDesktopLayout) {
      void buildDesktopAddFriendRouteHashOnDemand({
        keyword: character?.name ?? "",
        characterId,
        openCompose: true,
        recommendationId,
      })
        .then((desktopHash) => {
          void navigate({
            to: "/desktop/add-friend",
            hash: desktopHash,
          });
        })
        .catch(() => {
          void navigate({
            to: "/desktop/add-friend",
          });
        });
      return;
    }

    sendFriendRequestMutation.mutate();
  };
  const handleOpenMoments = () => {
    if (!character) {
      return;
    }

    if (isDesktopLayout) {
      void buildDesktopFriendMomentsRouteHashOnDemand({
        source: "character-detail",
        returnPath: `/character/${character.id}`,
        returnHash: normalizedHash || undefined,
      })
        .then((desktopHash) => {
          void navigate({
            to: "/desktop/friend-moments/$characterId",
            params: { characterId: character.id },
            hash: desktopHash,
          });
        })
        .catch(() => {
          void navigate({
            to: "/desktop/friend-moments/$characterId",
            params: { characterId: character.id },
          });
        });
      return;
    }

    void navigate({
      to: "/friend-moments/$characterId",
      params: { characterId: character.id },
      hash: buildMobileFriendMomentsRouteHash({
        returnPath: `/character/${character.id}`,
        returnHash: mobileCurrentRouteHash || undefined,
      }),
    });
  };
  const mobileSheetConfig =
    mobileSheetAction === "call"
      ? {
          title: t(msg`音视频通话`),
          description: t(msg`选择要发起的通话方式。`),
          actions: [
            {
              key: "voice",
              label: openCallMutation.isPending
                ? t(msg`正在接通语音...`)
                : t(msg`语音通话`),
              description: t(msg`进入语音通话`),
              disabled: openCallMutation.isPending,
              onClick: handleVoiceCall,
            },
            {
              key: "video",
              label: openCallMutation.isPending
                ? t(msg`正在接通视频...`)
                : t(msg`视频通话`),
              description: t(msg`进入视频通话`),
              disabled: openCallMutation.isPending,
              onClick: handleVideoCall,
            },
          ],
        }
      : mobileSheetAction === "block"
        ? {
            title: isBlocked ? t(msg`移出黑名单`) : t(msg`加入黑名单`),
            description: isBlocked
              ? t(msg`移出后将恢复正常联系与互动。`)
              : t(msg`加入黑名单后，将不再接收这个角色的互动。`),
            actions: [
              {
                key: "confirm",
                label: isBlocked ? t(msg`移出黑名单`) : t(msg`加入黑名单`),
                description: isBlocked
                  ? t(msg`恢复正常联系`)
                  : t(msg`后续互动会被拦截`),
                danger: !isBlocked,
                disabled: blockMutation.isPending,
                onClick: () => blockMutation.mutate(isBlocked),
              },
            ],
          }
        : mobileSheetAction === "delete"
          ? {
              title: t(msg`删除联系人`),
              description: t(msg`删除后会从通讯录移除这个联系人。`),
              actions: [
                {
                  key: "confirm",
                  label: t(msg`删除联系人`),
                  description: t(msg`此操作不可恢复`),
                  danger: true,
                  disabled: deleteFriendMutation.isPending,
                  onClick: () => deleteFriendMutation.mutate(),
                },
              ],
            }
          : null;

  if (isDesktopLayout && character && friendship) {
    return (
      <AppPage className="flex h-full min-h-0 flex-col overflow-hidden bg-[#ededed] px-0 py-0">
        <header className="shrink-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.95)] px-3 py-2 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[640px] items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--text-primary)] transition active:bg-black/5"
              aria-label={backButtonLabel}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-medium text-[color:var(--text-primary)]">
                {friendInfoLabel}
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 py-3">
            {notice ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice>
              </div>
            ) : null}
            {entryNotice ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <DigitalHumanEntryNotice
                  tone={entryNotice.tone}
                  message={entryNotice.message}
                  onDismiss={() => {
                    resetEntryGuard();
                  }}
                  onContinue={() => {
                    resetEntryGuard();
                    openCallMutation.mutate("video");
                  }}
                  onSwitchToVoice={() => {
                    resetEntryGuard();
                    openCallMutation.mutate("voice");
                  }}
                  continueLabel={
                    openCallMutation.isPending
                      ? videoConnectingLabel
                      : entryNotice.continueLabel
                  }
                  voiceLabel={
                    openCallMutation.isPending
                      ? voiceConnectingLabel
                      : entryNotice.voiceLabel
                  }
                  compact={false}
                />
              </div>
            ) : null}
            {characterQuery.isLoading ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <LoadingBlock label={loadingFriendProfileLabel} />
              </div>
            ) : null}
            {characterQuery.isError && characterQuery.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={characterQuery.error.message} />
              </div>
            ) : null}
            {friendsQuery.isError && friendsQuery.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={friendsQuery.error.message} />
              </div>
            ) : null}
            {conversationsQuery.isError &&
            conversationsQuery.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={conversationsQuery.error.message} />
              </div>
            ) : null}
            {startChatMutation.isError &&
            startChatMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={startChatMutation.error.message} />
              </div>
            ) : null}
            {openCallMutation.isError &&
            openCallMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={openCallMutation.error.message} />
              </div>
            ) : null}
            {setStarredMutation.isError &&
            setStarredMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={setStarredMutation.error.message} />
              </div>
            ) : null}
            {setDefaultVoiceReplyMutation.isError &&
            setDefaultVoiceReplyMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock
                  message={setDefaultVoiceReplyMutation.error.message}
                />
              </div>
            ) : null}
            {pinMutation.isError && pinMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={pinMutation.error.message} />
              </div>
            ) : null}
            {muteMutation.isError && muteMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={muteMutation.error.message} />
              </div>
            ) : null}
            {blockMutation.isError && blockMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={blockMutation.error.message} />
              </div>
            ) : null}
            {deleteFriendMutation.isError &&
            deleteFriendMutation.error instanceof Error ? (
              <div className="mx-auto w-full max-w-[640px] px-3">
                <ErrorBlock message={deleteFriendMutation.error.message} />
              </div>
            ) : null}

            <ContactDetailPane
              character={character}
              friendship={friendship}
              commonGroups={commonGroups}
              onOpenGroup={(groupId) => {
                void navigate({
                  to: buildDesktopChatThreadPath({
                    conversationId: groupId,
                  }),
                });
              }}
              onOpenMoments={handleOpenMoments}
              onOpenProfile={() => {}}
              onStartChat={() => {
                setNotice(null);
                startChatMutation.mutate();
              }}
              chatPending={startChatMutation.isPending}
              isPinned={selectedConversation?.isPinned ?? false}
              pinPending={pinMutation.isPending}
              onTogglePinned={() => {
                setNotice(null);
                pinMutation.mutate(!(selectedConversation?.isPinned ?? false));
              }}
              isMuted={selectedConversation?.isMuted ?? false}
              mutePending={muteMutation.isPending}
              onToggleMuted={() => {
                setNotice(null);
                muteMutation.mutate(!(selectedConversation?.isMuted ?? false));
              }}
              isStarred={friendship.isStarred}
              starPending={setStarredMutation.isPending}
              onToggleStarred={() => {
                setNotice(null);
                setStarredMutation.mutate(!friendship.isStarred);
              }}
              defaultVoiceReply={character.defaultVoiceReply ?? false}
              defaultVoiceReplyPending={
                setDefaultVoiceReplyMutation.isPending
              }
              onToggleDefaultVoiceReply={() => {
                setNotice(null);
                setDefaultVoiceReplyMutation.mutate(
                  !(character.defaultVoiceReply ?? false),
                );
              }}
              isBlocked={isBlocked}
              blockPending={blockMutation.isPending}
              onToggleBlock={() => {
                setNotice(null);
                blockMutation.mutate(isBlocked);
              }}
              deletePending={deleteFriendMutation.isPending}
              onDeleteFriend={() => {
                handleDeleteFriendAction();
              }}
            />
          </div>
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      className={cn(
        "min-h-full space-y-0 bg-[#ededed] px-0 py-0 text-[color:var(--text-primary)]",
        isDesktopLayout
          ? "h-full overflow-y-auto"
          : "flex h-full min-h-0 flex-col overflow-hidden",
      )}
    >
      <header
        className={cn(
          "z-20 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.95)] px-2 py-2 backdrop-blur-xl",
          isDesktopLayout ? "sticky top-0" : "shrink-0",
        )}
      >
        <div className="relative flex min-h-10 items-center gap-1.5">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--text-primary)] transition active:bg-black/5"
            aria-label={backButtonLabel}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="pointer-events-none absolute inset-x-12 text-center">
            <div className="truncate text-[17px] font-medium text-[color:var(--text-primary)]">
              {isFriend ? friendInfoLabel : detailInfoLabel}
            </div>
            {isDesktopLayout ? (
              <div className="mt-0.5 truncate text-[11px] text-[#8c8c8c]">
                {character?.relationship || viewCharacterProfileLabel}
              </div>
            ) : null}
          </div>
          <div className="ml-auto h-9 w-9 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <div
        className={cn(
          !isDesktopLayout
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
            : undefined,
        )}
      >
        {characterQuery.isLoading ? (
          <div className="px-4 py-3">
            {isDesktopLayout ? (
              <LoadingBlock label={loadingFriendProfileLabel} />
            ) : (
              <MobileCharacterStatusCard
                badge={loadingBadgeLabel}
                title={loadingFriendProfileTitle}
                description={loadingFriendProfileDescription}
                tone="loading"
              />
            )}
          </div>
        ) : null}

        {characterQuery.isError && characterQuery.error instanceof Error ? (
          <div className="px-4 py-3">
            {isDesktopLayout ? (
              <ErrorBlock message={characterQuery.error.message} />
            ) : (
              <MobileCharacterStatusCard
                badge={unavailableContactBadge}
                title={unavailableContactProfileTitle}
                description={characterQuery.error.message}
                tone="danger"
                action={
                  <div className="flex flex-wrap gap-2">
                    {renderMobileRetryCharacterLoadAction()}
                    {renderMobileErrorBackAction()}
                  </div>
                }
              />
            )}
          </div>
        ) : null}

        {!characterQuery.isLoading && !character ? (
          <div className="px-4 py-3">
            {isDesktopLayout ? (
              <EmptyState
                title={missingCharacterTitle}
                description={missingCharacterDescription}
              />
            ) : (
              <MobileCharacterStatusCard
                badge={unavailableContactBadge}
                title={missingCharacterTitle}
                description={
                  safeMobileReturnPath
                    ? missingCharacterRetryPreviousDescription
                    : missingCharacterRetryContactsDescription
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    {renderMobileRetryCharacterLoadAction()}
                    {renderMobileErrorBackAction()}
                  </div>
                }
              />
            )}
          </div>
        ) : null}

        {character ? (
          <div
            className={cn(
              "space-y-2.5 px-3 pt-2",
              isDesktopLayout
                ? "mx-auto w-full max-w-[720px] pb-8 pt-3"
                : "pb-6",
            )}
          >
            {notice ? (
              <InlineNotice
                tone={notice.tone}
                className={
                  isDesktopLayout
                    ? undefined
                    : "rounded-[11px] px-2.5 py-1.5 text-[10px] leading-4 shadow-none"
                }
              >
                {!isDesktopLayout && notice.tone === "info" ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1">{notice.message}</span>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {notice.actionLabel && notice.onAction ? (
                        <InlineNoticeActionButton
                          label={notice.actionLabel}
                          onClick={notice.onAction}
                        />
                      ) : null}
                      {renderMobileErrorBackAction()}
                    </div>
                  </div>
                ) : (
                  notice.message
                )}
              </InlineNotice>
            ) : null}
            {entryNotice ? (
              <DigitalHumanEntryNotice
                tone={entryNotice.tone}
                message={entryNotice.message}
                onDismiss={() => {
                  resetEntryGuard();
                }}
                onContinue={() => {
                  resetEntryGuard();
                  openCallMutation.mutate("video");
                }}
                onSwitchToVoice={() => {
                  resetEntryGuard();
                  openCallMutation.mutate("voice");
                }}
                continueLabel={
                  openCallMutation.isPending
                    ? videoConnectingLabel
                    : entryNotice.continueLabel
                }
                voiceLabel={
                  openCallMutation.isPending
                    ? voiceConnectingLabel
                    : entryNotice.voiceLabel
                }
                compact={!isDesktopLayout}
              />
            ) : null}
            {friendsQuery.isError && friendsQuery.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={friendsQuery.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {friendsQuery.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {friendRequestsQuery.isError &&
            friendRequestsQuery.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={friendRequestsQuery.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {friendRequestsQuery.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {blockedQuery.isError && blockedQuery.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={blockedQuery.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {blockedQuery.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {startChatMutation.isError &&
            startChatMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={startChatMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {startChatMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {openCallMutation.isError &&
            openCallMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={openCallMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {openCallMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {sendFriendRequestMutation.isError &&
            sendFriendRequestMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={sendFriendRequestMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {sendFriendRequestMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {setStarredMutation.isError &&
            setStarredMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={setStarredMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {setStarredMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {/* 走查 Round 4：默认语音回复 switch 在桌面/移动两端都暴露，但
                整页就这一个 mutation 没接 error 渲染——失败（如 token plan 配额
                耗尽 / 网络抖动）时开关回弹但用户得不到任何提示，怀疑自己点漏。 */}
            {setDefaultVoiceReplyMutation.isError &&
            setDefaultVoiceReplyMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock
                  message={setDefaultVoiceReplyMutation.error.message}
                />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {setDefaultVoiceReplyMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {updateProfileMutation.isError &&
            updateProfileMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={updateProfileMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {updateProfileMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {blockMutation.isError && blockMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={blockMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {blockMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}
            {deleteFriendMutation.isError &&
            deleteFriendMutation.error instanceof Error ? (
              isDesktopLayout ? (
                <ErrorBlock message={deleteFriendMutation.error.message} />
              ) : (
                <MobileCharacterErrorNotice
                  action={renderMobileErrorBackAction()}
                >
                  {deleteFriendMutation.error.message}
                </MobileCharacterErrorNotice>
              )
            ) : null}

            <section
              className={cn(
                "overflow-hidden bg-white",
                isDesktopLayout
                  ? "rounded-[18px] border border-black/5"
                  : "-mx-3 border-y border-[color:var(--border-faint)]",
              )}
            >
              <div className="flex items-start justify-between gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "truncate font-medium text-[color:var(--text-primary)]",
                        isDesktopLayout ? "text-[24px]" : "text-[22px]",
                      )}
                    >
                      {displayName}
                    </div>
                    {friendship?.isStarred ? (
                      <Star
                        size={16}
                        className="shrink-0 text-[#d4a72c]"
                        fill="currentColor"
                      />
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-[color:var(--text-secondary)]",
                      isDesktopLayout ? "text-sm" : "text-[13px]",
                    )}
                  >
                    {remarkName
                      ? t(msg`昵称：${character.name}`)
                      : character.relationship || worldContactLabel}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-[color:var(--text-muted)]",
                      isDesktopLayout ? "text-sm" : "text-[12px]",
                    )}
                  >
                    {t(msg`隐界号：${buildYinjieId(character.id)}`)}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-[color:var(--text-muted)]",
                      isDesktopLayout ? "text-sm" : "text-[12px]",
                    )}
                  >
                    {isFriend
                      ? t(
                          msg`地区：${friendship?.region?.trim() || character?.region?.trim() || unsetLabel}`,
                        )
                      : t(
                          msg`身份：${character.relationship || worldRoleLabel}`,
                        )}
                  </div>
                </div>
                <AvatarChip
                  name={character.name}
                  src={character.avatar}
                  size={isDesktopLayout ? "xl" : "wechat"}
                />
              </div>
              <div className="border-t border-[color:var(--border-faint)] px-4 py-3">
                <div
                  className={cn(
                    "text-[color:var(--text-secondary)]",
                    isDesktopLayout
                      ? "text-sm leading-6"
                      : "text-[13px] leading-6",
                  )}
                >
                  {signature}
                </div>
              </div>
            </section>

            {isDesktopLayout ? (
              <section className="overflow-hidden rounded-[18px] border border-black/5 bg-white p-4">
                <div
                  className={cn(
                    "grid gap-2",
                    isFriend ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
                  {isFriend ? (
                    <>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setNotice(null);
                          startChatMutation.mutate();
                        }}
                        className="h-11 rounded-[12px] bg-[#07c160] text-[15px] text-white shadow-none hover:bg-[#06ad56]"
                        disabled={startChatMutation.isPending}
                      >
                        {startChatMutation.isPending
                          ? openingLabel
                          : sendMessageLabel}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setNotice(null);
                          handleVoiceCall();
                        }}
                        className="h-11 rounded-[12px] border-[color:var(--border-faint)] bg-white text-[15px] text-[color:var(--text-primary)] shadow-none hover:bg-[#f5f7f7]"
                        disabled={openCallMutation.isPending}
                      >
                        {openCallMutation.isPending
                          ? connectingLabel
                          : voiceCallLabel}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setNotice(null);
                        handleAddToContacts();
                      }}
                      className="h-11 rounded-[12px] bg-[#07c160] text-[15px] text-white shadow-none hover:bg-[#06ad56]"
                      disabled={
                        hasOutboundFriendRequest ||
                        (sendFriendRequestMutation.isPending &&
                          !hasPendingFriendRequest)
                      }
                    >
                      {hasOutboundFriendRequest
                        ? awaitingAcceptanceLabel
                        : hasInboundFriendRequest
                          ? viewFriendRequestLabel
                          : sendFriendRequestDisplayedPending
                            ? sendingLabel
                            : addToContactsLabel}
                    </Button>
                  )}
                </div>
              </section>
            ) : null}

            <ProfileSection
              title={profileSectionTitle}
              flatOnMobile={!isDesktopLayout}
              compact={!isDesktopLayout}
            >
              {isFriend ? (
                <ProfileRow
                  label={settingsRemarkTagsLabel}
                  value={buildRemarkSummary(
                    friendship?.remarkName,
                    friendship?.tags,
                    unsetLabel,
                  )}
                  onClick={() => setIsEditingProfile((current) => !current)}
                  compact={!isDesktopLayout}
                />
              ) : null}
              {isFriend && isEditingProfile ? (
                <div className="border-t border-[color:var(--border-faint)] bg-[#f7f7f7] px-4 py-3">
                  <div className="space-y-3">
                    <DetailInputField
                      label={remarkLabel}
                      value={profileForm.remarkName}
                      placeholder={remarkPlaceholder}
                      onChange={(value) =>
                        setProfileForm((current) => ({
                          ...current,
                          remarkName: value,
                        }))
                      }
                      compact={!isDesktopLayout}
                    />
                    <DetailInputField
                      label={tagsLabel}
                      value={profileForm.tags}
                      placeholder={tagsPlaceholder}
                      onChange={(value) =>
                        setProfileForm((current) => ({
                          ...current,
                          tags: value,
                        }))
                      }
                      compact={!isDesktopLayout}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileForm({
                          remarkName: friendship?.remarkName ?? "",
                          tags: friendship?.tags?.join("，") ?? "",
                        });
                      }}
                      className="h-9 flex-1 rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 text-[13px] shadow-none hover:bg-[#f5f7f7]"
                      disabled={updateProfileMutation.isPending}
                    >
                      {cancelLabel}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => void handleSaveProfile()}
                      className="h-9 flex-1 rounded-[10px] bg-[#07c160] px-3 text-[13px] text-white shadow-none hover:bg-[#06ad56]"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending
                        ? savingLabel
                        : saveLabel}
                    </Button>
                  </div>
                </div>
              ) : null}
              <ProfileRow
                label={regionLabel}
                value={
                  (isFriend
                    ? friendship?.region?.trim() ||
                      character.region?.trim()
                    : character.region?.trim()) || unsetLabel
                }
                compact={!isDesktopLayout}
              />
              <ProfileRow
                label={sourceLabel}
                value={
                  isFriend
                    ? friendship?.source?.trim() || unsetLabel
                    : metInWorldLabel
                }
                compact={!isDesktopLayout}
              />
              {isFriend ? (
                <ProfileRow
                  label={tagsLabel}
                  value={tagSummary}
                  compact={!isDesktopLayout}
                />
              ) : null}
              {/* 走查 R1：朋友圈入口在移动端无条件渲染，非好友点进去后端按"未授权"
                  返回空列表/错误，跟 desktop ContactDetailPane（已用 isFriend 包过）
                  不一致；非好友本来就拿不到对方朋友圈，挪到 isFriend 分支里。 */}
              {isFriend ? (
                <ProfileRow
                  label={momentsLabel}
                  value={momentsValueLabel}
                  onClick={handleOpenMoments}
                  compact={!isDesktopLayout}
                />
              ) : null}
              <ProfileRow
                label={recommendToFriendLabel}
                value={
                  nativeMobileShareSupported
                    ? openSystemShareLabel
                    : copyCardLabel
                }
                onClick={() => void handleShareCharacterCard()}
                compact={!isDesktopLayout}
              />
            </ProfileSection>

            {isDesktopLayout ? (
              <ProfileSection
                title={moreInfoTitle}
                flatOnMobile={!isDesktopLayout}
                compact={!isDesktopLayout}
              >
                {isFriend ? (
                  <ProfileRow
                    label={recentInteractionLabel}
                    value={formatTimestamp(
                      friendship?.lastInteractedAt ?? character.lastActiveAt,
                    )}
                    compact={!isDesktopLayout}
                  />
                ) : null}
                {isFriend && (friendship?.sparkStreak ?? 0) >= 3 ? (
                  <ProfileRow
                    label={t(msg`火花`)}
                    value={
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <SparkBadge
                          streak={friendship?.sparkStreak}
                          size="md"
                        />
                        <span className="text-[12px] text-[color:var(--text-muted)]">
                          {t(msg`已连续 ${friendship?.sparkStreak ?? 0} 天`)}
                        </span>
                      </span>
                    }
                    compact={!isDesktopLayout}
                  />
                ) : null}
                {commonGroups.length ? (
                  <ProfileRow
                    label={commonGroupsLabel}
                    value={t(msg`${commonGroups.length} 个`)}
                    onClick={() => {
                      const firstGroup = commonGroups[0];
                      if (!firstGroup) {
                        return;
                      }

                      void navigate({
                        to: buildDesktopChatThreadPath({
                          conversationId: firstGroup.id,
                        }),
                      });
                    }}
                    compact={!isDesktopLayout}
                  />
                ) : null}
                {isFriend ? (
                  <ProfileRow
                    label={currentStatusLabel}
                    value={activitySummary}
                    compact={!isDesktopLayout}
                  />
                ) : null}
                <ProfileRow
                  label={expertiseLabel}
                  value={expertiseSummary}
                  multiline
                  compact={!isDesktopLayout}
                />
                <div className="border-t border-[color:var(--border-faint)] px-4 py-3">
                  <div className="text-[color:var(--text-muted)] text-xs uppercase tracking-[0.16em]">
                    {bioLabel}
                  </div>
                  <div className="mt-2 text-[color:var(--text-secondary)] text-sm leading-7">
                    {translateCharacterBio(t, character.bio) || noMoreIntroLabel}
                  </div>
                </div>
              </ProfileSection>
            ) : null}

            <ProfileSection
              title={
                isFriend ? friendPermissionsTitle : relationshipManagementTitle
              }
              flatOnMobile={!isDesktopLayout}
              compact={!isDesktopLayout}
            >
              {isFriend ? (
                <ProfileSwitchRow
                  label={starredFriendLabel}
                  checked={friendship?.isStarred ?? false}
                  onToggle={() =>
                    setStarredMutation.mutate(!(friendship?.isStarred ?? false))
                  }
                  disabled={setStarredMutation.isPending}
                  compact={!isDesktopLayout}
                />
              ) : null}
              <ProfileSwitchRow
                label={t(msg`默认用语音回复`)}
                checked={character.defaultVoiceReply ?? false}
                onToggle={() =>
                  setDefaultVoiceReplyMutation.mutate(
                    !(character.defaultVoiceReply ?? false),
                  )
                }
                disabled={setDefaultVoiceReplyMutation.isPending}
                compact={!isDesktopLayout}
              />
              <ProfileRow
                label={isBlocked ? t(msg`移出黑名单`) : t(msg`加入黑名单`)}
                value={
                  blockMutation.isPending
                    ? updatingLabel
                    : isBlocked
                      ? restoreNormalContactLabel
                      : stopReceivingInteractionLabel
                }
                danger
                onClick={handleBlockAction}
                disabled={blockMutation.isPending}
                compact={!isDesktopLayout}
              />
              {isFriend ? (
                <ProfileRow
                  label={deleteContactLabel}
                  value={
                    deleteFriendMutation.isPending
                      ? deletingLabel
                      : removeFromContactsLabel
                  }
                  danger
                  onClick={handleDeleteFriendAction}
                  disabled={deleteFriendMutation.isPending}
                  compact={!isDesktopLayout}
                />
              ) : null}
            </ProfileSection>
          </div>
        ) : null}
      </div>

      {!isDesktopLayout && character ? (
        // 走查再 R2：/character/$id 不走 MobileShell 的 safeBottom，AppPage 自己也
        // 没补 safe-area。原来 pb-3=12px 在 iPhone X+ 34pt 的 home indicator 下
        // "发消息 / 音视频通话 / 添加到通讯录"会被横条盖到一半。和
        // chat-message-list / message-quote-selection-sheet 已经在用的写法对齐，
        // pb 走 env(safe-area-inset-bottom)。
        <div className="shrink-0 border-t border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.96)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 backdrop-blur-xl">
          <div
            className={cn(
              "grid gap-2",
              isFriend ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {isFriend ? (
              <>
                <MobileProfileActionButton
                  primary
                  label={
                    startChatMutation.isPending
                      ? openingLabel
                      : sendMessageLabel
                  }
                  disabled={startChatMutation.isPending}
                  onClick={() => {
                    setNotice(null);
                    startChatMutation.mutate();
                  }}
                />
                <MobileProfileActionButton
                  label={
                    openCallMutation.isPending
                      ? connectingLabel
                      : audioVideoCallLabel
                  }
                  disabled={openCallMutation.isPending}
                  onClick={() => {
                    setNotice(null);
                    setMobileSheetAction("call");
                  }}
                />
              </>
            ) : (
              <MobileProfileActionButton
                primary
                label={
                  hasOutboundFriendRequest
                    ? awaitingAcceptanceLabel
                    : hasInboundFriendRequest
                      ? viewFriendRequestLabel
                      : sendFriendRequestDisplayedPending
                        ? sendingLabel
                        : addToContactsLabel
                }
                disabled={
                  hasOutboundFriendRequest ||
                  (sendFriendRequestMutation.isPending &&
                    !hasPendingFriendRequest)
                }
                onClick={() => {
                  setNotice(null);
                  handleAddToContacts();
                }}
              />
            )}
          </div>
        </div>
      ) : null}

      {!isDesktopLayout ? (
        <MobileDetailsActionSheet
          open={mobileSheetConfig !== null}
          title={mobileSheetConfig?.title ?? ""}
          description={mobileSheetConfig?.description}
          onClose={() => setMobileSheetAction(null)}
          actions={
            mobileSheetConfig?.actions.map((action) => ({
              ...action,
              onClick: () => {
                setMobileSheetAction(null);
                action.onClick();
              },
            })) ?? []
          }
        />
      ) : null}
    </AppPage>
  );
}

function MobileCharacterStatusCard({
  badge,
  title,
  description,
  action,
  tone = "default",
}: {
  badge: string;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "danger" | "loading";
}) {
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
          "mx-auto inline-flex rounded-full px-2 py-0.5 text-[8px] font-medium tracking-[0.04em]",
          tone === "danger"
            ? "bg-[rgba(220,38,38,0.08)] text-[color:var(--state-danger-text)]"
            : "bg-[rgba(7,193,96,0.1)] text-[#07c160]",
        )}
      >
        {badge}
      </div>
      {tone === "loading" ? (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-black/15" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-black/25 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8ecf9d] [animation-delay:240ms]" />
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

function MobileCharacterErrorNotice({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <InlineNotice
      tone="danger"
      className="rounded-[11px] border border-[color:var(--border-danger)] bg-[linear-gradient(180deg,rgba(255,245,245,0.96),rgba(254,242,242,0.94))] px-2.5 py-1.5 text-[10px] leading-4 shadow-none"
    >
      {action ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">{children}</div>
          {action}
        </div>
      ) : (
        children
      )}
    </InlineNotice>
  );
}

function MobileProfileActionButton({
  label,
  onClick,
  disabled = false,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-[11px] border px-4 text-[15px] font-medium transition disabled:opacity-45",
        primary
          ? "border-[#07c160] bg-[#07c160] text-white active:bg-[#06ad56]"
          : "border-[color:var(--border-faint)] bg-white text-[color:var(--text-primary)] active:bg-[#f2f3f5]",
      )}
    >
      {label}
    </button>
  );
}

function ProfileSection({
  title,
  children,
  flatOnMobile = false,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  flatOnMobile?: boolean;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden bg-white",
        flatOnMobile
          ? "-mx-3 rounded-none border-y border-[color:var(--border-faint)]"
          : "rounded-[18px] border border-[color:var(--border-faint)]",
      )}
    >
      <div
        className={cn(
          flatOnMobile
            ? compact
              ? "px-4 py-2 text-[11px] text-[color:var(--text-muted)]"
              : "px-4 py-2.5 text-[12px] text-[color:var(--text-muted)]"
            : "px-4 py-3 text-xs uppercase tracking-[0.16em] text-[#8c8c8c]",
        )}
      >
        {title}
      </div>
      <div className="border-t border-[color:var(--border-faint)]">
        {children}
      </div>
    </section>
  );
}

function ProfileRow({
  label,
  value,
  onClick,
  danger = false,
  disabled = false,
  multiline = false,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  compact?: boolean;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-4 text-left transition active:bg-[color:var(--surface-card-hover)] disabled:opacity-60",
          compact ? "px-4 py-3 text-[13px]" : "px-4 py-4 text-sm",
        )}
      >
        <div
          className={cn(
            compact
            ? "min-w-[5.5rem] shrink-0 whitespace-nowrap"
            : "min-w-24 shrink-0 whitespace-nowrap",
            danger ? "text-[#d74b45]" : "text-[color:var(--text-primary)]",
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 text-right",
            multiline
              ? "whitespace-pre-wrap break-words text-[color:var(--text-muted)]"
              : "truncate text-[color:var(--text-muted)]",
            danger ? "text-[#d74b45]" : undefined,
          )}
        >
          {value}
        </div>
        <ChevronRight
          size={compact ? 16 : 18}
          className="shrink-0 text-[#c7c7cc]"
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center gap-4 text-left",
        compact ? "px-4 py-3 text-[13px]" : "px-4 py-4 text-sm",
      )}
    >
      <div
        className={cn(
          compact
            ? "min-w-[5.5rem] shrink-0 whitespace-nowrap"
            : "min-w-24 shrink-0 whitespace-nowrap",
          danger ? "text-[#d74b45]" : "text-[color:var(--text-primary)]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 text-right text-[color:var(--text-muted)]",
          multiline ? "whitespace-pre-wrap break-words" : "truncate",
          danger ? "text-[#d74b45]" : undefined,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ProfileSwitchRow({
  label,
  checked,
  onToggle,
  disabled = false,
  compact = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 text-left transition active:bg-[color:var(--surface-card-hover)] disabled:opacity-60",
        compact ? "min-h-12" : "min-h-14",
      )}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "text-[color:var(--text-primary)]",
          compact ? "text-[14px]" : "text-[16px]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          compact
            ? "relative h-7 w-11 rounded-full transition-colors"
            : "relative h-8 w-13 rounded-full transition-colors",
          checked ? "bg-[#07c160]" : "bg-[#d5d5d5]",
        )}
      >
        <span
          className={cn(
            compact
              ? "absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
              : "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
            checked
              ? compact
                ? "translate-x-4"
                : "translate-x-6"
              : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

function DetailInputField({
  label,
  value,
  placeholder,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <div
        className={cn(
          "mb-2 text-[color:var(--text-muted)]",
          compact ? "text-[11px]" : "text-xs uppercase tracking-[0.12em]",
        )}
      >
        {label}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full border border-[color:var(--border-faint)] bg-white px-3 text-[color:var(--text-primary)] outline-none transition focus:border-[rgba(7,193,96,0.18)] focus:bg-white placeholder:text-[color:var(--text-dim)]",
          compact
            ? "rounded-[11px] py-2.5 text-[13px]"
            : "rounded-[12px] py-3 text-sm",
        )}
      />
    </label>
  );
}

function buildRemarkSummary(
  remarkName?: string | null,
  tags?: string[] | null,
  emptyLabel?: string,
) {
  const segments = [
    remarkName?.trim(),
    tags?.filter(Boolean).join("、"),
  ].filter(Boolean);

  return segments.length ? segments.join(" · ") : (emptyLabel ?? "");
}

function isMissingCharacterError(error: unknown, characterId: string) {
  return (
    error instanceof Error &&
    error.message.trim() === `Character ${characterId} not found`
  );
}
