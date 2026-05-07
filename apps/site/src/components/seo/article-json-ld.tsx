import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { SITE_BASE_URL, pageUrl } from "@/lib/seo-metadata";
import { JsonLd } from "./json-ld";

/**
 * Emit Article JSON-LD for legal pages (privacy / terms). Google
 * accepts Article as the fallback for PrivacyPolicy / TermsOfService
 * which aren't standalone schema.org types. datePublished /
 * dateModified provide the freshness signal Google looks for on YMYL
 * pages.
 */
export async function ArticleJsonLd({
  locale,
  segment,
  headlineZh,
  descriptionZh,
  datePublished,
  dateModified,
}: {
  locale: SupportedLocale;
  segment: string;
  headlineZh: string;
  descriptionZh: string;
  datePublished: string;
  dateModified: string;
}) {
  const i18n = await getServerI18n(locale);
  const url = pageUrl(locale, segment);

  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: i18n._(headlineZh),
    description: i18n._(descriptionZh),
    datePublished,
    dateModified,
    inLanguage: locale,
    publisher: { "@id": `${SITE_BASE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };

  return <JsonLd data={data} />;
}
