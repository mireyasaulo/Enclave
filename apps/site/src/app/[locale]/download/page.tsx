import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { getServerI18n } from "@/i18n/server";
import { DownloadCards } from "@/components/download-cards";

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;
  const i18n = await getServerI18n(safeLocale);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <header className="max-w-2xl">
        <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
          {i18n._("下载")}
        </span>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {i18n._("挑一种最顺手的方式开始用隐界")}
        </h1>
        <p className="mt-3 text-(--text-secondary)">
          {i18n._("桌面端原生封装、网页版即开即用，自部署提供完整自主权。移动端与小程序在路上。")}
        </p>
      </header>
      <div className="mt-10">
        <DownloadCards locale={safeLocale} />
      </div>
    </main>
  );
}
