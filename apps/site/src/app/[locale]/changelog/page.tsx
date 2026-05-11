import type { Metadata } from "next";
import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { getServerI18n } from "@/i18n/server";
import {
  alternateLocales,
  buildAlternates,
  OG_LOCALE,
  pageUrl,
} from "@/lib/seo-metadata";
import { CHANGELOG } from "@/lib/changelog-data";
import { siteLinks } from "@/lib/site-links";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { BreadcrumbsJsonLd } from "@/components/seo/breadcrumbs-json-ld";
import { ArticleJsonLd } from "@/components/seo/article-json-ld";

const LATEST = CHANGELOG[0];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const i18n = await getServerI18n(locale);
  const title = i18n._("更新日志");
  const description = i18n._(
    "隐界 Enclave 每个版本带来了什么：新功能、改进、修复，以及背后的取舍。",
  );
  return {
    title,
    description,
    alternates: buildAlternates(locale, "changelog"),
    openGraph: {
      type: "article",
      url: pageUrl(locale, "changelog"),
      title,
      description,
      siteName: "Enclave",
      locale: OG_LOCALE[locale],
      alternateLocale: alternateLocales(locale),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ChangelogPage({
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
        trail={[{ titleZh: "更新日志", segment: "changelog" }]}
      />
      <ArticleJsonLd
        locale={safeLocale}
        segment="changelog"
        headlineZh="更新日志"
        descriptionZh="隐界 Enclave 每个版本带来了什么：新功能、改进、修复，以及背后的取舍。"
        datePublished={LATEST.date}
        dateModified={LATEST.date}
      />
      <BreadcrumbNav
        locale={safeLocale}
        trail={[{ titleZh: "更新日志", segment: "changelog" }]}
      />
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">{i18n._("更新日志")}</h1>
        <p className="mt-3 text-(--text-secondary)">
          {i18n._(
            "每个版本带来了什么、为什么这么做。完整 release notes 请见 GitHub。",
          )}
        </p>
        <p className="mt-2 text-sm text-(--text-muted)">
          <a
            href={siteLinks.releases}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-(--brand-primary)"
          >
            {i18n._("在 GitHub Releases 查看完整列表")}
          </a>
        </p>
      </header>

      <div className="mt-12 space-y-14">
        {CHANGELOG.map((release) => (
          <article
            key={release.version}
            id={`v${release.version}`}
            className="border-t border-(--border-subtle) pt-10"
          >
            <header className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-2xl font-semibold text-(--text-primary)">
                v{release.version}
              </h2>
              <time className="text-sm text-(--text-muted)" dateTime={release.date}>
                {release.date}
              </time>
              <a
                href={release.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-sm text-(--brand-primary) hover:underline"
              >
                {i18n._("GitHub Release")} →
              </a>
            </header>
            <p className="mt-3 text-(--text-secondary)">
              {i18n._(release.headline)}
            </p>

            {release.sections.map((section, sIdx) => (
              <section key={sIdx} className="mt-6">
                <h3 className="text-lg font-semibold text-(--text-primary)">
                  {i18n._(section.title)}
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-(--text-secondary) leading-7">
                  {section.items.map((item, idx) => (
                    <li key={idx}>{i18n._(item)}</li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </div>
    </main>
  );
}
