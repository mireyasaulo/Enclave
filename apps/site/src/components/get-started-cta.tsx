import { ArrowRight, Lock, Github, Smartphone } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { siteLinks } from "@/lib/site-links";

export async function GetStartedCta({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const labels = {
    eyebrow: i18n._("立即开始"),
    title: i18n._("几秒钟，开启你的隐界世界"),
    subtitle: i18n._("打开浏览器即可使用，不需要安装；如果你愿意，也可以下载桌面端，或者自己部署一份。"),
    cta1: i18n._("免费开始"),
    cta2: i18n._("查看下载方式"),
    badge1Title: i18n._("数据自主"),
    badge1Body: i18n._("一人一实例，对话只属于你"),
    badge2Title: i18n._("跨端同步"),
    badge2Body: i18n._("浏览器 / 桌面 / 手机一致体验"),
    badge3Title: i18n._("开源可审计"),
    badge3Body: i18n._("MIT 协议，代码全部公开"),
  };

  const badges = [
    { icon: Lock, title: labels.badge1Title, body: labels.badge1Body },
    { icon: Smartphone, title: labels.badge2Title, body: labels.badge2Body },
    { icon: Github, title: labels.badge3Title, body: labels.badge3Body, href: siteLinks.github },
  ];

  return (
    <section id="get-started" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-(--border-subtle) bg-(--surface-card) px-6 py-12 shadow-(--shadow-shell) sm:px-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
              {labels.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              <span className="brand-gradient-text">{labels.title}</span>
            </h2>
            <p className="mt-3 text-(--text-secondary)">{labels.subtitle}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href={siteLinks.app}
                target="_blank"
                rel="noreferrer"
                data-cta="signup"
                data-cta-location="get_started"
                className="inline-flex items-center gap-2 rounded-xl bg-(--brand-primary) px-6 py-3 text-sm font-semibold text-white shadow-(--shadow-soft) transition hover:bg-(--brand-secondary)"
              >
                {labels.cta1}
                <ArrowRight size={16} />
              </a>
              <a
                href="#cross-platform"
                data-cta="download"
                data-cta-location="get_started"
                className="inline-flex items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-card) px-6 py-3 text-sm font-semibold text-(--text-primary) transition hover:border-(--brand-primary)"
              >
                {labels.cta2}
              </a>
            </div>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-3">
            {badges.map((badge) => {
              const Icon = badge.icon;
              const inner = (
                <>
                  <span className="grid size-9 place-items-center rounded-lg bg-(--surface-soft) text-(--brand-primary)">
                    <Icon size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-(--text-primary)">{badge.title}</div>
                    <div className="mt-0.5 text-xs text-(--text-secondary)">{badge.body}</div>
                  </div>
                </>
              );
              return (
                <li key={badge.title}>
                  {badge.href ? (
                    <a
                      href={badge.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 rounded-2xl border border-(--border-faint) bg-(--surface-shell) p-4 transition hover:border-(--brand-primary)"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl border border-(--border-faint) bg-(--surface-shell) p-4">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
