import { useEffect, useRef } from "react";
import { resolveSupportedLocale, useAppLocale } from "@yinjie/i18n";
import { getWorldLanguage, setWorldLanguage } from "@yinjie/contracts";

type BackendLocaleSyncProps = {
  hasExplicitWebLocalePreference: boolean;
};

// 渲染挂载完成后异步拉一次后端 worldLanguage：
// - 如果用户没显式选过 web locale，且后端语言与当前 locale 不一致，本地软切换
//   到后端语言（不再 notify backend，避免循环）。
// - 如果用户显式选过 web locale，且与后端不一致，反向 push 设置回后端，让
//   下次跨端进来一致。
//
// 这条逻辑原本在 main.tsx 的 bootstrap() 同步链里 await，会把首屏卡在隧道
// RTT 上；改成挂载后再跑就不会阻塞 BootstrapScreen → 应用主体的过渡。
export function BackendLocaleSync({
  hasExplicitWebLocalePreference,
}: BackendLocaleSyncProps) {
  const { locale, syncLocaleFromExternal } = useAppLocale();
  const hasRunRef = useRef(false);
  const localeRef = useRef(locale);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;

    let disposed = false;

    const run = () => {
      void getWorldLanguage()
        .then((config) => resolveSupportedLocale(config.language))
        .then((backendLanguage) => {
          if (disposed || !backendLanguage) {
            return;
          }
          const currentLocale = localeRef.current;
          if (backendLanguage === currentLocale) {
            return;
          }

          if (hasExplicitWebLocalePreference) {
            // 用户在 web 端显式选了语言（query 参数或 localStorage），后端
            // 语言与之不一致 → 把 web 选择推回后端。
            void setWorldLanguage({ language: currentLocale }).catch(() => {});
            return;
          }

          // 没有显式偏好 → 本地软切换到后端语言。
          syncLocaleFromExternal(backendLanguage);
        })
        .catch(() => {});
    };

    type IdleScheduler = {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback: (handle: number) => void;
    };
    const idle = (globalThis as Partial<IdleScheduler>);
    if (typeof idle.requestIdleCallback === "function" && typeof idle.cancelIdleCallback === "function") {
      const handle = idle.requestIdleCallback(run, { timeout: 2000 });
      return () => {
        disposed = true;
        idle.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(run, 0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [hasExplicitWebLocalePreference, syncLocaleFromExternal]);

  return null;
}
