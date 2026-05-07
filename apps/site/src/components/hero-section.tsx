import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { buildLocalePath } from "@/lib/locale-routing";
import { siteLinks } from "@/lib/site-links";

export async function HeroSection({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const labels = {
    eyebrow: i18n._("开源 · 可自部署 · 跨端"),
    title: i18n._("一个属于你的 AI 虚拟世界"),
    subtitle: i18n._(
      "在隐界，你不是和一个 chatbot 聊天，而是拥有一个有居民、有时间、有关系的私人世界。它不与现实对立，让现实里的你，多出一种可能。",
    ),
    cta1: i18n._("在线试用"),
    cta2: i18n._("在 GitHub 查看"),
    coreLoop: i18n._("核心闭环演示（动图）"),
  };

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-12 lg:px-8 lg:gap-12">
        <div className="lg:col-span-6 lg:pt-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--surface-card) px-3 py-1 text-xs font-medium text-(--brand-primary)">
            <span className="size-1.5 rounded-full bg-(--brand-primary)" />
            {labels.eyebrow}
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
            <span className="brand-gradient-text">{labels.title}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-(--text-secondary) sm:text-lg sm:leading-8">
            {labels.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={siteLinks.app}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-(--brand-primary) px-5 py-3 text-sm font-semibold text-white shadow-(--shadow-soft) transition hover:bg-(--brand-secondary)"
            >
              {labels.cta1}
              <ArrowRight size={16} />
            </a>
            <a
              href={siteLinks.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-card) px-5 py-3 text-sm font-semibold text-(--text-primary) transition hover:border-(--brand-primary)"
            >
              <Github size={16} />
              {labels.cta2}
            </a>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md text-xs text-(--text-muted)">
            <div>
              <div className="text-2xl font-bold text-(--text-primary)">4+</div>
              <div className="mt-1">{i18n._("语言版本")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-(--text-primary)">2 端</div>
              <div className="mt-1">{i18n._("移动 + 桌面")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-(--text-primary)">MIT</div>
              <div className="mt-1">{i18n._("开源协议")}</div>
            </div>
          </div>
        </div>

        <div className="relative lg:col-span-6">
          <div className="relative overflow-hidden rounded-3xl border border-(--border-subtle) bg-(--surface-card) shadow-(--shadow-shell)">
            <div className="flex items-center gap-1.5 border-b border-(--border-faint) px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-rose-300/80" />
              <span className="size-2.5 rounded-full bg-amber-300/80" />
              <span className="size-2.5 rounded-full bg-emerald-300/80" />
              <span className="ml-3 text-[11px] font-medium text-(--text-dim)">{labels.coreLoop}</span>
            </div>
            <Image
              src={`/animations/${locale}.gif`}
              alt="Enclave core loop"
              width={1200}
              height={750}
              unoptimized
              priority
              className="block w-full h-auto"
            />
          </div>
          <div aria-hidden className="absolute -inset-4 -z-10 rounded-3xl bg-(--brand-gradient) opacity-20 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
