import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type Crumb = { label: ReactNode; to?: string };

type PageShellProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
  /** When true, renders a tighter centered layout (used by login/register). */
  narrow?: boolean;
};

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  children,
  narrow,
}: PageShellProps) {
  return (
    <div
      className={
        narrow
          ? "mx-auto w-full max-w-md space-y-5 px-4 sm:px-0"
          : "mx-auto w-full space-y-6"
      }
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-[color:var(--text-muted)]">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <span key={idx} className="flex items-center gap-1">
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="hover:text-[color:var(--text-primary)] hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? "text-[color:var(--text-secondary)]"
                        : undefined
                    }
                  >
                    {crumb.label}
                  </span>
                )}
                {!isLast && <span className="opacity-60">/</span>}
              </span>
            );
          })}
        </nav>
      )}
      <header
        className={
          narrow
            ? "space-y-1.5 text-center"
            : "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        }
      >
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--brand-secondary)]">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[1.6rem] font-semibold leading-tight text-[color:var(--text-primary)] sm:text-[1.85rem]">
            {title}
          </h1>
          {description && (
            <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
