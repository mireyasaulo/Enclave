"use client";

import { track } from "@yinjie/analytics";
import { AnalyticsProvider } from "@yinjie/analytics/next";
import { useEffect } from "react";

// Telemetry endpoint defaults to the same-origin /telemetry/events/batch
// path; next.config.ts rewrites that to cloud-api. Set
// NEXT_PUBLIC_TELEMETRY_ENDPOINT to a fully-qualified URL only when the
// rewrite is unavailable (e.g. fully static export deployed without Next).
const ENDPOINT =
  process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT ?? "/telemetry/events/batch";

export function SiteAnalyticsProvider({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLElement>("[data-cta]");
      if (!link) return;
      const cta = link.dataset.cta;
      if (!cta) return;
      track(`cta_${cta}_click`, {
        href: link.getAttribute("href"),
        location: link.dataset.ctaLocation ?? null,
      });
    };
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, []);

  return (
    <AnalyticsProvider appId="site" endpoint={ENDPOINT}>
      {children}
    </AnalyticsProvider>
  );
}
