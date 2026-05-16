import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  SELF_CHARACTER_ID,
  forwardFeedPostToChat,
  getFriends,
  type FriendListItem,
} from "@yinjie/contracts";
import { Button } from "@yinjie/ui";
import { AvatarChip } from "./avatar-chip";

const t = translateRuntimeMessage;

type ChannelsForwardPickerProps = {
  open: boolean;
  postId: string | null;
  postExcerpt?: string;
  baseUrl?: string;
  onClose: () => void;
  /** 通知 channels-page 刷 toast + bump shareCount。 */
  onForwarded?: (target: { characterId: string; name: string }) => void;
  /**
   * 转发失败兜底回调：用户点完好友马上点 取消/backdrop 关 picker，picker 内
   * 的 errorMessage 已经不渲染了；让 channels-page 知道这次失败，在 page 级
   * 显示一行 notice，避免静默吞错。
   */
  onForwardFailed?: (input: {
    targetCharacterId: string;
    targetName: string;
    message: string;
  }) => void;
};

/**
 * 视频号"转发到聊天"好友选择器 —— 移动端 & 桌面端复用同一组件。
 *
 * 行为：
 *  - 拉 owner 的好友列表（角色），按 lastInteractedAt 倒序展示
 *  - 选中一个角色 → POST /feed/:postId/forward-to-chat
 *  - 成功后 onForwarded 回调 → 父级 toast
 */
