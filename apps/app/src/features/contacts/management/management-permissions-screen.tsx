import { useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { getFriends } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AvatarChip } from "../../../components/avatar-chip";
import { useAppRuntimeConfig } from "../../../runtime/runtime-config-store";
import {
  buildContactSections,
  createFriendDirectoryItems,
  matchesFriendSearch,
} from "../contact-utils";

type Props = {
  onPickFriend: (characterId: string) => void;
};

export function ManagementPermissionsScreen({ onPickFriend }: Props) {
  const t = useRuntimeTranslator();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;

  const friendsQuery = useQuery({
    queryKey: ["app-friends", baseUrl],
    queryFn: () => getFriends(baseUrl),
  });

  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  const sections = useMemo(() => {
    const items = createFriendDirectoryItems(friendsQuery.data ?? []);
    const filtered = trimmedSearch
      ? items.filter((item) => matchesFriendSearch(item, trimmedSearch))
      : items;
    return buildContactSections(filtered);
  }, [friendsQuery.data, trimmedSearch]);

  const isLoading = friendsQuery.isLoading;

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-[1] border-b border-[color:var(--border-faint)] bg-[#f7f7f7] px-3 py-2">
        <label className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-3 text-[13px] text-[color:var(--text-dim)]">
          <Search size={14} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(msg`搜索好友`)}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-dim)]"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-[12px] text-[color:var(--text-muted)]">
          {t(msg`正在读取联系人...`)}
        </div>
      ) : !sections.length ? (
        <div className="px-6 py-10 text-center text-[12px] text-[color:var(--text-muted)]">
          {trimmedSearch
            ? t(msg`没有找到匹配的联系人`)
            : t(msg`通讯录还是空的`)}
        </div>
      ) : (
        <div className="px-3 pb-4 pt-2">
          {sections.map((section) => (
            <div key={section.key} className="mb-3 last:mb-0">
              <div className="px-1 pb-1 text-[10px] font-medium tracking-[0.08em] text-[color:var(--text-muted)]">
                {section.title}
              </div>
              <ul className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                {section.items.map((item, index) => (
                  <li
                    key={item.character.id}
                    className={
                      index > 0
                        ? "border-t border-[color:var(--border-faint)]"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onPickFriend(item.character.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--surface-card-hover)]"
                    >
                      <AvatarChip
                        name={item.character.name}
                        src={item.character.avatar}
                        size="wechat"
                      />
                      <div className="min-w-0 flex-1 truncate text-[14px] text-[color:var(--text-primary)]">
                        {item.displayName}
                      </div>
                      <ChevronRight
                        size={15}
                        className="shrink-0 text-[color:var(--text-muted)]"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
