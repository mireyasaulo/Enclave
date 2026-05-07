"use client";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { SUPPORTED_LOCALES, getLocaleLabel, type SupportedLocale } from "@/lib/locales";
import { swapLocaleInPath } from "@/lib/locale-routing";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageSwitcherLink({ current }: { current: SupportedLocale }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [pending, startTransition] = useTransition();

  function pick(next: SupportedLocale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => {
      router.push(swapLocaleInPath(pathname, next));
    });
  }

  return (
    <select
      aria-label="Language"
      value={current}
      onChange={(e) => pick(e.target.value as SupportedLocale)}
      disabled={pending}
      className="appearance-none rounded-lg border border-(--border-subtle) bg-(--surface-card) px-3 py-1.5 pr-7 text-sm text-(--text-primary) shadow-(--shadow-soft) hover:border-(--brand-primary) transition cursor-pointer focus:outline-none focus:border-(--brand-primary)"
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {getLocaleLabel(loc)}
        </option>
      ))}
    </select>
  );
}
