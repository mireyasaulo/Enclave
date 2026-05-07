import { getServerI18n } from "@/i18n/server";
import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;
  const i18n = await getServerI18n(safeLocale);

  const heroTitle = i18n._("隐界 — 一个属于你的 AI 虚拟世界");
  const heroSub = i18n._("开源、可自部署、跨端可用。");

  return (
    <main className="min-h-screen grid place-items-center text-center px-6">
      <div className="max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 brand-gradient-text">
          {heroTitle}
        </h1>
        <p className="text-lg sm:text-xl text-(--text-secondary)">{heroSub}</p>
        <p className="mt-8 text-sm text-(--text-dim)">
          locale = <code className="px-1.5 py-0.5 rounded bg-(--surface-soft) text-(--brand-primary)">{safeLocale}</code>
        </p>
      </div>
    </main>
  );
}
