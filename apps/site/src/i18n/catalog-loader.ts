import "server-only";
import type { Messages } from "@lingui/core";
import type { SupportedLocale } from "@/lib/locales";

type CatalogModule = { messages: Messages };

const sharedLoaders: Record<SupportedLocale, () => Promise<CatalogModule>> = {
  "zh-CN": () => import("@yinjie/i18n/catalogs/shared/zh-CN.po"),
  "en-US": () => import("@yinjie/i18n/catalogs/shared/en-US.po"),
  "ja-JP": () => import("@yinjie/i18n/catalogs/shared/ja-JP.po"),
  "ko-KR": () => import("@yinjie/i18n/catalogs/shared/ko-KR.po"),
};

const siteLoaders: Record<SupportedLocale, () => Promise<CatalogModule>> = {
  "zh-CN": () => import("@yinjie/i18n/catalogs/site/zh-CN.po"),
  "en-US": () => import("@yinjie/i18n/catalogs/site/en-US.po"),
  "ja-JP": () => import("@yinjie/i18n/catalogs/site/ja-JP.po"),
  "ko-KR": () => import("@yinjie/i18n/catalogs/site/ko-KR.po"),
};

export async function loadSiteMessages(locale: SupportedLocale): Promise<Messages> {
  const [shared, site] = await Promise.all([
    sharedLoaders[locale]().catch(() => ({ messages: {} })),
    siteLoaders[locale]().catch(() => ({ messages: {} })),
  ]);
  return { ...shared.messages, ...site.messages };
}
