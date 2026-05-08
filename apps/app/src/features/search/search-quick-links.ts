import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { msg } from "@lingui/macro";
import { getFavorites, type FavoriteRecord } from "@yinjie/contracts";
import { getActiveLocale, useRuntimeTranslator } from "@yinjie/i18n";
import { formatTimestamp, parseTimestamp } from "../../lib/format";

type Translator = ReturnType<typeof useRuntimeTranslator>;
import { useAppRuntimeConfig } from "../../runtime/runtime-config-store";
import {
  hydrateDesktopFavoritesFromNative,
  mergeDesktopFavoriteRecords,
  readDesktopFavorites,
} from "../favorites/favorites-storage";
import {
  getMiniProgramEntry,
  miniProgramEntries,
  type MiniProgramEntry,
} from "../mini-programs/mini-programs-data";
import { useMiniProgramsState } from "../mini-programs/use-mini-programs-state";
import { type SearchResultItem } from "./search-types";

export type SearchQuickLink = {
  id: string;
  title: string;
  description: string;
  meta: string;
  badge: string;
  to: string;
  hash?: string;
  search?: string;
  avatarName?: string;
  avatarSrc?: string;
};

type MiniProgramSearchStateSnapshot = {
  recentMiniProgramIds: string[];
  pinnedMiniProgramIds: string[];
  launchCountById: Record<string, number>;
  lastOpenedAtById: Record<string, string>;
};

function resolveFavoriteCategoryLabel(
  t: Translator,
  category: FavoriteRecord["category"],
) {
  switch (category) {
    case "messages":
      return t(msg`收藏消息`);
    case "notes":
      return t(msg`笔记`);
    case "contacts":
      return t(msg`收藏联系人`);
    case "officialAccounts":
      return t(msg`收藏公众号`);
    case "moments":
      return t(msg`收藏朋友圈`);
    case "feed":
      return t(msg`收藏广场动态`);
    case "channels":
      return t(msg`收藏视频号`);
    default:
      return "";
  }
}

