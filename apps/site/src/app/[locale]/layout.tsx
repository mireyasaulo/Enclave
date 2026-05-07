import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { loadSiteMessages } from "@/i18n/catalog-loader";
import { SiteI18nClientProvider } from "@/i18n/client-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
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
