import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.enclave.top",
  ),
  title: {
    default: "隐界 · Enclave",
    template: "%s · 隐界 Enclave",
  },
  description: "一个属于你的 AI 虚拟世界。开源、可自部署、跨端可用。",
  applicationName: "Enclave",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
};

function pickLocaleFromPath(pathname: string | null): SupportedLocale {
  if (!pathname) return DEFAULT_LOCALE;
  const seg = pathname.split("/")[1] ?? "";
  return isSupportedLocale(seg) ? seg : DEFAULT_LOCALE;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const locale = pickLocaleFromPath(h.get("x-pathname"));
  return (
    <html lang={locale}>
      <body data-locale={locale}>{children}</body>
    </html>
  );
}
