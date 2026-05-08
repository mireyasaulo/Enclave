import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/locales";
import { getServerI18n } from "@/i18n/server";
import {
  alternateLocales,
  buildAlternates,
  OG_LOCALE,
  pageUrl,
} from "@/lib/seo-metadata";
import {
  USE_CASES,
  USE_CASE_SLUGS,
  findUseCase,
} from "@/lib/use-cases-data";
import { siteLinks } from "@/lib/site-links";
import { buildLocalePath } from "@/lib/locale-routing";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { BreadcrumbsJsonLd } from "@/components/seo/breadcrumbs-json-ld";
import { ArticleJsonLd } from "@/components/seo/article-json-ld";
import { JsonLd } from "@/components/seo/json-ld";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    USE_CASE_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const useCase = findUseCase(slug);
  if (!useCase) return {};
  const i18n = await getServerI18n(locale);
  const title = i18n._(useCase.titleZh);
  const description = i18n._(useCase.shortDescZh);
  const segment = `use-cases/${useCase.slug}`;
  return {
    title,
    description,
    alternates: buildAlternates(locale, segment),
    openGraph: {
      type: "article",
      url: pageUrl(locale, segment),
      title,
      description,
      siteName: "Enclave",
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocales(locale),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function UseCaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;
  const useCase = findUseCase(slug);
  if (!useCase) notFound();
  const i18n = await getServerI18n(safeLocale);
  const Icon = useCase.icon;
  const segment = `use-cases/${useCase.slug}`;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: useCase.faqs.map((f) => ({
      "@type": "Question",
      name: i18n._(f.qZh),
      acceptedAnswer: { "@type": "Answer", text: i18n._(f.aZh) },
    })),
  };

  const otherUseCases = USE_CASES.filter((u) => u.slug !== useCase.slug);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <BreadcrumbsJsonLd
        locale={safeLocale}
        trail={[
          { titleZh: "用例", segment: "use-cases" },
          { titleZh: useCase.titleZh, segment },
        ]}
      />
      <ArticleJsonLd
        locale={safeLocale}
        segment={segment}
        headlineZh={useCase.titleZh}
        descriptionZh={useCase.shortDescZh}
        datePublished={useCase.publishedDate}
        dateModified={useCase.modifiedDate}
      />
      <JsonLd data={faqJsonLd} />
      <BreadcrumbNav
        locale={safeLocale}
        trail={[
          { titleZh: "用例", segment: "use-cases" },
          { titleZh: useCase.titleZh, segment },
        ]}
      />

      <header>
        <span className="inline-flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
            <Icon size={20} strokeWidth={2} />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {i18n._(useCase.eyebrowZh)}
          </span>
        </span>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          {i18n._(useCase.titleZh)}
        </h1>
        <p className="mt-4 text-lg leading-8 text-(--text-secondary)">
          {i18n._(useCase.shortDescZh)}
        </p>
      </header>

      <article className="mt-10 space-y-10 leading-7 text-(--text-secondary)">
        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._(useCase.problemTitleZh)}
          </h2>
          <p className="mt-3">{i18n._(useCase.problemBodyZh)}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._(useCase.solutionTitleZh)}
          </h2>
          <p className="mt-3">{i18n._(useCase.solutionBodyZh)}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("它具体怎么做到")}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {useCase.features.map((f) => (
              <li
                key={f.titleZh}
                className="rounded-xl border border-(--border-subtle) bg-(--surface-card) p-5"
              >
                <h3 className="text-base font-semibold text-(--text-primary)">
                  {i18n._(f.titleZh)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  {i18n._(f.descZh)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("常见问题")}
          </h2>
          <ul className="mt-4 space-y-3">
            {useCase.faqs.map((f) => (
              <li
                key={f.qZh}
                className="overflow-hidden rounded-xl border border-(--border-subtle) bg-(--surface-card)"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-(--text-primary) transition hover:bg-(--surface-soft)">
                    <span>{i18n._(f.qZh)}</span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-(--text-muted) transition group-open:rotate-90 group-open:text-(--brand-primary)"
                    />
                  </summary>
                  <div className="border-t border-(--border-faint) px-5 py-4 text-sm leading-7 text-(--text-secondary)">
                    {i18n._(f.aZh)}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-(--brand-primary) bg-(--surface-card) p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("准备好试一下？")}
          </h2>
          <p className="mt-3 text-(--text-secondary)">
            {i18n._("浏览器即开即用，不需要注册任何信用卡。")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={siteLinks.app}
              target="_blank"
              rel="noreferrer"
              data-cta="signup"
              data-cta-location={`use_case_${useCase.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-(--brand-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-(--shadow-soft) transition hover:bg-(--brand-secondary)"
            >
              {i18n._("免费开始")}
              <ArrowRight size={14} />
            </a>
            <Link
              href={buildLocalePath(safeLocale, "/download")}
              className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-card) px-4 py-2.5 text-sm font-semibold text-(--text-primary) transition hover:border-(--brand-primary)"
            >
              {i18n._("查看下载方式")}
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {i18n._("看看其它用例")}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {otherUseCases.map((u) => {
              const OtherIcon = u.icon;
              return (
                <li key={u.slug}>
                  <Link
                    href={buildLocalePath(safeLocale, `/use-cases/${u.slug}`)}
                    className="flex items-center gap-3 rounded-xl border border-(--border-subtle) bg-(--surface-card) p-4 transition hover:border-(--brand-primary)"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--surface-soft) text-(--brand-primary)">
                      <OtherIcon size={18} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-(--text-primary)">
                        {i18n._(u.titleZh)}
                      </span>
                    </span>
                    <ArrowRight size={14} className="text-(--text-muted)" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </article>
    </main>
  );
}
