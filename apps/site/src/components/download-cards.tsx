import Link from "next/link";
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
};

export async function DownloadCards({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);

  const cards: DownloadCard[] = [
    {
      icon: AppWindow,
      titleZh: "Windows 桌面端",
      hintZh: "Tauri 原生封装，附带托盘和锁屏",
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
      icon: Globe,
      titleZh: "网页版（在线试用）",
      hintZh: "无需安装，直接在浏览器里体验",
      buttonZh: "打开网页版",
      href: siteLinks.app,
      external: true,
      available: true,
    },
    {
      icon: Smartphone,
      titleZh: "iOS / Android",
      hintZh: "Capacitor 移动壳，敬请期待",
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
      titleZh: "自部署（推荐）",
      hintZh: "克隆仓库、docker compose up，几分钟跑起来",
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
          "flex h-full flex-col rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-6 transition";
        return (
          <li
            key={card.titleZh}
            className={
              card.available
                ? `${baseClass} hover:border-(--brand-primary) hover:shadow-(--shadow-card)`
                : `${baseClass} opacity-70`
            }
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
                <Icon size={22} strokeWidth={2} />
              </span>
              {!card.available && (
                <span className="inline-flex items-center gap-1 rounded-full bg-(--surface-soft) px-2.5 py-0.5 text-xs font-medium text-(--brand-primary)">
                  <Clock size={12} />
                  {i18n._("敬请期待")}
                </span>
              )}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-(--text-primary)">{i18n._(card.titleZh)}</h3>
            <p className="mt-2 text-sm leading-6 text-(--text-secondary)">{i18n._(card.hintZh)}</p>
            <div className="mt-5 flex-1" />
            {card.available ? (
              <a
                href={card.href}
                target={card.external ? "_blank" : undefined}
                rel={card.external ? "noreferrer" : undefined}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-(--border-subtle) px-3 py-2 text-sm font-semibold text-(--text-primary) transition hover:border-(--brand-primary) hover:text-(--brand-primary)"
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
