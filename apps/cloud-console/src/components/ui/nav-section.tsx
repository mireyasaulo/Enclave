import type { ReactNode } from "react";

export type NavSectionProps = {
  title: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function NavSection({
  title,
  collapsible,
  defaultOpen = true,
  children,
}: NavSectionProps) {
  const heading = (
    <div className="px-1 text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
      {title}
    </div>
  );
  if (collapsible) {
    return (
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer select-none items-center justify-between px-1 text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-muted)] outline-none marker:hidden hover:text-[color:var(--text-primary)]">
          <span>{title}</span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="mt-2 space-y-1">{children}</div>
      </details>
    );
  }
  return (
    <div>
      {heading}
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}
