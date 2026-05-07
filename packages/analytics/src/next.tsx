"use client";

import { useEffect, useRef } from "react";
import { init, isInitialized } from "./index";
import type { InitOptions } from "./types";

export interface AnalyticsProviderProps extends InitOptions {
  children?: React.ReactNode;
}

export function AnalyticsProvider({ children, ...options }: AnalyticsProviderProps) {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (!isInitialized()) {
      init(options);
    }
    // No popstate listener here — auto-page-view (enabled by default)
    // already patches history.{pushState,replaceState} and listens to
    // popstate, so adding our own here would emit duplicate page_view
    // events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
