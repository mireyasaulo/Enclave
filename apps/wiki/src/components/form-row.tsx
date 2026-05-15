import type { ReactNode } from "react";
import { HintTooltip } from "./hint-tooltip";

type FormRowProps = {
  label: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
  /** 该字段对 AI 行为的影响（渲染在输入下方，独立一行）。可选。 */
  effect?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormRow({
  label,
  hint,
  badge,
  effect,
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
        {hint && <HintTooltip>{hint}</HintTooltip>}
      </span>
      {children}
      {effect && (
        <span className="mt-1 block text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
          {effect}
        </span>
      )}
    </label>
  );
}
