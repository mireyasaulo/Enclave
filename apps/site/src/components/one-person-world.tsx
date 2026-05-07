import { Lock, Database, Cpu, Heart, type LucideIcon } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

type Principle = {
  icon: LucideIcon;
  titleZh: string;
  bodyZh: string;
};

const PRINCIPLES: Principle[] = [
  {
    icon: Lock,
    titleZh: "一人一世界",
    bodyZh: "独立实例架构，数据真正属于用户。隐私不靠承诺，靠架构层保障。",
  },
  {
    icon: Database,
    titleZh: "数据自主",
    bodyZh: "全部数据可导入导出，可整包迁移；离开隐界，世界还是你的。",
  },
  {
    icon: Cpu,
    titleZh: "AI 平权",
    bodyZh: "高质量对话不应被少数平台垄断。隐界让任何人都能拥有自己的 AI 居民。",
  },
  {
    icon: Heart,
    titleZh: "不取代现实",
    bodyZh: "白天有同事、有老板，晚上回到隐界有心理咨询师；它补全你的情感维度，而不是替代真实关系。",
  },
];

export async function OnePersonWorld({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const titles = {
    eyebrow: i18n._("理念"),
    title: i18n._("一个属于你的世界，从架构开始"),
    subtitle: i18n._(
      "隐界不是一个共享的 chatbot 服务，而是一套可独立部署的 AI 社交基础设施。每个实例只为一个人存在。",
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
                key={p.titleZh}
                className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-6 transition hover:border-(--brand-primary)"
              >
                <div className="mb-4 grid size-11 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-semibold text-(--text-primary)">{i18n._(p.titleZh)}</h3>
                <p className="mt-2 text-sm leading-7 text-(--text-secondary)">{i18n._(p.bodyZh)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
