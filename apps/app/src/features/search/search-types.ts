import { msg } from "@lingui/macro";

export type SearchResultCategory =
  | "messages"
  | "contacts"
  | "favorites"
  | "officialAccounts"
  | "miniPrograms"
  | "moments"
  | "feed";

export type SearchCategory = "all" | SearchResultCategory;

export type SearchResultItem = {
  id: string;
  category: SearchResultCategory;
  title: string;
  description: string;
  meta: string;
  keywords: string;
  to: string;
  search?: string;
  hash?: string;
  badge: string;
  avatarName?: string;
  avatarSrc?: string;
  sortTime: number;
};

export type SearchMatchCounts = Record<SearchResultCategory, number>;

export type SearchResultSection = {
  category: SearchResultCategory;
  label: ReturnType<typeof msg>;
  results: SearchResultItem[];
};

export type SearchMessageGroup = {
  id: string;
  header: SearchResultItem;
  messages: SearchResultItem[];
  sortTime: number;
  totalHits: number;
};

export type SearchOfficialAccountGroup = {
  id: string;
  header: SearchResultItem;
  articles: SearchResultItem[];
  sortTime: number;
  totalHits: number;
};

export type SearchScopeCounts = {
  conversations: number;
  contacts: number;
  favorites: number;
  officialAccounts: number;
  miniPrograms: number;
  moments: number;
  feed: number;
};

export type SearchHistoryItem = {
  keyword: string;
  usedAt: number;
};

export const searchCategoryLabels: Array<{
  id: SearchCategory;
  label: ReturnType<typeof msg>;
}> = [
  { id: "all", label: msg`全部` },
  { id: "messages", label: msg`聊天记录` },
  { id: "contacts", label: msg`联系人` },
  { id: "favorites", label: msg`收藏` },
  { id: "officialAccounts", label: msg`公众号` },
  { id: "miniPrograms", label: msg`小程序` },
  { id: "moments", label: msg`朋友圈` },
  { id: "feed", label: msg`广场动态` },
];

// NOTE: searchCategoryTitles 仍是字符串表，desktop 暂未做 i18n。
// 桌面侧迁移完成后改为 Record<SearchResultCategory, ReturnType<typeof msg>>。
export const searchCategoryTitles: Record<SearchResultCategory, string> = {
  messages: "聊天记录",
  contacts: "联系人",
  favorites: "收藏",
  officialAccounts: "公众号",
  miniPrograms: "小程序",
  moments: "朋友圈",
  feed: "广场动态",
};

export const emptySearchMatchCounts: SearchMatchCounts = {
  messages: 0,
  contacts: 0,
  favorites: 0,
  officialAccounts: 0,
  miniPrograms: 0,
  moments: 0,
  feed: 0,
};

export const emptySearchScopeCounts: SearchScopeCounts = {
  conversations: 0,
  contacts: 0,
  favorites: 0,
  officialAccounts: 0,
  miniPrograms: 0,
  moments: 0,
  feed: 0,
};
