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
      <div>
        <h1 className="text-4xl font-bold mb-4 text-(--brand-primary)">{heroTitle}</h1>
        <p className="text-lg opacity-70">{heroSub}</p>
        <p className="mt-6 text-sm opacity-50">
          locale = <code>{safeLocale}</code>
        </p>
      </div>
    </main>
  );
}
