import "server-only";
import { setupI18n, type I18n } from "@lingui/core";
import { loadSiteMessages } from "./catalog-loader";
import type { SupportedLocale } from "@/lib/locales";

const cache = new Map<SupportedLocale, Promise<I18n>>();

export function getServerI18n(locale: SupportedLocale): Promise<I18n> {
  let cached = cache.get(locale);
  if (!cached) {
    cached = (async () => {
      const messages = await loadSiteMessages(locale);
      const i18n = setupI18n();
      i18n.load(locale, messages);
      i18n.activate(locale);
      return i18n;
    })();
    cache.set(locale, cached);
  }
  return cached;
}
