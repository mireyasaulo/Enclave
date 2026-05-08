import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AppLocaleProvider } from "@yinjie/i18n";
// cloud-console 的 surface 字典数据在独立 chunk，必须在用 AppLocaleProvider /
// getSurfaceTextDictionary 之前完成 side-effect 注册。其它 surface (app/admin/
// wiki) 不导入这个文件，整坨数据 tree-shake 出去。
import "@yinjie/i18n/runtime/surface-text-dictionaries-cloud-console";
import { LoadingBlock } from "@yinjie/ui";
import "@yinjie/ui/tokens.css";
import "./index.css";
import { queryClient } from "./lib/query-client";
import { router } from "./router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppLocaleProvider
      surface="cloud-console"
      fallback={<LoadingBlock className="m-6" />}
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppLocaleProvider>
  </React.StrictMode>,
);
