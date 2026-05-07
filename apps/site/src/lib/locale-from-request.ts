import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
  resolveLocaleFromAcceptLanguage,
  type SupportedLocale,
} from "./locales";

export async function resolveLocaleFromRequest(): Promise<SupportedLocale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) return cookieLocale;
  const accept = (await headers()).get("accept-language");
  return resolveLocaleFromAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}
