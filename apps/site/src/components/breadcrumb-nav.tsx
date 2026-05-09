import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MessageDescriptor } from "@lingui/core";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { buildLocalePath } from "@/lib/locale-routing";

type Crumb = { titleZh: string | MessageDescriptor; segment: string };

function tr(i18n: Awaited<ReturnType<typeof getServerI18n>>, v: string | MessageDescriptor) {
  return typeof v === "string" ? i18n._(v) : i18n._(v);
}

// 与 BreadcrumbsJsonLd 配套的可视面包屑：让 DOM 与结构化数据中的 trail
// 一一对应，Google 抓到时更愿意识别为 BreadcrumbList。
export async function BreadcrumbNav({
  locale,
  trail,
}: {
  locale: SupportedLocale;
  trail: Crumb[];
}) {
  const i18n = await getServerI18n(locale);
  const items = [
    { name: i18n._("首页"), href: buildLocalePath(locale, "/") },
    ...trail.map((c, idx) => ({
      name: tr(i18n, c.titleZh),
      href: buildLocalePath(locale, `/${c.segment}`),
      last: idx === trail.length - 1,
    })),
  ];

  return (
    <nav aria-label={i18n._("面包屑导航")} className="mb-6 text-sm text-(--text-muted)">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="text-(--text-secondary)">
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-(--brand-primary)">
                  {item.name}
                </Link>
              )}
              {!isLast ? (
                <ChevronRight size={14} className="text-(--text-dim)" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
