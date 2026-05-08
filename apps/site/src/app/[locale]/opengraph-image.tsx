import { ImageResponse } from "next/og";
import { isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { getServerI18n } from "@/i18n/server";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgTemplate } from "@/components/og/og-template";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return [
    {
      id: "default",
      alt: `Enclave OG (${locale})`,
      size,
      contentType,
    },
  ];
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isSupportedLocale(locale) ? locale : "zh-CN") as SupportedLocale;
  const i18n = await getServerI18n(safeLocale);
  return new ImageResponse(renderOgTemplate(safeLocale, i18n), { ...OG_SIZE });
}
