import type { Metadata } from "next";
import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { getServerI18n } from "@/i18n/server";
import {
  alternateLocales,
  buildAlternates,
  OG_LOCALE,
  pageUrl,
} from "@/lib/seo-metadata";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { BreadcrumbsJsonLd } from "@/components/seo/breadcrumbs-json-ld";
import { ArticleJsonLd } from "@/components/seo/article-json-ld";

const PRIVACY_PUBLISHED = "2026-05-07";
const PRIVACY_MODIFIED = "2026-05-07";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const i18n = await getServerI18n(locale);
  const title = i18n._("隐私政策");
  const description = i18n._(
    "隐界如何采集、存储、使用你的数据。包含自部署用户与托管云用户两种场景。",
  );
  return {
    title,
    description,
    alternates: buildAlternates(locale, "privacy"),
    openGraph: {
      type: "article",
      url: pageUrl(locale, "privacy"),
      title,
      description,
      siteName: "Enclave",
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocales(locale),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;
  const i18n = await getServerI18n(safeLocale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <BreadcrumbsJsonLd
        locale={safeLocale}
        trail={[{ titleZh: "隐私政策", segment: "privacy" }]}
      />
      <ArticleJsonLd
        locale={safeLocale}
        segment="privacy"
        headlineZh="隐私政策"
        descriptionZh="隐界如何采集、存储、使用你的数据。包含自部署用户与托管云用户两种场景。"
        datePublished={PRIVACY_PUBLISHED}
        dateModified={PRIVACY_MODIFIED}
      />
      <BreadcrumbNav
        locale={safeLocale}
        trail={[{ titleZh: "隐私政策", segment: "privacy" }]}
      />
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">{i18n._("隐私政策")}</h1>
        <p className="mt-3 text-sm text-(--text-muted)">
          {safeLocale === "en-US"
            ? `Last updated: ${PRIVACY_MODIFIED}`
            : safeLocale === "ja-JP"
              ? `最終更新：${PRIVACY_MODIFIED}`
              : safeLocale === "ko-KR"
                ? `마지막 업데이트: ${PRIVACY_MODIFIED}`
                : `最近更新：${PRIVACY_MODIFIED}`}
        </p>
      </header>
      <div className="mt-10 space-y-8 text-(--text-secondary) leading-7">
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("一、我们的隐私立场")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "隐界采用一人一世界的独立实例架构。除非你主动选择官方托管的云服务，否则你的数据保存在你自己部署的实例里，与任何中央服务器无关。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("二、自部署用户")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "你完全控制数据存放位置（本地数据库 / 自有服务器 / 云盘）。隐界不会向第三方发送任何用户数据，除非你显式连接外部模型供应商；此时仅相关对话内容根据你的配置发送给该供应商。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("三、托管云服务用户")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "如选择官方托管，我们仅采集运行所需的最少数据：账号标识、订阅状态、错误堆栈与请求日志。这些数据不会用于广告，也不会与第三方共享，仅用于服务运维与计费。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("四、模型供应商")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "AI 对话内容会按你的配置发送给所选模型供应商（OpenAI、Anthropic、Google、DeepSeek 等，或你自部署的本地模型）。具体数据处理方式请参考各供应商的隐私政策。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("五、你的权利")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "你可以随时导出全部数据、迁移到其他实例、永久删除自己的世界。我们不会保留任何无法删除的数据副本。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("六、联系我们")}
          </h2>
          <p className="mt-3">
            {i18n._("有任何隐私相关疑问，请发邮件至 yuanzui0728@gmail.com。")}
          </p>
        </section>
      </div>
    </main>
  );
}
