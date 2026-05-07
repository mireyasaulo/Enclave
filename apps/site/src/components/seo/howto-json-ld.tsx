import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { pageUrl } from "@/lib/seo-metadata";
import { siteLinks } from "@/lib/site-links";
import { JsonLd } from "./json-ld";

export async function HowToJsonLd({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);

  const data = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: i18n._("如何开始使用隐界"),
    description: i18n._(
      "三种开始使用隐界的方式：浏览器即开即用、桌面端原生体验、自部署完全自主。",
    ),
    totalTime: "PT2M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: i18n._("打开网页版（最快）"),
        text: i18n._(
          "点击「立即开始」，浏览器直接进入隐界世界，无需安装；适合第一次体验。",
        ),
        url: siteLinks.app,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: i18n._("下载桌面端（更顺手）"),
        text: i18n._(
          "前往 GitHub Releases 下载 Windows 或 macOS 安装包，获得原生体验、托盘与锁屏支持。",
        ),
        url: siteLinks.releases,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: i18n._("自部署（最自主）"),
        text: i18n._(
          "克隆仓库按部署文档跑一份属于自己的实例，数据 100% 在自己机器上，MIT 许可。",
        ),
        url: siteLinks.deploy,
      },
    ],
    inLanguage: locale,
    mainEntityOfPage: pageUrl(locale, "download"),
  };

  return <JsonLd data={data} />;
}
