import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/lib/locales";
import { SITE_BASE_URL } from "@/lib/seo-metadata";

const PATHS = ["", "download", "privacy", "terms"] as const;

// Per-route lastmod. Bump the date when the corresponding page's content
// actually changes — using `new Date()` would reset on every build and
// signal stale-but-resaved content to crawlers (anti-pattern for SEO).
const LAST_MOD_BY_PATH: Record<(typeof PATHS)[number], string> = {
  "": "2026-05-07",
  download: "2026-05-07",
  privacy: "2026-05-07",
  terms: "2026-05-07",
};

export default function sitemap(): MetadataRoute.Sitemap {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    PATHS.map((p) => {
      const url = `${SITE_BASE_URL}/${locale}${p ? `/${p}` : ""}`;
      return {
        url,
        lastModified: LAST_MOD_BY_PATH[p],
        changeFrequency: p === "" ? ("weekly" as const) : ("monthly" as const),
        priority: p === "" ? 1 : 0.6,
        alternates: {
          languages: Object.fromEntries(
            SUPPORTED_LOCALES.map((l) => [
              l,
              `${SITE_BASE_URL}/${l}${p ? `/${p}` : ""}`,
            ]),
          ),
        },
      };
    }),
  );
}
