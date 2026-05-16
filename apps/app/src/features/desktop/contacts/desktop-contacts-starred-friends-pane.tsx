import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { Search, Star } from "lucide-react";
import type { FriendListItem } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { ErrorBlock, LoadingBlock, cn } from "@yinjie/ui";
import { AvatarChip } from "../../../components/avatar-chip";
import { EmptyState } from "../../../components/empty-state";
import { ContactDetailPane } from "../../contacts/contact-detail-pane";
import { DesktopContactPaneEmptyState } from "../../contacts/desktop-contact-profile-blocks";
import {
  getFriendDisplayName,
  matchesFriendSearch,
} from "../../contacts/contact-utils";

type DesktopContactsStarredFriendsPaneProps = {
  friends: FriendListItem[];
  selectedCharacterId: string | null;
  loading: boolean;
  error?: string | null;
  actionError?: string | null;
  startChatPendingId?: string | null;
  starPendingId?: string | null;
  commonGroupsByCharacterId?: Record<
    string,
    Array<{ id: string; name: string }>
  >;
  isPinnedByCharacterId?: Record<string, boolean>;
  isMutedByCharacterId?: Record<string, boolean>;
  blockedCharacterIds?: ReadonlySet<string>;
  pinPendingCharacterId?: string | null;
  mutePendingCharacterId?: string | null;
  blockPendingCharacterId?: string | null;
  deletePendingCharacterId?: string | null;
  onSelectCharacter: (characterId: string | null) => void;
  onStartChat: (characterId: string) => void;
  onToggleStarred: (characterId: string, starred: boolean) => void;
  onOpenProfile: (characterId: string) => void;
  onOpenMoments: (characterId: string) => void;
  onOpenGroup?: (groupId: string) => void;
  onTogglePinned?: (characterId: string, pinned: boolean) => void;
  onToggleMuted?: (characterId: string, muted: boolean) => void;
  onToggleBlock?: (characterId: string, blocked: boolean) => void;
  onDeleteFriend?: (characterId: string) => void;
};

