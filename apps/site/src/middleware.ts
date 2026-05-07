import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED = ["zh-CN", "en-US", "ja-JP", "ko-KR"] as const;
const DEFAULT_LOCALE = "zh-CN";
const COOKIE_NAME = "NEXT_LOCALE";

function isSupported(value: string): value is (typeof SUPPORTED)[number] {
  return (SUPPORTED as readonly string[]).includes(value);
}

function negotiate(value: string | null | undefined): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().replaceAll("_", "-");
    if (!tag) continue;
    const exact = SUPPORTED.find((s) => s.toLowerCase() === tag);
    if (exact) return exact;
    if (tag === "zh" || tag.startsWith("zh-")) return "zh-CN";
    if (tag === "en" || tag.startsWith("en-")) return "en-US";
    if (tag === "ja" || tag.startsWith("ja-")) return "ja-JP";
    if (tag === "ko" || tag.startsWith("ko-")) return "ko-KR";
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSeg = pathname.split("/")[1] ?? "";

  if (isSupported(firstSeg)) {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  }

  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value;
  const negotiated =
    (cookieLocale && isSupported(cookieLocale) ? cookieLocale : null) ??
    negotiate(request.headers.get("accept-language")) ??
    DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${negotiated}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\..*|robots\\.txt|sitemap\\.xml|screenshots|animations|og).*)"],
};
