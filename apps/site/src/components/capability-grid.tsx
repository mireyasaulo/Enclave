import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";
import { CAPABILITIES } from "@/lib/capabilities-data";

export async function CapabilityGrid({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const titles = {
    eyebrow: i18n._("核心能力"),
    title: i18n._("不是 chatbot，而是一整个生态"),
    subtitle: i18n._("为日常陪伴和深度对话设计的 AI 社交体验，每一项都已在产品中跑通。"),
  };

  return (
    <section id="capabilities" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {titles.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{titles.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{titles.subtitle}</p>
        </header>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.titleZh}
                className="group rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-5 transition hover:border-(--brand-primary) hover:shadow-(--shadow-card)"
              >
                <div className="mb-4 grid size-10 place-items-center rounded-xl bg-(--surface-soft) text-(--brand-primary) transition group-hover:bg-(--brand-primary) group-hover:text-white">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold text-(--text-primary)">
                  {i18n._(item.titleZh)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  {i18n._(item.descZh)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
