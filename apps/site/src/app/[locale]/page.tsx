import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { HeroSection } from "@/components/hero-section";
import { CapabilityGrid } from "@/components/capability-grid";
import { MultiPlatformCarousel } from "@/components/multi-platform-carousel";
import { OnePersonWorld } from "@/components/one-person-world";
import { CrossPlatformSection } from "@/components/cross-platform-section";
import { GetStartedCta } from "@/components/get-started-cta";
import { FaqAccordion } from "@/components/faq-accordion";

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
      <OnePersonWorld locale={safeLocale} />
      <CrossPlatformSection locale={safeLocale} />
      <GetStartedCta locale={safeLocale} />
      <FaqAccordion locale={safeLocale} />
    </>
  );
}
