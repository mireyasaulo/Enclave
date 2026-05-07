import { Github, Terminal, Boxes, ArrowRight } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { siteLinks } from "@/lib/site-links";

export async function SelfHostSection({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const labels = {
    eyebrow: i18n._("开源自部署"),
    title: i18n._("克隆、起 docker、起飞"),
    subtitle: i18n._(
      "完全开源，MIT 许可。无任何外部 SaaS 依赖；一台机器、一条 docker compose up，几分钟就能跑起来。",
    ),
    step1: i18n._("克隆仓库"),
    step2: i18n._("一键启动"),
    step3: i18n._("浏览器访问"),
    cta: i18n._("查看完整自部署指南"),
    githubCta: i18n._("在 GitHub 上 Star"),
  };

  const steps = [
    {
      icon: Github,
      title: labels.step1,
      code: "git clone https://github.com/yuanzui0728/yinjie-app",
    },
    {
      icon: Boxes,
      title: labels.step2,
      code: "docker compose up -d",
    },
    {
      icon: Terminal,
      title: labels.step3,
      code: "open http://localhost",
    },
  ];

  return (
    <section id="open-source" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {labels.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{labels.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{labels.subtitle}</p>
        </header>
        <ol className="mt-10 grid gap-4 lg:grid-cols-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-(--surface-soft) text-(--brand-primary)">
                    <Icon size={18} />
                  </span>
                  <span className="text-xs font-semibold text-(--text-dim)">
                    Step {idx + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-(--text-primary)">{step.title}</h3>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-(--text-primary) px-3 py-2 text-[12px] leading-5 text-(--bg-canvas) font-mono">
                  <code>{step.code}</code>
                </pre>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={siteLinks.deploy}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-(--brand-primary) px-5 py-3 text-sm font-semibold text-white shadow-(--shadow-soft) transition hover:bg-(--brand-secondary)"
          >
            {labels.cta}
            <ArrowRight size={16} />
          </a>
          <a
            href={siteLinks.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-card) px-5 py-3 text-sm font-semibold text-(--text-primary) transition hover:border-(--brand-primary)"
          >
            <Github size={16} />
            {labels.githubCta}
          </a>
        </div>
      </div>
    </section>
  );
}
