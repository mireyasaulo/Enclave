"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 注册放到 load 事件之后，不和首屏抢资源
    const handler = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        // 静默失败：SW 不是关键路径，不该阻塞或污染控制台
        if (process.env.NODE_ENV === "development") {
          console.warn("[sw] register failed", err);
        }
      });
    };
    if (document.readyState === "complete") {
      handler();
    } else {
      window.addEventListener("load", handler, { once: true });
      return () => window.removeEventListener("load", handler);
    }
  }, []);

  return null;
}
