import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { SITE_BASE_URL, pageUrl } from "@/lib/seo-metadata";
import { siteLinks } from "@/lib/site-links";
import { JsonLd } from "./json-ld";

export async function HomeJsonLd({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const name = i18n._("隐界 Enclave");
  const description = i18n._(
    "私人 AI 居民、朋友圈、群聊、电话——浏览器即开即用，免费开始你的隐界世界。",
  );

  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    alternateName: ["Enclave", "隐界"],
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web, Windows, macOS, Linux, iOS, Android",
    url: pageUrl(locale, ""),
    description,
    image: `${SITE_BASE_URL}/${locale}/opengraph-image`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    softwareHelp: { "@type": "CreativeWork", url: siteLinks.github },
    publisher: { "@id": `${SITE_BASE_URL}/#organization` },
    inLanguage: locale,
  };

  return <JsonLd data={data} />;
}
