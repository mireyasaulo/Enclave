import { msg } from "@lingui/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBlockedCharacters,
  listCharacters,
  unblockCharacter,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button } from "@yinjie/ui";
import { AvatarChip } from "../../../components/avatar-chip";
import { useAppRuntimeConfig } from "../../../runtime/runtime-config-store";

export function ManagementBlacklistScreen() {
  const t = useRuntimeTranslator();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const queryClient = useQueryClient();

  const blockedQuery = useQuery({
    queryKey: ["app-contacts-blocked", baseUrl],
    queryFn: () => getBlockedCharacters(baseUrl),
  });
  const charactersQuery = useQuery({
    queryKey: ["app-characters", baseUrl],
    queryFn: () => listCharacters(baseUrl),
  });

  const characterMap = new Map(
    (charactersQuery.data ?? []).map((c) => [c.id, c]),
  );

  const unblockMutation = useMutation({
    mutationFn: (characterId: string) =>
      unblockCharacter({ characterId }, baseUrl),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey?.[0] ?? "");
          return (
            k === "app-contacts-blocked" ||
            k === "app-friends" ||
            k === "app-conversations" ||
            k === "app-chat-details-blocked" ||
            k === "app-chat-blocked-characters"
          );
        },
      });
    },
  });

  const isLoading = blockedQuery.isLoading;
  const blocked = blockedQuery.data ?? [];

  if (isLoading) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-[color:var(--text-muted)]">
        {t(msg`正在读取黑名单...`)}
      </div>
    );
  }

  if (!blocked.length) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="mx-auto inline-flex rounded-full bg-[#eef2f6] px-3 py-1 text-[10px] font-medium text-[color:var(--text-muted)]">
          {t(msg`黑名单`)}
        </div>
        <div className="mt-3 text-[14px] font-medium text-[color:var(--text-primary)]">
          {t(msg`黑名单为空`)}
        </div>
        <p className="mx-auto mt-2 max-w-[18rem] text-[11px] leading-5 text-[color:var(--text-muted)]">
          {t(msg`被加入黑名单的联系人会出现在这里。`)}
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <ul className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        {blocked.map((entry, index) => {
          const character = characterMap.get(entry.characterId);
          const name =
            character?.name ?? entry.characterId.slice(0, 8);
          return (
            <li
              key={entry.id}
              className={
                index > 0
                  ? "border-t border-[color:var(--border-faint)]"
                  : undefined
              }
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <AvatarChip
                  name={name}
                  src={character?.avatar}
                  size="wechat"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-[color:var(--text-primary)]">
                    {name}
                  </div>
                  {entry.reason ? (
                    <div className="mt-0.5 truncate text-[11px] text-[color:var(--text-muted)]">
                      {entry.reason}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => unblockMutation.mutate(entry.characterId)}
                  disabled={unblockMutation.isPending}
                  className="h-8 shrink-0 rounded-full border-[color:var(--border-subtle)] bg-white px-3 text-[12px]"
                >
                  {t(msg`移出`)}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
