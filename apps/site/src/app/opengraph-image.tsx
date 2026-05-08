import { ImageResponse } from "next/og";
import { resolveLocaleFromRequest } from "@/lib/locale-from-request";
import { getServerI18n } from "@/i18n/server";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgTemplate } from "@/components/og/og-template";

export const alt = "Enclave OG";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  const locale = await resolveLocaleFromRequest();
  const i18n = await getServerI18n(locale);
  return new ImageResponse(renderOgTemplate(locale, i18n), { ...OG_SIZE });
}
