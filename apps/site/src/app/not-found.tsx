import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { buildLocalePath } from "@/lib/locale-routing";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const seg = pathname.split("/")[1] ?? "";
  const locale: SupportedLocale = isSupportedLocale(seg) ? seg : DEFAULT_LOCALE;
  const i18n = await getServerI18n(locale);

  const title = i18n._("404");
  const message = i18n._("该页面不存在");
  const back = i18n._("回到首页");

  return (
    <main className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="opacity-70 mb-4">{message}</p>
        <Link href={buildLocalePath(locale, "/")} className="underline">
          {back}
        </Link>
      </div>
    </main>
  );
}
