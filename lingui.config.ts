import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  locales: ["zh-CN", "en-US", "ja-JP", "ko-KR"],
  sourceLocale: "zh-CN",
  fallbackLocales: {
    default: "zh-CN",
  },
  format: "po",
  compileNamespace: "ts",
  // Sort by first origin (file+line), then by messageId as tiebreaker — fully deterministic
  orderBy: (a, b) => {
    const getFirst = (origins: Array<[string, number]>) =>
      [...origins].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))[0] ?? [
        "",
        0,
      ];
    const [aFile, aLine] = getFirst(a.entry.origin ?? []);
    const [bFile, bLine] = getFirst(b.entry.origin ?? []);
    if (aFile < bFile) return -1;
    if (aFile > bFile) return 1;
    if (aLine < bLine) return -1;
    if (aLine > bLine) return 1;
    if (a.messageId < b.messageId) return -1;
    if (a.messageId > b.messageId) return 1;
    return 0;
  },
  catalogs: [
    {
      path: "<rootDir>/packages/i18n/catalogs/shared/{locale}",
      include: [
        "<rootDir>/packages/i18n/src",
        "<rootDir>/packages/ui/src",
      ],
      exclude: ["**/node_modules/**"],
    },
    {
      path: "<rootDir>/packages/i18n/catalogs/app/{locale}",
      include: ["<rootDir>/apps/app/src"],
      exclude: ["**/node_modules/**"],
    },
    {
      path: "<rootDir>/packages/i18n/catalogs/admin/{locale}",
      include: ["<rootDir>/apps/admin/src"],
      exclude: ["**/node_modules/**"],
    },
    {
      path: "<rootDir>/packages/i18n/catalogs/cloud-console/{locale}",
      include: ["<rootDir>/apps/cloud-console/src"],
      exclude: ["**/node_modules/**"],
    },
    {
      path: "<rootDir>/packages/i18n/catalogs/site/{locale}",
      include: ["<rootDir>/apps/site/src"],
      exclude: ["**/node_modules/**"],
    },
    {
      path: "<rootDir>/packages/i18n/catalogs/wiki/{locale}",
      include: ["<rootDir>/apps/wiki/src"],
      exclude: ["**/node_modules/**"],
    },
  ],
};

export default config;
