import { useEffect, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFriends,
  listCharacters,
  updateFriendPermissions,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { InlineNotice, cn } from "@yinjie/ui";
import { AvatarChip } from "../../../components/avatar-chip";
import { useAppRuntimeConfig } from "../../../runtime/runtime-config-store";

type Props = {
  characterId: string;
};

export function ManagementPermissionsDetailScreen({ characterId }: Props) {
  const t = useRuntimeTranslator();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const queryClient = useQueryClient();

  // 新一轮走查：同 contacts-page 共享 cache key，配 staleTime 让权限明细
  // 屏频繁返回时不重复 fetch；permissions mutation 已经显式 invalidate。
  const friendsQuery = useQuery({
    queryKey: ["app-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
    staleTime: 15_000,
  });
  const charactersQuery = useQuery({
    queryKey: ["app-characters", baseUrl],
    queryFn: () => listCharacters(baseUrl),
    staleTime: 30_000,
  });

  const friend = (friendsQuery.data ?? []).find(
    (f) => f.character.id === characterId,
  );
  const character =
    friend?.character ??
    (charactersQuery.data ?? []).find((c) => c.id === characterId);
  const friendship = friend?.friendship;

  const [hideTheir, setHideTheir] = useState(
    Boolean(friendship?.momentsHiddenFromMe),
  );
  const [hideMine, setHideMine] = useState(
    Boolean(friendship?.momentsHiddenFromThem),
  );
  const [chatOnly, setChatOnly] = useState(Boolean(friendship?.chatOnly));

  const mutation = useMutation({
    mutationFn: (payload: {
      momentsHiddenFromMe?: boolean;
      momentsHiddenFromThem?: boolean;
      chatOnly?: boolean;
    }) => updateFriendPermissions(characterId, payload, baseUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["app-friends", baseUrl],
      });
    },
  });

  // mutation.isPending 守护：用户快速切换 2 个开关时，A 完成会触发 invalidate
  // → friendsQuery 重拉，此时服务端只反映 A 不反映 B，旧 friendship.chatOnly
  // 还是 false，sync 会把 B 的乐观状态（true）盖回 false。等 B 完成再 invalidate
  // 一次才回 true，肉眼上看到 B 开关闪了一下。在任何 mutation 在飞时跳过
  // server→local 同步，等用户最后一次操作真正落库后再同步。
  useEffect(() => {
    if (mutation.isPending) {
      return;
    }
    setHideTheir(Boolean(friendship?.momentsHiddenFromMe));
    setHideMine(Boolean(friendship?.momentsHiddenFromThem));
    setChatOnly(Boolean(friendship?.chatOnly));
  }, [
    friendship?.momentsHiddenFromMe,
    friendship?.momentsHiddenFromThem,
    friendship?.chatOnly,
    mutation.isPending,
  ]);

  const apply = (
    next: { hideTheir?: boolean; hideMine?: boolean; chatOnly?: boolean },
  ) => {
    const payload: {
      momentsHiddenFromMe?: boolean;
      momentsHiddenFromThem?: boolean;
      chatOnly?: boolean;
    } = {};
    if (typeof next.hideTheir === "boolean") {
      payload.momentsHiddenFromMe = next.hideTheir;
      setHideTheir(next.hideTheir);
    }
    if (typeof next.hideMine === "boolean") {
      payload.momentsHiddenFromThem = next.hideMine;
      setHideMine(next.hideMine);
    }
    if (typeof next.chatOnly === "boolean") {
      payload.chatOnly = next.chatOnly;
      setChatOnly(next.chatOnly);
    }
    mutation.mutate(payload, {
      onError: () => {
        if (typeof next.hideTheir === "boolean") {
          setHideTheir(!next.hideTheir);
        }
        if (typeof next.hideMine === "boolean") {
          setHideMine(!next.hideMine);
        }
        if (typeof next.chatOnly === "boolean") {
          setChatOnly(!next.chatOnly);
        }
      },
    });
  };

  if (!character) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-[color:var(--text-muted)]">
        {t(msg`正在读取联系人...`)}
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-3 rounded-[12px] bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <AvatarChip name={character.name} src={character.avatar} size="wechat" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-[color:var(--text-primary)]">
            {friendship?.remarkName?.trim() || character.name}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[color:var(--text-muted)]">
            {character.relationship || t(msg`保持联系`)}
          </div>
        </div>
      </div>

      {mutation.isError && mutation.error instanceof Error ? (
        // 之前失败时 switch 自己回滚但没任何提示，用户看着像 toggle 突然弹回，
        // 不知道是网络挂了还是后端拒了。补一条 danger notice，错误消息直接来自
        // mutation.error。
        <InlineNotice
          tone="danger"
          className="mt-3 rounded-[11px] px-2.5 py-1.5 text-[11px] leading-4 shadow-none"
        >
          {mutation.error.message || t(msg`权限修改失败，请稍后再试。`)}
        </InlineNotice>
      ) : null}

      <ul className="mt-3 overflow-hidden rounded-[12px] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <SwitchRow
          label={t(msg`不让TA看我朋友圈`)}
          checked={hideMine}
          onChange={(checked) => apply({ hideMine: checked })}
          first
        />
        <SwitchRow
          label={t(msg`不看TA的朋友圈`)}
          checked={hideTheir}
          onChange={(checked) => apply({ hideTheir: checked })}
        />
        <SwitchRow
          label={t(msg`仅聊天的朋友`)}
          description={t(msg`仅保留聊天，TA 不会出现在朋友圈、动态等场景。`)}
          checked={chatOnly}
          onChange={(checked) => apply({ chatOnly: checked })}
        />
      </ul>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  first = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  first?: boolean;
}) {
  return (
    <li
      className={
        !first ? "border-t border-[color:var(--border-faint)]" : undefined
      }
    >
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] text-[color:var(--text-primary)]">
            {label}
          </div>
          {description ? (
            <div className="mt-0.5 text-[11px] leading-4 text-[color:var(--text-muted)]">
              {description}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors",
            checked ? "bg-[#07c160]" : "bg-[#e0e0e0]",
          )}
        >
          <span
            className={cn(
              "inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-[20px]" : "translate-x-[2px]",
            )}
          />
        </button>
      </label>
    </li>
  );
}
