import type { HTMLAttributes, ReactNode } from "react";

export type MetricCardTone = "default" | "success" | "warning" | "danger" | "muted";

const VALUE_TONE: Record<MetricCardTone, string> = {
  default: "text-[color:var(--text-primary)]",
  success: "text-[color:var(--state-success-text)]",
  warning: "text-[color:var(--state-warning-text)]",
  danger: "text-[color:var(--state-danger-text)]",
  muted: "text-[color:var(--text-muted)]",
};

export type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  tone?: MetricCardTone;
  valueClassName?: string;
  className?: string;
};

export function MetricCard({
  label,
  value,
  description,
  tone = "default",
  valueClassName,
  className,
}: MetricCardProps) {
  const wrapClass = className
    ? `rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4 ${className}`
    : "rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4";
  const valueClass = valueClassName
    ? `mt-2 text-3xl font-semibold ${valueClassName}`
    : `mt-2 text-3xl font-semibold ${VALUE_TONE[tone]}`;
  return (
    <div className={wrapClass}>
      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className={valueClass}>{value}</div>
      {description ? (
        <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
          {description}
        </div>
      ) : null}
    </div>
  );
}

export type MetricCardGridProps = HTMLAttributes<HTMLDivElement> & {
  cols?: 2 | 3 | 4;
  compact?: boolean;
};

const COLS_CLASS: Record<2 | 3 | 4, string> = {
  2: "grid gap-3 md:grid-cols-2",
  3: "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
  4: "grid gap-3 md:grid-cols-2 xl:grid-cols-4",
};

export function MetricCardGrid({
  cols = 4,
  compact,
  className,
  children,
  ...rest
}: MetricCardGridProps) {
  const base = COLS_CLASS[cols];
  const top = compact ? "" : "mt-5 ";
  const composed = className ? `${top}${base} ${className}` : `${top}${base}`;
  return (
    <div className={composed} {...rest}>
      {children}
    </div>
  );
}
