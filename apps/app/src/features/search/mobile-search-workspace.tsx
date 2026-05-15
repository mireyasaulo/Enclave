import {
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useRuntimeTranslator } from "@yinjie/i18n";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Clock3,
  Megaphone,
  Newspaper,
  Search,
  Sparkles,
  Sprout,
  UsersRound,
} from "lucide-react";
import { InlineNotice, cn } from "@yinjie/ui";
import { SearchResultCard } from "./search-result-card";
import {
  searchCategoryLabelDescriptors,
  useSearchCategoryTitle,
  type SearchCategory,
  type SearchHistoryItem,
  type SearchMatchCounts,
  type SearchResultCategory,
  type SearchResultItem,
  type SearchResultSection,
  type SearchScopeCounts,
} from "./search-types";

type MobileSearchWorkspaceProps = {
  activeCategory: SearchCategory;
  error: string | null;
  groupedResults: SearchResultSection[];
  hasKeyword: boolean;
  history: SearchHistoryItem[];
  loading: boolean;
  matchedCounts: SearchMatchCounts;
  onApplyHistory: (keyword: string) => void;
  onBack: () => void;
  onClearHistory: () => void;
  onClearKeyword: () => void;
  onCommitSearch: (keyword: string) => void;
  onOpenResult: (item: SearchResultItem) => void;
  onRetryLoad: () => void;
  onRemoveHistory: (keyword: string) => void;
  scopeCounts: SearchScopeCounts;
  searchText: string;
  searchingMessages: boolean;
  setActiveCategory: Dispatch<SetStateAction<SearchCategory>>;
  setSearchText: Dispatch<SetStateAction<string>>;
  visibleResults: SearchResultItem[];
};

// 顺序与 allViewCategories 对齐——「全部」视图里展示的分组顺序一致，
// chip / 卡片 / 「查看更多」之间不会出现"卡片说有内容、chip 里看不到"
// 的错位。miniPrograms 当前是 ComingSoonOverlay，不进 quickScopeCards。
const quickScopeCards: Array<{
  key: SearchCategory;
  title: MessageDescriptor;
  description: MessageDescriptor;
  icon: typeof Search;
  iconClassName: string;
}> = [
  {
    key: "messages",
    title: msg`聊天记录`,
    description: msg`搜会话、群聊和历史消息`,
    icon: Search,
    iconClassName: "bg-[rgba(7,193,96,0.12)] text-[#07c160]",
  },
  {
    key: "contacts",
    title: msg`联系人`,
    description: msg`搜好友、备注和世界角色`,
    icon: UsersRound,
    iconClassName: "bg-[rgba(59,130,246,0.12)] text-[#2563eb]",
  },
  {
    key: "officialAccounts",
    title: msg`公众号`,
    description: msg`搜账号资料和文章`,
    icon: Megaphone,
    iconClassName: "bg-[rgba(234,179,8,0.14)] text-[#9a6b12]",
  },
  {
    key: "favorites",
    title: msg`收藏`,
    description: msg`搜笔记、消息和内容收藏`,
    icon: Bookmark,
    iconClassName: "bg-[rgba(234,179,8,0.10)] text-[#9a6b12]",
  },
  {
    key: "moments",
    title: msg`朋友圈`,
    description: msg`搜好友动态、评论和点赞`,
    icon: Sprout,
    iconClassName: "bg-[rgba(34,197,94,0.12)] text-[#15803d]",
  },
  {
    key: "feed",
    title: msg`广场动态`,
    description: msg`搜广场里公开发布的内容`,
    icon: Newspaper,
    iconClassName: "bg-[rgba(15,23,42,0.08)] text-[color:var(--text-primary)]",
  },
];

