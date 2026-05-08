import type {
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

const CONTROL_CLASS =
  "rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-input)] px-4 py-2 text-sm text-[color:var(--text-primary)]";

export function FilterBar({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const composed = className
    ? `flex flex-wrap items-center gap-3 ${className}`
    : "flex flex-wrap items-center gap-3";
  return (
    <div className={composed} {...rest}>
      {children}
    </div>
  );
}

export type FilterSearchProps = InputHTMLAttributes<HTMLInputElement>;

export function FilterSearch({ className, ...rest }: FilterSearchProps) {
  const composed = className
    ? `min-w-[16rem] ${CONTROL_CLASS} placeholder:text-[color:var(--text-muted)] ${className}`
    : `min-w-[16rem] ${CONTROL_CLASS} placeholder:text-[color:var(--text-muted)]`;
  return <input type="search" className={composed} {...rest} />;
}

export type FilterSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function FilterSelect({
  className,
  children,
  ...rest
}: FilterSelectProps) {
  const composed = className ? `${CONTROL_CLASS} ${className}` : CONTROL_CLASS;
  return (
    <select className={composed} {...rest}>
      {children}
    </select>
  );
}

export type FilterButtonGroupItem = {
  value: string;
  label: ReactNode;
};

export type FilterButtonGroupProps = {
  items: ReadonlyArray<FilterButtonGroupItem>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

export function FilterButtonGroup({
  items,
  value,
  onChange,
  ariaLabel,
}: FilterButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const isActive = item.value === value;
        const cls = isActive
          ? "rounded-full border border-[color:var(--border-brand)] bg-[color:var(--surface-card)] px-3 py-1 text-xs font-semibold text-[color:var(--text-primary)] shadow-[var(--shadow-soft)]"
          : "rounded-full border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]";
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isActive}
            className={cls}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type FilterAdvancedProps = {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function FilterAdvanced({
  summary,
  children,
  defaultOpen,
}: FilterAdvancedProps) {
  return (
    <details
      className="group basis-full rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] px-4 py-3"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)] outline-none marker:hidden hover:text-[color:var(--text-primary)]">
        {summary}
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </details>
  );
}
