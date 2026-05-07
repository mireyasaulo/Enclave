"use client";

import { AnalyticsProvider } from "@yinjie/analytics/next";
import { useMemo } from "react";

export function SiteAnalyticsProvider({ children }: { children?: React.ReactNode }) {
  const endpoint = useMemo(() => {
    if (typeof window === "undefined") return "/telemetry/events/batch";
    return `${window.location.origin}/telemetry/events/batch`;
  }, []);
  return (
    <AnalyticsProvider appId="site" endpoint={endpoint}>
      {children}
    </AnalyticsProvider>
  );
}
