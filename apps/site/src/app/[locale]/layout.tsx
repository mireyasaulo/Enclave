import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { loadSiteMessages } from "@/i18n/catalog-loader";
import { getServerI18n } from "@/i18n/server";
import { SiteI18nClientProvider } from "@/i18n/client-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  alternateLocales,
  buildAlternates,
  OG_LOCALE,
  pageUrl,
} from "@/lib/seo-metadata";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const i18n = await getServerI18n(locale);
  const tagline = i18n._(
    "私人 AI 居民、朋友圈、群聊、电话——浏览器即开即用，免费开始你的隐界世界。",
  );
  return {
    title: {
      default: i18n._("隐界 · 一个属于你的 AI 虚拟世界"),
      template: i18n._("%s · 隐界 Enclave"),
    },
    description: tagline,
    alternates: buildAlternates(locale, ""),
    openGraph: {
      type: "website",
      url: pageUrl(locale, ""),
      siteName: "Enclave",
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocales(locale),
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  const safeLocale = locale as SupportedLocale;
  const messages = await loadSiteMessages(safeLocale);

  return (
    <SiteI18nClientProvider locale={safeLocale} messages={messages}>
      <SiteHeader locale={safeLocale} />
      {children}
      <SiteFooter locale={safeLocale} />
    </SiteI18nClientProvider>
  );
}
