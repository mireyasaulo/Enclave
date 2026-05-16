import { useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, X } from "lucide-react";
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
  // matchesFriendSearch 默认 haystack 已 toLowerCase，needle 也得是 lowercase
  // 才能匹配上。直接传 trimmedSearch 会让用户输入 "Andrej" 找不到 "Andrej Karpathy"。
  const normalizedSearch = trimmedSearch.toLowerCase();

  // 拆 2 个 useMemo —— 原写法把 createFriendDirectoryItems（包含拼音 Collator
  // 排序，O(n log n)）和 filter+buildContactSections 放在同一个 useMemo 里，依赖
  // normalizedSearch，每个键都会让目录从零重排一次。对齐 contacts-page 的拆分
  // 后，directoryItems 只随 friendsQuery.data 重算；输入框敲字时只跑 O(n) filter。
  const directoryItems = useMemo(
    () => createFriendDirectoryItems(friendsQuery.data ?? []),
    [friendsQuery.data],
  );
  const sections = useMemo(() => {
    const filtered = normalizedSearch
      ? directoryItems.filter((item) =>
          matchesFriendSearch(item, normalizedSearch),
        )
      : directoryItems;
    return buildContactSections(filtered);
  }, [directoryItems, normalizedSearch]);

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
            // text-[16px]: iOS Safari/WKWebView focus 时 <16px 会强制 viewport
            // zoom-in；管理 modal 弹起来就抖。
            className="min-w-0 flex-1 bg-transparent text-[16px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-dim)]"
          />
          {search ? (
            // 对齐 mobile-add-friend 的搜索框：有输入时显示 X 一键清空，避免
            // 用户搜出"无匹配"后只能手动删除每个字符才能继续。
            <button
              type="button"
              onClick={() => setSearch("")}
              className="-mr-1 flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--text-dim)] active:bg-black/5"
              aria-label={t(msg`清空输入`)}
            >
              <X size={13} />
            </button>
          ) : null}
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
