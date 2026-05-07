import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/lib/locales";

const BASE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.enclave.top").replace(/\/+$/, "");

const PATHS = ["", "download", "privacy", "terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return SUPPORTED_LOCALES.flatMap((locale) =>
    PATHS.map((p) => {
      const url = `${BASE_URL}/${locale}${p ? `/${p}` : ""}`;
      return {
        url,
        lastModified: now,
        changeFrequency: p === "" ? ("weekly" as const) : ("monthly" as const),
        priority: p === "" ? 1 : 0.6,
        alternates: {
          languages: Object.fromEntries(
            SUPPORTED_LOCALES.map((l) => [
              l,
              `${BASE_URL}/${l}${p ? `/${p}` : ""}`,
            ]),
          ),
        },
      };
    }),
  );
}