export function DesktopContactsStarredFriendsPane({
  friends,
  selectedCharacterId,
  loading,
  error = null,
  actionError = null,
  startChatPendingId = null,
  starPendingId = null,
  commonGroupsByCharacterId,
  isPinnedByCharacterId,
  isMutedByCharacterId,
  blockedCharacterIds,
  pinPendingCharacterId = null,
  mutePendingCharacterId = null,
  blockPendingCharacterId = null,
  deletePendingCharacterId = null,
  onSelectCharacter,
  onStartChat,
  onToggleStarred,
  onOpenProfile,
  onOpenMoments,
  onOpenGroup,
  onTogglePinned,
  onToggleMuted,
  onToggleBlock,
  onDeleteFriend,
}: DesktopContactsStarredFriendsPaneProps) {
  const t = useRuntimeTranslator();
  const [searchText, setSearchText] = useState("");
  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredFriends = useMemo(() => {
    if (!normalizedSearchText) {
      return friends;
    }

    return friends.filter((item) =>
      matchesFriendSearch(item, normalizedSearchText),
    );
  }, [friends, normalizedSearchText]);
  const selectedFriend =
    filteredFriends.find((item) => item.character.id === selectedCharacterId) ??
    friends.find((item) => item.character.id === selectedCharacterId) ??
    null;

  useEffect(() => {
    if (
      selectedCharacterId &&
      filteredFriends.some((item) => item.character.id === selectedCharacterId)
    ) {
      return;
    }

    // 搜了个匹配 0 条的关键词时，selectedCharacterId 会被切到 null；下一轮 render
    // 仍然不满足上面的 early-return（selectedCharacterId 已经 null），如果直接再次
    // onSelectCharacter(null)，父组件每次 setDesktopSelection 都是新对象引用，会
    // 触发新的渲染、新的 onSelectCharacter 闭包 → 这个 effect 反复 fire，浏览器
    // 报「Maximum update depth exceeded」。这里显式比较 nextId 与当前值，相等就
    // 不再回写，把循环掐断。
    const nextId = filteredFriends[0]?.character.id ?? null;
    if (nextId === selectedCharacterId) {
      return;
    }
    onSelectCharacter(nextId);
  }, [filteredFriends, onSelectCharacter, selectedCharacterId]);

  return (
    <div className="flex h-full min-h-0">
      <section className="flex w-[320px] shrink-0 flex-col border-r border-[color:var(--border-faint)] bg-[rgba(247,250,250,0.88)]">
        <div className="border-b border-[color:var(--border-faint)] bg-white/78 px-4 py-4 backdrop-blur-xl">
          <div className="text-base font-medium text-[color:var(--text-primary)]">
            {t(msg`星标朋友`)}
          </div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            {t(msg`${friends.length} 位星标朋友`)}
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-[16px] border border-[color:var(--border-faint)] bg-white px-3 py-2.5 text-sm text-[color:var(--text-dim)] shadow-none">
            <Search size={15} className="shrink-0" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t(msg`搜索星标朋友`)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-dim)]"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[rgba(242,246,245,0.76)] pb-4">
          {actionError ? (
            <div className="px-3 pt-3">
              <ErrorBlock message={actionError} />
            </div>
          ) : null}

          {loading ? (
            <LoadingBlock
              className="px-4 py-6 text-left"
              label={t(msg`正在读取星标朋友...`)}
            />
          ) : error ? (
            <div className="px-3 pt-3">
              <ErrorBlock message={error} />
            </div>
          ) : !filteredFriends.length ? (
            <div className="px-3 pt-3">
              <EmptyState
                title={
                  normalizedSearchText
                    ? t(msg`没有找到匹配的星标朋友`)
                    : t(msg`还没有星标朋友`)
                }
                description={
                  normalizedSearchText
                    ? t(msg`换个关键词再试试。`)
                    : t(msg`去联系人资料页把常联系的好友设为星标朋友。`)
                }
              />
            </div>
          ) : (
            <section className="mx-3 mt-3 overflow-hidden rounded-[18px] border border-[color:var(--border-faint)] bg-white shadow-[var(--shadow-section)]">
              {filteredFriends.map((item, index) => (
                <button
                  key={item.character.id}
                  type="button"
                  onClick={() => onSelectCharacter(item.character.id)}
                  onDoubleClick={() => onStartChat(item.character.id)}
                  className={cn(
                    "flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left transition-colors hover:bg-[color:var(--surface-console)]",
                    index > 0
                      ? "border-t border-[color:var(--border-faint)]"
                      : undefined,
                    selectedCharacterId === item.character.id
                      ? "bg-[rgba(7,193,96,0.07)] shadow-[inset_3px_0_0_0_var(--brand-primary)]"
                      : undefined,
                  )}
                >
                  <AvatarChip
                    name={getFriendDisplayName(item)}
                    src={item.character.avatar}
                    size="wechat"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] text-[color:var(--text-primary)]">
                      {getFriendDisplayName(item)}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">
                      {startChatPendingId === item.character.id
                        ? t(msg`正在打开会话...`)
                        : getFriendDisplayName(item) !== item.character.name
                          ? t(msg`昵称：${item.character.name}`)
                          : item.character.currentStatus?.trim() ||
                            item.character.relationship ||
                            t(msg`保持联系`)}
                    </div>
                  </div>
                  <Star
                    size={16}
                    className="shrink-0 text-[#d4a72c]"
                    fill="currentColor"
                  />
                </button>
              ))}
            </section>
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1">
        <ContactDetailPane
          character={selectedFriend?.character ?? null}
          friendship={selectedFriend?.friendship ?? null}
          // 0 位星标朋友 / 关键词搜不到时，默认空态会显示"从左侧通讯录选择好友"，
          // 但用户此刻就在星标 sub-pane 里，左侧 sub-list 里就是空的——指错地方了。
          // 给一个跟当前 pane 对齐的提示。
          emptyState={
            <DesktopContactPaneEmptyState
              title={
                friends.length === 0
                  ? t(msg`还没有星标朋友`)
                  : t(msg`选一位星标朋友`)
              }
              description={
                friends.length === 0
                  ? t(msg`去联系人资料页把常联系的好友设为星标朋友，TA 们会出现在这里。`)
                  : t(msg`从中间星标列表里选一位，这里会显示资料和管理操作。`)
              }
            />
          }
          commonGroups={
            selectedFriend
              ? (commonGroupsByCharacterId?.[selectedFriend.character.id] ?? [])
              : []
          }
          onOpenGroup={onOpenGroup}
          onStartChat={
            selectedFriend
              ? () => onStartChat(selectedFriend.character.id)
              : undefined
          }
          chatPending={startChatPendingId === selectedFriend?.character.id}
          isStarred={selectedFriend?.friendship.isStarred ?? false}
          starPending={starPendingId === selectedFriend?.character.id}
          onToggleStarred={
            selectedFriend
              ? () =>
                  onToggleStarred(
                    selectedFriend.character.id,
                    !selectedFriend.friendship.isStarred,
                  )
              : undefined
          }
          isPinned={
            selectedFriend
              ? Boolean(isPinnedByCharacterId?.[selectedFriend.character.id])
              : false
          }
          pinPending={pinPendingCharacterId === selectedFriend?.character.id}
          onTogglePinned={
            selectedFriend && onTogglePinned
              ? () =>
                  onTogglePinned(
                    selectedFriend.character.id,
                    !Boolean(
                      isPinnedByCharacterId?.[selectedFriend.character.id],
                    ),
                  )
              : undefined
          }
          isMuted={
            selectedFriend
              ? Boolean(isMutedByCharacterId?.[selectedFriend.character.id])
              : false
          }
          mutePending={mutePendingCharacterId === selectedFriend?.character.id}
          onToggleMuted={
            selectedFriend && onToggleMuted
              ? () =>
                  onToggleMuted(
                    selectedFriend.character.id,
                    !Boolean(
                      isMutedByCharacterId?.[selectedFriend.character.id],
                    ),
                  )
              : undefined
          }
          isBlocked={
            selectedFriend
              ? Boolean(blockedCharacterIds?.has(selectedFriend.character.id))
              : false
          }
          blockPending={blockPendingCharacterId === selectedFriend?.character.id}
          onToggleBlock={
            selectedFriend && onToggleBlock
              ? () =>
                  onToggleBlock(
                    selectedFriend.character.id,
                    Boolean(
                      blockedCharacterIds?.has(selectedFriend.character.id),
                    ),
                  )
              : undefined
          }
          deletePending={
            deletePendingCharacterId === selectedFriend?.character.id
          }
          onDeleteFriend={
            selectedFriend && onDeleteFriend
              ? () => onDeleteFriend(selectedFriend.character.id)
              : undefined
          }
          onOpenProfile={() => {
            if (!selectedFriend) {
              return;
            }

            onOpenProfile(selectedFriend.character.id);
          }}
          onOpenMoments={
            selectedFriend
              ? () => {
                  onOpenMoments(selectedFriend.character.id);
                }
              : undefined
          }
        />
      </section>
    </div>
  );
}
