"use client";
import { usePathname } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import {
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  getLocaleLabel,
  type SupportedLocale,
} from "@/lib/locales";
import { swapLocaleInPath } from "@/lib/locale-routing";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Crawler-friendly language switcher.
 *
 * Renders 4 real <a href hreflang> links inside a CSS-only <details>
 * disclosure so search engines can follow each language variant
 * directly (in addition to the <link rel="alternate" hreflang> tags
 * already in the page head). The previous <select onChange> implementation
 * hid the URLs from non-JS crawlers entirely.
 *
 * Cookie persistence is preserved via an onClick handler that runs
 * before navigation (Next.js Link allows onClick + href).
 */
export function LanguageSwitcherLink({
  current,
  ariaLabel,
}: {
  current: SupportedLocale;
  ariaLabel: string;
}) {
  const pathname = usePathname() ?? "/";

  function persistLocale(next: SupportedLocale) {
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-(--border-subtle) bg-(--surface-card) px-3 py-1.5 text-sm text-(--text-primary) shadow-(--shadow-soft) transition hover:border-(--brand-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-primary)"
        aria-label={ariaLabel}
      >
        <span>{getLocaleLabel(current)}</span>
        <ChevronDown size={14} className="shrink-0 transition group-open:rotate-180" />
      </summary>
      <ul
        role="menu"
        className="absolute right-0 top-full z-50 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-(--border-subtle) bg-(--surface-card) shadow-(--shadow-overlay)"
      >
        {SUPPORTED_LOCALES.map((loc) => {
          const isCurrent = loc === current;
          const href = swapLocaleInPath(pathname, loc);
          return (
            <li key={loc} role="none">
              <a
                href={href}
                hrefLang={loc}
                rel="alternate"
                role="menuitem"
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => persistLocale(loc)}
                className={
                  isCurrent
                    ? "flex items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-(--brand-primary) bg-(--surface-soft)"
                    : "flex items-center justify-between gap-2 px-4 py-2 text-sm text-(--text-primary) hover:bg-(--surface-soft) hover:text-(--brand-primary)"
                }
              >
                <span>{getLocaleLabel(loc)}</span>
                {isCurrent ? <Check size={14} aria-hidden="true" /> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
