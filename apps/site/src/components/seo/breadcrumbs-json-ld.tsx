import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { pageUrl } from "@/lib/seo-metadata";
import { JsonLd } from "./json-ld";

type Crumb = { titleZh: string; segment: string };

export async function BreadcrumbsJsonLd({
  locale,
  trail,
}: {
  locale: SupportedLocale;
  trail: Crumb[];
}) {
  const i18n = await getServerI18n(locale);
  const home = {
    "@type": "ListItem",
    position: 1,
    name: i18n._("首页"),
    item: pageUrl(locale, ""),
  };
  const items = [
    home,
    ...trail.map((c, idx) => ({
      "@type": "ListItem",
      position: idx + 2,
      name: i18n._(c.titleZh),
      item: pageUrl(locale, c.segment),
    })),
  ];
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
  return <JsonLd data={data} />;
}
