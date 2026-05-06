import type { ReactNode } from "react";

type FormRowProps = {
  label: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormRow({
  label,
  hint,
  badge,
  required,
  children,
  className,
}: FormRowProps) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[color:var(--text-primary)]">
        <span>
          {label}
          {required && (
            <span className="ml-1 text-[color:var(--state-danger-text)]">
              *
            </span>
          )}
        </span>
        {badge}
        {hint && (
          <span className="text-xs font-normal text-[color:var(--text-muted)]">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
