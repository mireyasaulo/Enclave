/**
 * Site-local mirror of @yinjie/i18n locales constants.
 * Avoids importing @yinjie/i18n's barrel in server components,
 * which would pull the client-only AppLocaleProvider into the
 * server bundle and break "use client" boundaries.
 */
export const SUPPORTED_LOCALES = ["zh-CN", "en-US", "ja-JP", "ko-KR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  "zh-CN": "简体中文",
  "en-US": "English",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
};

export function getLocaleLabel(locale: SupportedLocale) {
  return LOCALE_LABELS[locale];
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocaleFromAcceptLanguage(header: string | null | undefined): SupportedLocale | null {
  if (!header) return null;
  const candidates = header
    .split(",")
    .map((entry) => entry.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const c of candidates) {
    const normalized = c.replaceAll("_", "-");
    if (isSupportedLocale(normalized)) return normalized;
    if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
    if (normalized === "en" || normalized.startsWith("en-")) return "en-US";
    if (normalized === "ja" || normalized.startsWith("ja-")) return "ja-JP";
    if (normalized === "ko" || normalized.startsWith("ko-")) return "ko-KR";
  }
  return null;
}
