import {
  Apple,
  AppWindow,
  Smartphone,
  MessageCircle,
  Github,
  Globe,
  ArrowUpRight,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { siteLinks } from "@/lib/site-links";

type DownloadCard = {
  icon: LucideIcon;
  titleZh: string;
  hintZh: string;
  buttonZh: string;
  href: string;
  external: boolean;
  available: boolean;
  highlight?: boolean;
};

export async function DownloadCards({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);

  const cards: DownloadCard[] = [
    {
      icon: Globe,
      titleZh: "网页版（推荐）",
      hintZh: "打开浏览器即用，无需安装；最快开始体验隐界",
      buttonZh: "立即开始",
      href: siteLinks.app,
      external: true,
      available: true,
      highlight: true,
    },
    {
      icon: AppWindow,
      titleZh: "Windows 桌面端",
      hintZh: "原生体验，含托盘和锁屏，适合长期重度使用",
      buttonZh: "前往 GitHub Releases",
      href: siteLinks.releases,
      external: true,
      available: true,
    },
    {
      icon: Apple,
      titleZh: "macOS 桌面端",
      hintZh: "适配 Apple Silicon 与 Intel",
      buttonZh: "前往 GitHub Releases",
      href: siteLinks.releases,
      external: true,
      available: true,
    },
    {
      icon: Smartphone,
      titleZh: "iOS / Android",
      hintZh: "原生移动端 App，敬请期待",
      buttonZh: "敬请期待",
      href: "#",
      external: false,
      available: false,
    },
    {
      icon: MessageCircle,
      titleZh: "微信小程序",
      hintZh: "适配国内场景，敬请期待",
      buttonZh: "敬请期待",
      href: "#",
      external: false,
      available: false,
    },
    {
      icon: Github,
      titleZh: "自部署（高级）",
      hintZh: "完全开源、MIT 协议；如果你想拥有 100% 自主权可以自己跑一份",
      buttonZh: "查看部署指南",
      href: siteLinks.deploy,
      external: true,
      available: true,
    },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const baseClass =
          "flex h-full flex-col rounded-2xl border bg-(--surface-card) p-6 transition";
        const variantClass = card.highlight
          ? "border-(--brand-primary) shadow-(--shadow-card)"
          : card.available
            ? "border-(--border-subtle) hover:border-(--brand-primary) hover:shadow-(--shadow-card)"
            : "border-(--border-subtle) opacity-70";
        return (
          <li key={card.titleZh} className={`${baseClass} ${variantClass}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
                <Icon size={22} strokeWidth={2} />
              </span>
              {card.highlight ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-(--brand-primary) px-2.5 py-0.5 text-xs font-medium text-white">
                  {i18n._("推荐")}
                </span>
              ) : !card.available ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-(--surface-soft) px-2.5 py-0.5 text-xs font-medium text-(--brand-primary)">
                  <Clock size={12} />
                  {i18n._("敬请期待")}
                </span>
              ) : null}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-(--text-primary)">{i18n._(card.titleZh)}</h2>
            <p className="mt-2 text-sm leading-6 text-(--text-secondary)">{i18n._(card.hintZh)}</p>
            <div className="mt-5 flex-1" />
            {card.available ? (
              <a
                href={card.href}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noreferrer" : undefined}
                data-cta="download"
                data-cta-location={`download_card_${card.titleZh}`}
                className={
                  card.highlight
                    ? "inline-flex items-center justify-center gap-1.5 rounded-lg bg-(--brand-primary) px-3 py-2 text-sm font-semibold text-white transition hover:bg-(--brand-secondary)"
                    : "inline-flex items-center justify-center gap-1.5 rounded-lg border border-(--border-subtle) px-3 py-2 text-sm font-semibold text-(--text-primary) transition hover:border-(--brand-primary) hover:text-(--brand-primary)"
                }
              >
                {i18n._(card.buttonZh)}
                <ArrowUpRight size={14} />
              </a>
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-(--border-faint) px-3 py-2 text-sm font-medium text-(--text-dim)">
                {i18n._(card.buttonZh)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