export function ChannelsForwardPicker({
  open,
  postId,
  postExcerpt,
  baseUrl,
  onClose,
  onForwarded,
  onForwardFailed,
}: ChannelsForwardPickerProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 走查 R3（本轮）：handlePick await mutateAsync 期间，用户可能已经手动关 picker、
  // 再为另一条 post 重开 picker（postId 切到 B）。此时 A 的 mutation 完成 →
  // 进入 try 分支的 onClose() → 把刚开的 B 的 picker 也一起关掉，用户莫名其妙
  // 「我刚开的 picker 自己关了」。用 ref 现读最新 postId，对照 handlePick 开始
  // 时 capture 的 initialPostId，只在还停在同一条 post 时才主动关闭。
  const latestPostIdRef = useRef(postId);
  latestPostIdRef.current = postId;

  // Reset error when opened/closed
  useEffect(() => {
    if (!open) setErrorMessage(null);
  }, [open]);

  // 弹窗打开时再拉好友列表，避免无关页面也跑这个 query
  const friendsQuery = useQuery({
    queryKey: ["channels-forward-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
    enabled: open,
    staleTime: 30_000,
  });

  const forwardMutation = useMutation({
    mutationFn: async (input: { targetCharacterId: string }) => {
      if (!postId) throw new Error("postId required"); // i18n-ignore-line
      return await forwardFeedPostToChat(
        postId,
        { targetCharacterId: input.targetCharacterId },
        baseUrl,
      );
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 锁背景滚动：picker 弹出时如果不锁，移动端两指滚 / 桌面滚轮会把底下的
  // 视频号 home 也滚走，picker 自身却 fixed 不动，看着像两层在打架。
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const friendList: FriendListItem[] = useMemo(() => {
    const rows = friendsQuery.data ?? [];
    return [...rows]
      // 「我自己」是用户的代理角色，转发视频号到「与自己的私聊」语义上没意义，
      // 而且会污染该 conversation。按 SELF_CHARACTER_ID 过掉。
      .filter((row) => row.character.id !== SELF_CHARACTER_ID)
      .sort((a, b) => {
        const aAt = a.friendship.lastInteractedAt ?? a.friendship.createdAt;
        const bAt = b.friendship.lastInteractedAt ?? b.friendship.createdAt;
        return new Date(bAt).getTime() - new Date(aAt).getTime();
      });
  }, [friendsQuery.data]);

  async function handlePick(target: FriendListItem) {
    setErrorMessage(null);
    // 走查 R3（本轮）：抓住开始 forward 这一刻的 postId，await 期间用户可能
    // 关 picker / 重开为其他 post（latestPostIdRef 反映 props 实时值）。
    const initialPostId = postId;
    try {
      await forwardMutation.mutateAsync({
        targetCharacterId: target.character.id,
      });
      onForwarded?.({
        characterId: target.character.id,
        name: target.character.name,
      });
      // 只在 picker 仍然停在同一条 post 时主动关闭——用户已经切换到别的 post
      // 时 onClose 等于强关人家刚开的新 picker。
      if (latestPostIdRef.current === initialPostId) {
        onClose();
      }
    } catch (error) {
      const code =
        (error as { code?: string; message?: string })?.code ??
        (error as { message?: string })?.message ??
        "";
      let translatedMessage: string;
      if (code === "FEED_FORWARD_MEDIA_BROKEN") {
        translatedMessage = t(msg`这条视频号还没有可播放的视频/音频，无法转发。`);
      } else if (code === "FEED_FORWARD_NOT_CHANNELS") {
        translatedMessage = t(msg`只支持转发视频号帖子。`);
      } else if (code === "FEED_POST_NOT_PUBLISHED") {
        translatedMessage = t(msg`帖子尚未发布，稍后再试。`);
      } else {
        translatedMessage = t(msg`转发失败，请稍后重试。`);
      }
      setErrorMessage(translatedMessage);
      // 走查 R9：picker 可能已经被用户手动关了（onClose 不挡 mutation pending），
      // 这种情况下 errorMessage 不会被渲染。让 channels-page 兜底 page 级 notice。
      onForwardFailed?.({
        targetCharacterId: target.character.id,
        targetName: target.character.name,
        message: translatedMessage,
      });
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[rgba(17,24,39,0.42)] backdrop-blur-[3px] sm:items-center">
      <button
        type="button"
        aria-label={t(msg`关闭转发面板`)}
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative max-h-[80vh] w-full max-w-[420px] overflow-hidden rounded-t-[20px] border border-[color:var(--border-faint)] bg-white shadow-[var(--shadow-overlay)] sm:rounded-[20px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <div>
            <div className="text-[16px] font-medium text-[color:var(--text-primary)]">
              {t(msg`转发到聊天`)}
            </div>
            {postExcerpt ? (
              <div className="mt-1 line-clamp-1 text-[12px] text-[color:var(--text-muted)]">
                {postExcerpt}
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-full text-[color:var(--text-muted)]"
          >
            {t(msg`取消`)}
          </Button>
        </div>

        {errorMessage ? (
          <div className="mx-5 mb-2 rounded-[12px] border border-[color:var(--border-danger,#FCA5A5)] bg-[color:var(--surface-danger,#FEF2F2)] px-3 py-2 text-[12px] text-[color:var(--text-danger,#B91C1C)]">
            {errorMessage}
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto px-2 pb-4">
          {friendsQuery.isLoading ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--text-muted)]">
              {t(msg`正在加载好友列表…`)}
            </div>
          ) : friendsQuery.isError ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--text-muted)]">
              {t(msg`好友列表暂时拉不下来，请稍后重试。`)}
            </div>
          ) : friendList.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--text-muted)]">
              {t(msg`还没有可转发的好友。`)}
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--border-faint)]">
              {friendList.map((friend) => {
                const character = friend.character;
                const isBusy = forwardMutation.isPending;
                return (
                  <li key={character.id}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        void handlePick(friend);
                      }}
                      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color:var(--surface-subtle,#F4F4F5)] disabled:opacity-60"
                    >
                      <AvatarChip
                        name={character.name}
                        src={character.avatar ?? undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[color:var(--text-primary)]">
                          {character.name}
                        </div>
                        <div className="truncate text-[12px] text-[color:var(--text-muted)]">
                          {character.relationship ?? ""}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
