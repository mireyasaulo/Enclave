import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, meta }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xl font-semibold text-[color:var(--text-primary)]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
            {subtitle}
          </div>
        ) : null}
      </div>
      {meta || actions ? (
        <div className="flex flex-wrap items-center gap-3">
          {meta ? (
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              {meta}
            </div>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
