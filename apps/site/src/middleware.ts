import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
  resolveLocaleFromAcceptLanguage,
} from "@/lib/locales";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSeg = pathname.split("/")[1] ?? "";

  if (isSupportedLocale(firstSeg)) {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const negotiated =
    (cookieLocale && isSupportedLocale(cookieLocale) ? cookieLocale : null) ??
    resolveLocaleFromAcceptLanguage(request.headers.get("accept-language")) ??
    DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${negotiated}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\..*|favicon-.*|apple-touch-icon\\..*|icon-.*|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|manifest\\.json|opengraph-image|screenshots|animations|og).*)",
  ],
};
