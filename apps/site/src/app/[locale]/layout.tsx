import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { loadSiteMessages } from "@/i18n/catalog-loader";
import { SiteI18nClientProvider } from "@/i18n/client-provider";

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
  const messages = await loadSiteMessages(locale as SupportedLocale);

  return (
    <SiteI18nClientProvider locale={locale as SupportedLocale} messages={messages}>
      {children}
    </SiteI18nClientProvider>
  );
}
