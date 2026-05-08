"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import type { SupportedLocale } from "@/lib/locales";
import { buildLocalePath } from "@/lib/locale-routing";
import { siteLinks } from "@/lib/site-links";

type Labels = {
  capabilities: string;
  crossPlatform: string;
  faq: string;
  download: string;
  startNow: string;
  menuOpen: string;
  menuClose: string;
};

export function SiteMobileMenu({
  locale,
  labels,
}: {
  locale: SupportedLocale;
  labels: Labels;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const home = buildLocalePath(locale, "/");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDocClick = (e: MouseEvent) => {
      if (!el.open) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      el.open = false;
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function close() {
    if (ref.current) ref.current.open = false;
  }

  return (
    <details ref={ref} className="group relative md:hidden">
      <summary
        aria-label={labels.menuOpen}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-(--border-subtle) bg-(--surface-card) text-(--text-primary) shadow-(--shadow-soft) transition hover:border-(--brand-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-primary)"
      >
        <Menu size={18} className="block group-open:hidden" />
        <X size={18} className="hidden group-open:block" aria-label={labels.menuClose} />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--surface-card) shadow-(--shadow-overlay)">
        <ul className="flex flex-col py-2 text-sm text-(--text-primary)">
          <li>
            <a
              href={`${home}#capabilities`}
              onClick={close}
              className="block px-4 py-2.5 transition hover:bg-(--surface-soft) hover:text-(--brand-primary)"
            >
              {labels.capabilities}
            </a>
          </li>
          <li>
            <a
              href={`${home}#cross-platform`}
              onClick={close}
              className="block px-4 py-2.5 transition hover:bg-(--surface-soft) hover:text-(--brand-primary)"
            >
              {labels.crossPlatform}
            </a>
          </li>
          <li>
            <a
              href={`${home}#faq`}
              onClick={close}
              className="block px-4 py-2.5 transition hover:bg-(--surface-soft) hover:text-(--brand-primary)"
            >
              {labels.faq}
            </a>
          </li>
          <li>
            <Link
              href={buildLocalePath(locale, "/download")}
              onClick={close}
              className="block px-4 py-2.5 transition hover:bg-(--surface-soft) hover:text-(--brand-primary)"
            >
              {labels.download}
            </Link>
          </li>
        </ul>
        <div className="border-t border-(--border-faint) p-3">
          <a
            href={siteLinks.app}
            target="_blank"
            rel="noreferrer"
            data-cta="signup"
            data-cta-location="mobile_menu"
            onClick={close}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-(--brand-primary) px-3 py-2 text-sm font-semibold text-white shadow-(--shadow-soft) transition hover:bg-(--brand-secondary)"
          >
            {labels.startNow}
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </details>
  );
}
