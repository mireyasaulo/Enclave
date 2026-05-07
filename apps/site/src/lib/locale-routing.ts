import { isSupportedLocale, type SupportedLocale } from "./locales";

export function buildLocalePath(locale: SupportedLocale, path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized === "/" ? "" : normalized}`;
}

export function swapLocaleInPath(currentPath: string, nextLocale: SupportedLocale) {
  const segments = currentPath.split("/");
  if (segments.length >= 2 && isSupportedLocale(segments[1])) {
    segments[1] = nextLocale;
    const next = segments.join("/");
    return next || `/${nextLocale}`;
  }
  return buildLocalePath(nextLocale, currentPath);
}
