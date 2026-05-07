import type { Metadata } from "next";
import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { getServerI18n } from "@/i18n/server";
import {
  alternateLocales,
  buildAlternates,
  OG_LOCALE,
  pageUrl,
} from "@/lib/seo-metadata";
import { DownloadCards } from "@/components/download-cards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const i18n = await getServerI18n(locale);
  const title = i18n._("下载");
  const description = i18n._(
    "挑选最顺手的方式开始用隐界：网页版即开即用，桌面端体验更佳，自部署完全自主。",
  );
  return {
    title,
    description,
    alternates: buildAlternates(locale, "download"),
    openGraph: {
      type: "website",
      url: pageUrl(locale, "download"),
      title,
      description,
      siteName: "Enclave",
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocales(locale),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;
  const i18n = await getServerI18n(safeLocale);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <header className="max-w-2xl">
        <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
          {i18n._("开始使用")}
        </span>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {i18n._("挑一种最顺手的方式开始用隐界")}
        </h1>
        <p className="mt-3 text-(--text-secondary)">
          {i18n._("浏览器即开即用，桌面端体验更佳；移动端与小程序在路上。所有数据云端同步。")}
        </p>
      </header>
      <div className="mt-10">
        <DownloadCards locale={safeLocale} />
      </div>
    </main>
  );
}
