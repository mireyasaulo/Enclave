import Link from "next/link";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { buildLocalePath } from "@/lib/locale-routing";
import { siteLinks } from "@/lib/site-links";

export async function SiteFooter({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const tagline = i18n._("一个属于你的 AI 虚拟世界。开源、可自部署、跨端可用。");
  const labels = {
    github: "GitHub",
    deploy: i18n._("自部署文档"),
    download: i18n._("下载"),
    privacy: i18n._("隐私政策"),
    terms: i18n._("服务条款"),
    contact: i18n._("联系我们"),
  };
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-(--border-subtle) bg-(--surface-shell)">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-(--brand-gradient) text-[11px] text-white">
              隐
            </span>
            <span>隐界 · Enclave</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-(--text-secondary)">{tagline}</p>
          <p className="mt-4 text-xs text-(--text-dim)">© {year} Enclave · MIT License</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-(--text-secondary)">
          <a href={siteLinks.github} target="_blank" rel="noreferrer" className="hover:text-(--brand-primary)">
            {labels.github}
          </a>
          <a href={siteLinks.deploy} target="_blank" rel="noreferrer" className="hover:text-(--brand-primary)">
            {labels.deploy}
          </a>
          <Link href={buildLocalePath(locale, "/download")} className="hover:text-(--brand-primary)">
            {labels.download}
          </Link>
          <Link href={buildLocalePath(locale, "/privacy")} className="hover:text-(--brand-primary)">
            {labels.privacy}
          </Link>
          <Link href={buildLocalePath(locale, "/terms")} className="hover:text-(--brand-primary)">
            {labels.terms}
          </Link>
          <a href={siteLinks.contact} className="hover:text-(--brand-primary)">
            {labels.contact}
          </a>
        </nav>
      </div>
    </footer>
  );
}
