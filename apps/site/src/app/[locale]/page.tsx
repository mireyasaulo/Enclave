import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { HeroSection } from "@/components/hero-section";
import { CapabilityGrid } from "@/components/capability-grid";
import { MultiPlatformCarousel } from "@/components/multi-platform-carousel";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;

  return (
    <>
      <HeroSection locale={safeLocale} />
      <CapabilityGrid locale={safeLocale} />
      <MultiPlatformCarousel locale={safeLocale} />
    </>
  );
}
