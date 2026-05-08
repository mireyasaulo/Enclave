import { useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Newspaper,
  Tv,
  User,
  Users,
} from "lucide-react";
import {
  type FavoriteCategory,
  type FavoriteRecord,
  getFavorites,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import {
  AppPage,
  Button,
  ErrorBlock,
  LoadingBlock,
  cn,
} from "@yinjie/ui";
import { AvatarChip } from "../components/avatar-chip";
import { EmptyState } from "../components/empty-state";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { formatTimestamp } from "../lib/format";
import { navigateBackOrFallback } from "../lib/history-back";
import { describeRequestError } from "../lib/request-error";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";

type FilterId = "all" | FavoriteCategory;

function useCategoryFilters(): Array<{ id: FilterId; label: string }> {
  const t = useRuntimeTranslator();
  return [
    { id: "all", label: t(msg`全部`) },
    { id: "messages", label: t(msg`消息`) },
    { id: "notes", label: t(msg`笔记`) },
    { id: "contacts", label: t(msg`联系人`) },
    { id: "officialAccounts", label: t(msg`公众号`) },
    { id: "moments", label: t(msg`朋友圈`) },
    { id: "feed", label: t(msg`广场动态`) },
    { id: "channels", label: t(msg`视频号`) },
  ];
}

function CategoryIcon({ category }: { category: FavoriteCategory }) {
  const iconClass = "h-4 w-4 text-[color:var(--text-secondary)]";
  switch (category) {
    case "messages":
      return <MessageSquare className={iconClass} />;
    case "notes":
      return <FileText className={iconClass} />;
    case "contacts":
      return <User className={iconClass} />;
    case "officialAccounts":
      return <Newspaper className={iconClass} />;
    case "moments":
      return <ImageIcon className={iconClass} />;
    case "feed":
      return <Hash className={iconClass} />;
    case "channels":
      return <Tv className={iconClass} />;
    default:
      return <Users className={iconClass} />;
  }
}

export function ProfileFavoritesPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const filters = useCategoryFilters();
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/tabs/favorites", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  const favoritesQuery = useQuery({
    queryKey: ["app-favorites", baseUrl],
    queryFn: () => getFavorites(baseUrl),
  });

  const filteredFavorites = useMemo<FavoriteRecord[]>(() => {
    const data = favoritesQuery.data ?? [];
    if (activeFilter === "all") return data;
    return data.filter((item) => item.category === activeFilter);
  }, [favoritesQuery.data, activeFilter]);

  const goBack = () =>
    navigateBackOrFallback(() => {
      void navigate({ to: "/tabs/profile" });
    });
  const goToItem = (item: FavoriteRecord) => {
    if (!item.to) return;
    void navigate({ to: item.to });
  };

  return (
    <AppPage
      className="bg-[color:var(--bg-canvas)] px-0 py-0"
      style={{
        paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))",
      }}
    >
      <TabPageTopBar
        title={t(msg`收藏`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            onClick={goBack}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-primary)] shadow-none active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </Button>
        }
      />

      <div className="overflow-x-auto border-b border-[color:var(--border-faint)] bg-white px-4 py-2">
        <div className="flex gap-2 whitespace-nowrap">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] transition-colors",
                activeFilter === filter.id
                  ? "border-[#15803d] bg-[rgba(7,193,96,0.10)] text-[#15803d]"
                  : "border-[color:var(--border-faint)] bg-white text-[color:var(--text-secondary)] active:bg-[color:var(--surface-card-hover)]",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {favoritesQuery.isLoading ? (
          <LoadingBlock label={t(msg`正在加载收藏…`)} />
        ) : favoritesQuery.error ? (
          <ErrorBlock message={describeRequestError(favoritesQuery.error)} />
        ) : filteredFavorites.length === 0 ? (
          <EmptyState
            title={t(msg`还没有收藏任何内容`)}
            description={t(msg`在消息、朋友圈或文章里点击收藏，内容会出现在这里。`)}
          />
        ) : (
          <ul className="divide-y divide-[color:var(--border-faint)] overflow-hidden rounded-[14px] border border-[color:var(--border-faint)] bg-white">
            {filteredFavorites.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goToItem(item)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors active:bg-[color:var(--surface-card-hover)]"
                >
                  {item.avatarSrc || item.avatarName ? (
                    <AvatarChip
                      name={item.avatarName ?? undefined}
                      src={item.avatarSrc ?? undefined}
                      size="sm"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--surface-section)]">
                      <CategoryIcon category={item.category} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[14px] font-medium text-[color:var(--text-primary)]">
                        {item.title}
                      </div>
                      {item.badge ? (
                        <span className="shrink-0 rounded-full bg-[rgba(7,193,96,0.08)] px-1.5 py-0.5 text-[10px] text-[#15803d]">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <div className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-[color:var(--text-secondary)]">
                        {item.description}
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[color:var(--text-muted)]">
                      <span className="truncate">{item.meta}</span>
                      <span className="shrink-0">
                        {formatTimestamp(item.collectedAt)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppPage>
  );
}
