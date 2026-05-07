"use client";

import { track } from "@yinjie/analytics";
import { AnalyticsProvider } from "@yinjie/analytics/next";
import { useEffect } from "react";

// Telemetry endpoint is opt-in via env. Marketing site lives on a different
// origin than cloud-api, so the previous same-origin POST silently 404'd
// every CTA click. Set NEXT_PUBLIC_TELEMETRY_ENDPOINT in production to a
// fully-qualified URL (e.g. https://api.enclave.top/telemetry/events/batch)
// to enable click tracking.
const ENDPOINT = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT ?? null;

export function SiteAnalyticsProvider({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    if (!ENDPOINT) return;
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

  if (!ENDPOINT) return <>{children}</>;

  return (
    <AnalyticsProvider appId="site" endpoint={ENDPOINT}>
      {children}
    </AnalyticsProvider>
  );
}