export function MobileSearchWorkspace({
  activeCategory,
  error,
  groupedResults,
  hasKeyword,
  history,
  loading,
  matchedCounts,
  onApplyHistory,
  onBack,
  onClearHistory,
  onClearKeyword,
  onCommitSearch,
  onOpenResult,
  onRetryLoad,
  onRemoveHistory,
  scopeCounts,
  searchText,
  searchingMessages,
  setActiveCategory,
  setSearchText,
  visibleResults,
}: MobileSearchWorkspaceProps) {
  const t = useRuntimeTranslator();
  const getCategoryTitle = useSearchCategoryTitle();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 「全部」视图里展示的分组顺序：messages/contacts 最常用排前面，
  // officialAccounts/favorites 次之，moments/feed 是社交内容放后面。
  // miniPrograms 当前是 ComingSoonOverlay，不进「全部」；和 chip 一致。
  const allViewCategories: SearchResultCategory[] = [
    "messages",
    "contacts",
    "officialAccounts",
    "favorites",
    "moments",
    "feed",
  ];
  const sectionByCategory = new Map(
    groupedResults.map((section) => [section.category, section]),
  );
  const orderedAllSections: SearchResultSection[] = allViewCategories.flatMap(
    (category) => {
      const section = sectionByCategory.get(category);
      return section && section.results.length ? [section] : [];
    },
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--bg-canvas)]">
      <div className="sticky top-0 z-20 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-2.5 pt-1.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent text-[color:var(--text-primary)] active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </button>

          <form
            className="relative min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              onCommitSearch(searchText);
            }}
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-[14px] -translate-y-1/2 text-[color:var(--text-dim)]"
            />
            <input
              ref={inputRef}
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t(msg`搜索聊天、联系人、公众号、朋友圈和广场`)}
              className="h-9 w-full rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-canvas-elevated)] pl-9 pr-11 text-[13px] text-[color:var(--text-primary)] outline-none transition-[background-color,border-color] placeholder:text-[color:var(--text-dim)] focus:border-[rgba(7,193,96,0.18)] focus:bg-white"
            />
            {searchText ? (
              <button
                type="button"
                onClick={onClearKeyword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[color:var(--text-muted)]"
              >
                {t(msg`清空`)}
              </button>
            ) : null}
          </form>
        </div>

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {searchCategoryLabelDescriptors.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCategory(item.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition",
                activeCategory === item.id
                  ? "bg-[#07c160] text-white"
                  : "border border-[color:var(--border-subtle)] bg-[color:var(--bg-canvas-elevated)] text-[color:var(--text-secondary)]",
              )}
            >
              {t(item.label)}
              {item.id !== "all" && hasKeyword
                ? ` ${matchedCounts[item.id]}`
                : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {loading ? (
          <MobileSearchStatusCard
            badge={t(msg`读取中`)}
            title={t(msg`正在准备搜一搜`)}
            description={t(msg`稍等一下，正在整理最近记录和可搜索范围。`)}
            tone="loading"
          />
        ) : null}
        {error ? (
          <MobileSearchStatusCard
            badge={t(msg`读取失败`)}
            title={t(msg`搜一搜暂时不可用`)}
            description={error}
            tone="danger"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onRetryLoad}
                  className="inline-flex h-8 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px] text-[color:var(--text-primary)]"
                >
                  {t(msg`重试读取`)}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex h-8 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px] text-[color:var(--text-primary)]"
                >
                  {t(msg`返回上一页`)}
                </button>
              </div>
            }
          />
        ) : null}

        {!loading && !error && !hasKeyword ? (
          <div className="space-y-4">
            <section className="overflow-hidden border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[14px] font-medium text-[color:var(--text-primary)]">
                  {t(msg`最近搜索`)}
                </div>
                {history.length ? (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="text-[11px] text-[color:var(--text-muted)]"
                  >
                    {t(msg`清空`)}
                  </button>
                ) : null}
              </div>

              {history.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {history.map((item) => (
                    <div
                      key={item.keyword}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-console)] px-3 py-1.5 text-[11px] text-[color:var(--text-secondary)]"
                    >
                      <button
                        type="button"
                        onClick={() => onApplyHistory(item.keyword)}
                        className="inline-flex items-center gap-1"
                      >
                        <Clock3 size={12} />
                        <span>{item.keyword}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveHistory(item.keyword)}
                        className="text-[10px] text-[color:var(--text-dim)]"
                      >
                        {t(msg`删除`)}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2.5 text-[11px] leading-[1.35rem] text-[color:var(--text-muted)]">
                  {t(msg`还没有搜索记录，输入关键词后会保存在这里。`)}
                </div>
              )}
            </section>

            <section className="overflow-hidden border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
              {quickScopeCards.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setActiveCategory(item.key as SearchCategory)
                    }
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                      "transition-colors hover:bg-[color:var(--surface-card-hover)]",
                      item.key !== quickScopeCards[0]!.key
                        ? "border-t border-[color:var(--border-faint)]"
                        : undefined,
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]",
                        item.iconClassName,
                      )}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-[color:var(--text-primary)]">
                        {t(item.title)}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-[1.125rem] text-[color:var(--text-muted)]">
                        {t(item.description)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </section>

            <section className="overflow-hidden border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-[14px] font-medium text-[color:var(--text-primary)]">
                <Sparkles size={15} className="text-[#15803d]" />
                <span>{t(msg`当前可搜索范围`)}</span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-[11px] text-[color:var(--text-secondary)]">
                <ScopeStat
                  label={t(msg`会话`)}
                  value={`${scopeCounts.conversations}`}
                />
                <ScopeStat label={t(msg`联系人`)} value={`${scopeCounts.contacts}`} />
                <ScopeStat label={t(msg`收藏`)} value={`${scopeCounts.favorites}`} />
                <ScopeStat
                  label={t(msg`公众号`)}
                  value={`${scopeCounts.officialAccounts}`}
                />
                <ScopeStat
                  label={t(msg`小程序`)}
                  value={`${scopeCounts.miniPrograms}`}
                />
                <ScopeStat label={t(msg`朋友圈`)} value={`${scopeCounts.moments}`} />
                <ScopeStat label={t(msg`广场动态`)} value={`${scopeCounts.feed}`} />
              </div>
            </section>
          </div>
        ) : null}

        {!loading && !error && hasKeyword && searchingMessages ? (
          <InlineNotice
            className="rounded-[11px] px-2.5 py-1.5 text-[11px] leading-[1.35rem] shadow-none"
            tone="info"
          >
            {t(msg`正在补全全局聊天记录索引，消息结果会继续增加。`)}
          </InlineNotice>
        ) : null}

        {/* 「无结果」卡片只在「确实没东西可看」时出：
            - 消息索引还在补全时（searchingMessages）继续展示下面的局部结果 +
              上面的补全 banner，避免用户先看到「没有找到相关内容」、过两秒
              消息又冒出来的反复；只对受消息索引影响的分类（全部 / 聊天记录）
              做这层等待。
            - miniPrograms 整个分类自带 ComingSoonOverlay 表达「功能开发中」，
              再叠一条「没有找到相关内容」会让用户分不清是"真没有"还是
              "本来就还做不出来"——直接 suppress，让 overlay 自己说。 */}
        {!loading && !error && hasKeyword && !visibleResults.length &&
        activeCategory !== "miniPrograms" && !(
          searchingMessages && (activeCategory === "all" || activeCategory === "messages")
        ) ? (
          <div className="pt-3">
            <MobileSearchStatusCard
              badge={t(msg`无结果`)}
              title={t(msg`没有找到相关内容`)}
              description={t(msg`换个关键词，或者切到别的分类试试。`)}
            />
          </div>
        ) : null}

        {!loading && !error && hasKeyword ? (
          activeCategory === "all" ? (
            <div className="space-y-4">
              {orderedAllSections.map((section) => {
                const visible = section.results.slice(0, 3);
                const hasMore = section.results.length > 3;

                return (
                  <section key={section.category} className="space-y-2">
                    <div className="text-[12px] font-medium text-[color:var(--text-muted)]">
                      {getCategoryTitle(section.category)}
                    </div>
                    <div className="space-y-1">
                      {visible.map((item) => (
                        <SearchResultCard
                          key={item.id}
                          item={item}
                          keyword={searchText.trim().toLowerCase()}
                          layout="mobile"
                          onOpen={onOpenResult}
                        />
                      ))}
                      {hasMore ? (
                        <button
                          type="button"
                          onClick={() => setActiveCategory(section.category)}
                          className="flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-[12px] text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]"
                        >
                          <span>
                            {t(msg`查看更多 ${section.results.length} 条 ${getCategoryTitle(section.category)}`)}
                          </span>
                          <ChevronRight size={13} className="shrink-0" />
                        </button>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : visibleResults.length || activeCategory === "miniPrograms" ? (
            // 非「全部」分类、0 命中时不再渲染「{分类} · 0 条」空表头：
            // 上面的「无结果」卡片已经把"没找到"说清楚了，再叠一行 0 条只会
            // 让信息密度变重。miniPrograms 是例外——chip 命中就要让
            // ComingSoonOverlay 出来，告知"功能开发中"，比"无结果"更准确。
            <div className="space-y-2.5">
              <div className="text-[14px] font-medium text-[color:var(--text-primary)]">
                {getCategoryTitle(activeCategory)} · {visibleResults.length}{" "}
                {t(msg`条`)}
              </div>
              {/* miniPrograms 命中 0 时下面 visibleResults 是空数组，relative
                  容器没高度，absolute inset-0 的 overlay 退化到 0×0 浮在角落
                  上——给一个 min-height 让 overlay 有地方撑开居中。其它分类
                  正常走 result 行的高度，不需要 min-height。 */}
              <div
                className={cn(
                  "relative space-y-1.5",
                  activeCategory === "miniPrograms" && !visibleResults.length
                    ? "min-h-[180px]"
                    : undefined,
                )}
              >
                {visibleResults.map((item) => (
                  <SearchResultCard
                    key={item.id}
                    item={item}
                    keyword={searchText.trim().toLowerCase()}
                    layout="mobile"
                    onOpen={onOpenResult}
                  />
                ))}
                {activeCategory === "miniPrograms" ? (
                  <MobileSearchComingSoonOverlay />
                ) : null}
              </div>
            </div>
          ) : null
        ) : null}
      </div>
    </div>
  );
}

function MobileSearchStatusCard({
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

function MobileSearchComingSoonOverlay() {
  const t = useRuntimeTranslator();
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center rounded-[14px] bg-black/30 backdrop-blur-[3px]">
      <div className="rounded-[14px] border border-[color:var(--border-faint)] bg-white/95 px-4 py-3 text-center shadow-[var(--shadow-card)]">
        <div className="text-[13px] font-semibold text-[color:var(--text-primary)]">
          {t(msg`功能开发中`)}
        </div>
        <div className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
          {t(msg`敬请期待`)}
        </div>
      </div>
    </div>
  );
}

function ScopeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] px-3 py-2.5">
      <div>{label}</div>
      <div className="mt-1 text-[13px] font-medium text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
