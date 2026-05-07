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

const TERMS_PUBLISHED = "2026-05-07";
const TERMS_MODIFIED = "2026-05-07";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const i18n = await getServerI18n(locale);
  const title = i18n._("服务条款");
  const description = i18n._(
    "隐界 Enclave 服务条款：开源协议、合理使用、订阅与计费、免责声明。",
  );
  return {
    title,
    description,
    alternates: buildAlternates(locale, "terms"),
    openGraph: {
      type: "article",
      url: pageUrl(locale, "terms"),
      title,
      description,
      siteName: "Enclave",
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocales(locale),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TermsPage({
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
        trail={[{ titleZh: "服务条款", segment: "terms" }]}
      />
      <ArticleJsonLd
        locale={safeLocale}
        segment="terms"
        headlineZh="服务条款"
        descriptionZh="隐界 Enclave 服务条款：开源协议、合理使用、订阅与计费、免责声明。"
        datePublished={TERMS_PUBLISHED}
        dateModified={TERMS_MODIFIED}
      />
      <BreadcrumbNav
        locale={safeLocale}
        trail={[{ titleZh: "服务条款", segment: "terms" }]}
      />
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">{i18n._("服务条款")}</h1>
        <p className="mt-3 text-sm text-(--text-muted)">
          {safeLocale === "en-US"
            ? `Last updated: ${TERMS_MODIFIED}`
            : safeLocale === "ja-JP"
              ? `最終更新：${TERMS_MODIFIED}`
              : safeLocale === "ko-KR"
                ? `마지막 업데이트: ${TERMS_MODIFIED}`
                : `最近更新：${TERMS_MODIFIED}`}
        </p>
      </header>
      <div className="mt-10 space-y-8 text-(--text-secondary) leading-7">
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("一、开源许可")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "隐界以 MIT 许可证发布。你可以自由使用、修改、分发本项目源代码与产物，包括商业用途，请遵循 MIT 协议中的署名要求。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("二、合理使用")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "请不要利用隐界从事违反所在国家或地区法律的活动；不要将其用于骚扰、欺诈、传播虚假信息或制造伤害。AI 角色生成的内容由用户负责审阅与判断，不视为隐界开发者的立场或建议。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("三、订阅与计费")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "若你选择官方托管的云服务并购买订阅，账单与你接入的模型供应商绑定，按使用量结算。订阅可随时取消，未使用部分按月按比例退还。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("四、免责声明")}
          </h2>
          <p className="mt-3">
            {i18n._(
              "本软件按现状提供，不对适销性、特定用途适用性、不侵权或可用性作任何明示或暗示担保。在适用法律允许的最大范围内，作者与贡献者不承担因使用本软件而产生的任何损失。",
            )}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("五、变更")}
          </h2>
          <p className="mt-3">
            {i18n._("条款可能根据法律法规与产品演进调整，重大变更我们会在仓库与本页公告。")}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("六、联系我们")}
          </h2>
          <p className="mt-3">{i18n._("如对条款有任何疑问，请发邮件至 yuanzui0728@gmail.com。")}</p>
        </section>
      </div>
    </main>
  );
}
