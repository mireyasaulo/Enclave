import { useEffect, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFriends,
  listCharacters,
  updateFriendPermissions,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
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

  const friendsQuery = useQuery({
    queryKey: ["app-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
  });
  const charactersQuery = useQuery({
    queryKey: ["app-characters", baseUrl],
    queryFn: () => listCharacters(baseUrl),
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

  useEffect(() => {
    setHideTheir(Boolean(friendship?.momentsHiddenFromMe));
    setHideMine(Boolean(friendship?.momentsHiddenFromThem));
    setChatOnly(Boolean(friendship?.chatOnly));
  }, [
    friendship?.momentsHiddenFromMe,
    friendship?.momentsHiddenFromThem,
    friendship?.chatOnly,
  ]);

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
