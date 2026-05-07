import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { buildLocalePath } from "@/lib/locale-routing";
import { siteLinks } from "@/lib/site-links";
import { LanguageSwitcherLink } from "./language-switcher-link";

export async function SiteHeader({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const home = buildLocalePath(locale, "/");

  const labels = {
    product: i18n._("产品"),
    capabilities: i18n._("核心能力"),
    crossPlatform: i18n._("跨端"),
    openSource: i18n._("开源自部署"),
    download: i18n._("下载"),
    tryNow: i18n._("在线试用"),
  };

  return (
    <header className="sticky top-0 z-40 border-b border-(--border-subtle) bg-(--surface-shell) backdrop-blur-xl">
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={home} className="flex min-w-0 items-center gap-2.5" aria-label="Enclave home">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-(--brand-gradient) text-base font-semibold text-white shadow-(--shadow-soft)">
            <Image src="/favicon.png" alt="" width={28} height={28} className="rounded-lg" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-(--text-primary)">隐界</span>
            <span className="block text-[11px] tracking-wide text-(--text-muted)">Enclave</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-(--text-secondary) md:flex">
          <a href={`${home}#capabilities`} className="transition hover:text-(--brand-primary)">
            {labels.capabilities}
          </a>
          <a href={`${home}#cross-platform`} className="transition hover:text-(--brand-primary)">
            {labels.crossPlatform}
          </a>
          <a href={`${home}#open-source`} className="transition hover:text-(--brand-primary)">
            {labels.openSource}
          </a>
          <Link
            href={buildLocalePath(locale, "/download")}
            className="transition hover:text-(--brand-primary)"
          >
            {labels.download}
          </Link>
        </nav>

        <div className="flex min-w-0 items-center gap-2">
          <LanguageSwitcherLink current={locale} />
          <a
            href={siteLinks.app}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-(--brand-primary) px-3 text-sm font-semibold text-white transition hover:bg-(--brand-secondary) shadow-(--shadow-soft) sm:px-4"
          >
            <span className="hidden sm:inline">{labels.tryNow}</span>
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
    </header>
  );
}
