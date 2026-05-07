import { Lock, Database, Cpu, Heart, type LucideIcon } from "lucide-react";
import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

type Principle = {
  icon: LucideIcon;
  title: MessageDescriptor;
  body: MessageDescriptor;
};

const PRINCIPLES: Principle[] = [
  {
    icon: Lock,
    title: msg`一人一世界`,
    body: msg`每位用户拥有完全独立的世界，互不打扰、互不可见。你的对话只属于你。`,
  },
  {
    icon: Database,
    title: msg`数据自主`,
    body: msg`全部数据可一键导出，随时带走；不绑定平台，不锁定关系。`,
  },
  {
    icon: Cpu,
    title: msg`可信赖的 AI`,
    body: msg`代码完全开源、可审计；底层模型可选官方托管或自主接入，过程透明。`,
  },
  {
    icon: Heart,
    title: msg`不取代现实`,
    body: msg`白天有同事、有老板，晚上回到隐界有心理咨询师；它补全你的情感维度，而不是替代真实关系。`,
  },
];

export async function OnePersonWorld({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const titles = {
    eyebrow: i18n._("理念"),
    title: i18n._("属于你的，就只属于你"),
    subtitle: i18n._(
      "隐界为每个人单独搭建一个私人 AI 世界。你的居民、你的关系、你的故事——别人看不到，平台也不会拿去训练。",
    ),
  };

  return (
    <section id="philosophy" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {titles.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{titles.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{titles.subtitle}</p>
        </header>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title.id ?? String(p.title.message)}
                className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-6 transition hover:border-(--brand-primary)"
              >
                <div className="mb-4 grid size-11 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-semibold text-(--text-primary)">{i18n._(p.title)}</h3>
                <p className="mt-2 text-sm leading-7 text-(--text-secondary)">{i18n._(p.body)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
