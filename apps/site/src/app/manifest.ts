import type { MetadataRoute } from "next";
import { resolveLocaleFromRequest } from "@/lib/locale-from-request";
import { getServerI18n } from "@/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await resolveLocaleFromRequest();
  const i18n = await getServerI18n(locale);

  return {
    name: i18n._("隐界 Enclave"),
    short_name: "Enclave",
    description: i18n._(
      "一个属于你的 AI 虚拟世界。私人 AI 居民、朋友圈、群聊、电话——浏览器即开即用。",
    ),
    start_url: `/${locale}`,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fffcf5",
    theme_color: "#f97316",
    lang: locale,
    icons: [
      { src: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { src: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
