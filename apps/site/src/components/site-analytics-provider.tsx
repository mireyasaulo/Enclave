"use client";

import { track } from "@yinjie/analytics";
import { AnalyticsProvider } from "@yinjie/analytics/next";
import { useEffect, useMemo } from "react";

export function SiteAnalyticsProvider({ children }: { children?: React.ReactNode }) {
  const endpoint = useMemo(() => {
    if (typeof window === "undefined") return "/telemetry/events/batch";
    return `${window.location.origin}/telemetry/events/batch`;
  }, []);

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
    <AnalyticsProvider appId="site" endpoint={endpoint}>
      {children}
    </AnalyticsProvider>
  );
}
