import { Fragment, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { Link } from "@tanstack/react-router";
import { LanguageSwitcher, translateRuntimeMessage } from "@yinjie/i18n";
import type { AdminDensity } from "../lib/use-density";
import type { BreadcrumbItem } from "../lib/route-breadcrumb";
import { WorldLanguageSwitcher } from "./world-language-switcher";

type AdminTopbarProps = {
  breadcrumb: BreadcrumbItem[];
  statusLabel: ReactNode;
  statusTone: "healthy" | "warning" | "muted";
  statusDetailLabel?: ReactNode;
  density: AdminDensity;
  onDensityChange: (density: AdminDensity) => void;
  onMobileNavOpen: () => void;
};

const DENSITY_ORDER: AdminDensity[] = ["compact", "standard", "spacious"];

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[color:var(--text-dim)]"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function AdminTopbar({
  breadcrumb,
  statusLabel,
  statusTone,
  statusDetailLabel,
  density,
  onDensityChange,
  onMobileNavOpen,
}: AdminTopbarProps) {
  const t = translateRuntimeMessage;

  const densityLabels: Record<AdminDensity, string> = {
    compact: t(msg`紧凑`),
    standard: t(msg`标准`),
    spacious: t(msg`宽松`),
  };

  const statusClasses =
    statusTone === "healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[color:var(--border-subtle)] bg-[color:var(--surface-primary)] text-[color:var(--text-muted)]";

  return (
    <header className="rounded-[28px] border border-[color:var(--border-faint)] bg-[rgba(255,255,255,0.78)] px-3 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur sm:px-5 sm:py-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        {/* Left: hamburger + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={t(msg`打开导航`)}
            onClick={onMobileNavOpen}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-primary)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)] lg:hidden"
          >
            <HamburgerIcon />
          </button>
          <nav
            aria-label={t(msg`面包屑`)}
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          >
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <Fragment key={index}>
                  {index > 0 ? <ChevronRightIcon /> : null}
                  {item.to && !isLast ? (
                    <Link
                      to={item.to as never}
                      className="truncate text-[13px] text-[color:var(--text-muted)] transition hover:text-[color:var(--text-primary)]"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "truncate text-[15px] font-semibold text-[color:var(--text-primary)] sm:text-[16px]"
                          : "truncate text-[13px] text-[color:var(--text-muted)]"
                      }
                    >
                      {item.label}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: density + lang + status */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
          <div
            role="group"
            aria-label={t(msg`显示密度`)}
            className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-primary)] p-0.5 text-xs"
          >
            {DENSITY_ORDER.map((value) => {
              const active = value === density;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onDensityChange(value)}
                  className={
                    active
                      ? "rounded-full bg-[color:var(--brand-primary)] px-2.5 py-0.5 text-[12px] font-medium text-white shadow-sm"
                      : "rounded-full px-2.5 py-0.5 text-[12px] text-[color:var(--text-muted)] transition hover:text-[color:var(--text-primary)]"
                  }
                >
                  {densityLabels[value]}
                </button>
              );
            })}
          </div>
          <LanguageSwitcher variant="compact" description={null} />
          <WorldLanguageSwitcher />
          <div
            className={`max-w-full rounded-full border px-3 py-1 text-center text-[12px] font-medium ${statusClasses}`}
            title={
              typeof statusDetailLabel === "string"
                ? statusDetailLabel
                : undefined
            }
          >
            {statusLabel}
          </div>
        </div>
      </div>
    </header>
  );
}