export function useSearchQuickLinks(
  keyword: string,
  isDesktopLayout = true,
) {
  const t = useRuntimeTranslator();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const isNativeDesktop = runtimeConfig.appPlatform === "desktop";
  const [localFavorites, setLocalFavorites] = useState(() =>
    readDesktopFavorites(),
  );
  const miniProgramsState = useMiniProgramsState();
  const normalizedKeyword = keyword.trim().toLowerCase();
  const miniProgramSearchState = useMemo<MiniProgramSearchStateSnapshot>(
    () => ({
      recentMiniProgramIds: miniProgramsState.recentMiniProgramIds,
      pinnedMiniProgramIds: miniProgramsState.pinnedMiniProgramIds,
      launchCountById: miniProgramsState.launchCountById,
      lastOpenedAtById: miniProgramsState.lastOpenedAtById,
    }),
    [
      miniProgramsState.lastOpenedAtById,
      miniProgramsState.launchCountById,
      miniProgramsState.pinnedMiniProgramIds,
      miniProgramsState.recentMiniProgramIds,
    ],
  );

  const favoritesQuery = useQuery({
    queryKey: ["app-favorites", baseUrl],
    queryFn: () => getFavorites(baseUrl),
  });

  useEffect(() => {
    if (!isNativeDesktop) {
      setLocalFavorites(readDesktopFavorites());
      return;
    }

    let cancelled = false;

    const syncFavorites = async () => {
      const favorites = await hydrateDesktopFavoritesFromNative();
      if (cancelled) {
        return;
      }

      setLocalFavorites((current) =>
        JSON.stringify(current) === JSON.stringify(favorites)
          ? current
          : favorites,
      );
    };

    const handleFocus = () => {
      void syncFavorites();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void syncFavorites();
    };

    void syncFavorites();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isNativeDesktop]);

  const mergedFavorites = useMemo(
    () =>
      mergeDesktopFavoriteRecords(favoritesQuery.data ?? [], localFavorites),
    [favoritesQuery.data, localFavorites],
  );
  const favoriteSearchResults = useMemo(
    () => mergedFavorites.map((item) => buildFavoriteSearchResult(t, item)),
    [mergedFavorites, t],
  );

  const recentFavorites = useMemo(
    () => mergedFavorites.slice(0, 4).map((item) => buildFavoriteQuickLink(t, item)),
    [mergedFavorites, t],
  );

  const favoriteMatches = useMemo(() => {
    if (!normalizedKeyword) {
      return [] as SearchQuickLink[];
    }

    return mergedFavorites
      .filter((item) => matchesFavoriteKeyword(t, item, normalizedKeyword))
      .slice(0, 4)
      .map((item) => buildFavoriteQuickLink(t, item));
  }, [mergedFavorites, normalizedKeyword, t]);
  const miniProgramSearchResults = useMemo(
    () =>
      miniProgramEntries.map((item) =>
        buildMiniProgramSearchResult(
          t,
          item,
          miniProgramSearchState,
          isDesktopLayout,
        ),
      ),
    [isDesktopLayout, miniProgramSearchState, t],
  );

  const recentMiniPrograms = useMemo(() => {
    const seen = new Set<string>();
    const candidateIds = [
      ...miniProgramSearchState.recentMiniProgramIds,
      ...miniProgramSearchState.pinnedMiniProgramIds,
    ];

    return candidateIds
      .filter((id) => {
        if (seen.has(id)) {
          return false;
        }

        seen.add(id);
        return Boolean(getMiniProgramEntry(id));
      })
      .slice(0, 4)
      .flatMap((id) => {
        const entry = getMiniProgramEntry(id);
        return entry
          ? [
              buildMiniProgramQuickLink(
                t,
                entry,
                miniProgramSearchState,
                isDesktopLayout,
              ),
            ]
          : [];
      });
  }, [isDesktopLayout, miniProgramSearchState, t]);

  const miniProgramMatches = useMemo(() => {
    if (!normalizedKeyword) {
      return [] as SearchQuickLink[];
    }

    return miniProgramEntries
      .filter((item) => matchesMiniProgramKeyword(item, normalizedKeyword))
      .sort((left, right) => {
        const rightScore = getMiniProgramMatchScore(
          right,
          miniProgramSearchState,
        );
        const leftScore = getMiniProgramMatchScore(
          left,
          miniProgramSearchState,
        );
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }

        return left.name.localeCompare(right.name, getActiveLocale());
      })
      .slice(0, 4)
      .map((item) =>
        buildMiniProgramQuickLink(t, item, miniProgramSearchState, isDesktopLayout),
      );
  }, [isDesktopLayout, miniProgramSearchState, normalizedKeyword, t]);

  return {
    favoriteMatches,
    favoriteSearchResults,
    favoritesError:
      favoritesQuery.error instanceof Error
        ? favoritesQuery.error.message
        : null,
    favoritesLoading: favoritesQuery.isLoading,
    mergedFavorites,
    miniProgramMatches,
    miniProgramSearchResults,
    recentFavorites,
    recentMiniPrograms,
  };
}

function buildFavoriteQuickLink(t: Translator, favorite: FavoriteRecord): SearchQuickLink {
  const categoryLabel = resolveFavoriteCategoryLabel(t, favorite.category);
  return {
    id: `favorite-${favorite.sourceId}`,
    title: favorite.title,
    description: favorite.description || t(msg`打开这条收藏内容。`),
    meta:
      favorite.meta.trim() ||
      `${categoryLabel} · ${formatTimestamp(favorite.collectedAt)}`,
    badge: categoryLabel,
    to: favorite.to,
    avatarName: favorite.avatarName ?? favorite.title,
    avatarSrc: favorite.avatarSrc,
  };
}

