"use client";

import { useEffect, useRef } from "react";
import { init, isInitialized, trackPageView } from "./index";
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

    const onPopState = () => {
      // SPA route change in Next App Router emits popstate after navigation.
      queueMicrotask(() => trackPageView());
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
