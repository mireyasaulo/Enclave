import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/lib/locales";
import { SITE_BASE_URL } from "@/lib/seo-metadata";
import { siteLinks } from "@/lib/site-links";
import { SiteAnalyticsProvider } from "@/components/site-analytics-provider";
import "./globals.css";

// Origin for preconnect/dns-prefetch — strip path/query, keep scheme + host + port.
const SAAS_ORIGIN = (() => {
  try {
    return new URL(siteLinks.app).origin;
  } catch {
    return null;
  }
})();

// Verification codes are env-driven — set the env in production and they
// emit; leave unset and the meta tags are simply omitted.
const verificationOther: Record<string, string> = {};
if (process.env.NEXT_PUBLIC_VERIFY_BAIDU) {
  verificationOther["baidu-site-verification"] = process.env.NEXT_PUBLIC_VERIFY_BAIDU;
}
if (process.env.NEXT_PUBLIC_VERIFY_BING) {
  verificationOther["msvalidate.01"] = process.env.NEXT_PUBLIC_VERIFY_BING;
}
if (process.env.NEXT_PUBLIC_VERIFY_360) {
  verificationOther["360-site-verification"] = process.env.NEXT_PUBLIC_VERIFY_360;
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE_URL),
  applicationName: "Enclave",
  appleWebApp: {
    capable: true,
    title: "Enclave",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_VERIFY_GOOGLE,
    yandex: process.env.NEXT_PUBLIC_VERIFY_YANDEX,
    other: Object.keys(verificationOther).length ? verificationOther : undefined,
  },
  other: {
    "msapplication-TileColor": "#f97316",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
      <head>
        {SAAS_ORIGIN ? (
          <>
            <link rel="preconnect" href={SAAS_ORIGIN} />
            <link rel="dns-prefetch" href={SAAS_ORIGIN} />
          </>
        ) : null}
      </head>
      <body data-locale={locale}>
        <SiteAnalyticsProvider>{children}</SiteAnalyticsProvider>
      </body>
    </html>
  );
}