function buildFavoriteSearchResult(t: Translator, favorite: FavoriteRecord): SearchResultItem {
  const collectedAtLabel = formatTimestamp(favorite.collectedAt);
  const favoriteLabel = resolveFavoriteCategoryLabel(t, favorite.category);
  const favoritePrefix = t(msg`收藏`);

  return {
    id: `favorite-result-${favorite.sourceId}`,
    category: "favorites",
    title: favorite.title,
    description: favorite.description || t(msg`打开这条收藏内容。`),
    meta: favorite.meta.trim()
      ? `${favoritePrefix} · ${favorite.meta}`
      : `${favoritePrefix} · ${collectedAtLabel}`,
    keywords: [
      favorite.title,
      favorite.description,
      favorite.meta,
      favorite.badge,
      favoriteLabel,
      collectedAtLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    to: favorite.to,
    badge: favorite.badge.trim() || favoriteLabel,
    avatarName: favorite.avatarName ?? favorite.title,
    avatarSrc: favorite.avatarSrc,
    sortTime: parseTimestamp(favorite.collectedAt) ?? 0,
  };
}

function matchesFavoriteKeyword(t: Translator, favorite: FavoriteRecord, keyword: string) {
  return [
    favorite.title,
    favorite.description,
    favorite.meta,
    favorite.badge,
    resolveFavoriteCategoryLabel(t, favorite.category),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(keyword);
}

function buildMiniProgramQuickLink(
  t: Translator,
  miniProgram: MiniProgramEntry,
  state: MiniProgramSearchStateSnapshot,
  isDesktopLayout: boolean,
): SearchQuickLink {
  const launchCount = state.launchCountById[miniProgram.id] ?? 0;
  const lastOpenedAt = state.lastOpenedAtById[miniProgram.id];
  const pinned = state.pinnedMiniProgramIds.includes(miniProgram.id);
  const target = resolveMiniProgramNavigationTarget(
    miniProgram.id,
    isDesktopLayout,
  );

  const myMini = t(msg`我的小程序`);
  const recentLabel = t(msg`最近使用`);
  const miniLabel = t(msg`小程序`);

  return {
    id: `mini-program-${miniProgram.id}`,
    title: miniProgram.name,
    description: miniProgram.slogan,
    meta: lastOpenedAt
      ? `${pinned ? myMini : recentLabel} · ${formatTimestamp(lastOpenedAt)}`
      : `${pinned ? myMini : miniLabel} · ${miniProgram.developer}`,
    badge: launchCount > 0 ? t(msg`已打开 ${launchCount} 次`) : t(msg`打开小程序`),
    to: target.to,
    search: target.search,
    avatarName: miniProgram.name,
  };
}

function buildMiniProgramSearchResult(
  t: Translator,
  miniProgram: MiniProgramEntry,
  state: MiniProgramSearchStateSnapshot,
  isDesktopLayout: boolean,
): SearchResultItem {
  const lastOpenedAt = state.lastOpenedAtById[miniProgram.id];
  const pinned = state.pinnedMiniProgramIds.includes(miniProgram.id);
  const target = resolveMiniProgramNavigationTarget(
    miniProgram.id,
    isDesktopLayout,
  );

  const myMini = t(msg`我的小程序`);
  const recentLabel = t(msg`最近使用`);
  const miniLabel = t(msg`小程序`);

  return {
    id: `mini-program-result-${miniProgram.id}`,
    category: "miniPrograms",
    title: miniProgram.name,
    description: miniProgram.description || miniProgram.slogan,
    meta: lastOpenedAt
      ? `${pinned ? myMini : recentLabel} · ${formatTimestamp(lastOpenedAt)}`
      : `${miniLabel} · ${miniProgram.developer}`,
    keywords: [
      miniProgram.name,
      miniProgram.slogan,
      miniProgram.description,
      miniProgram.developer,
      miniProgram.badge,
      miniProgram.deckLabel,
      miniProgram.openHint,
      ...miniProgram.tags,
    ]
      .join(" ")
      .toLowerCase(),
    to: target.to,
    search: target.search,
    badge: miniLabel,
    avatarName: miniProgram.name,
    sortTime: getMiniProgramMatchScore(miniProgram, state),
  };
}

function matchesMiniProgramKeyword(
  miniProgram: MiniProgramEntry,
  keyword: string,
) {
  return [
    miniProgram.name,
    miniProgram.slogan,
    miniProgram.description,
    miniProgram.developer,
    miniProgram.deckLabel,
    miniProgram.openHint,
    ...miniProgram.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(keyword);
}

function getMiniProgramMatchScore(
  miniProgram: MiniProgramEntry,
  state: MiniProgramSearchStateSnapshot,
) {
  const openedAt = parseTimestamp(state.lastOpenedAtById[miniProgram.id]) ?? 0;
  const launchCount = state.launchCountById[miniProgram.id] ?? 0;
  const pinned = state.pinnedMiniProgramIds.includes(miniProgram.id) ? 1 : 0;
  return openedAt + launchCount * 1000 + pinned * 100;
}

function resolveMiniProgramNavigationTarget(
  miniProgramId: string,
  isDesktopLayout: boolean,
) {
  const params = new URLSearchParams();
  params.set("miniProgram", miniProgramId);

  return {
    to: isDesktopLayout ? "/tabs/mini-programs" : "/discover/mini-programs",
    search: `?${params.toString()}`,
  };
}
