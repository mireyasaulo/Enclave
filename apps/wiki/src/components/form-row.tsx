import { useEffect, useRef, useState, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";

type FormRowProps = {
  label: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
  /** 该字段对 AI 行为的影响。原本渲染在输入下方，现合并进 ? 气泡的"影响"块。 */
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
  const t = translateRuntimeMessage;
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
        {(hint || effect) && (
          <HintTooltip>
            {hint && <span className="block">{hint}</span>}
            {effect && (
              <span className="mt-1 block text-[color:var(--text-secondary)]">
                <span className="font-semibold">{t(msg`影响：`)}</span>
                {effect}
              </span>
            )}
          </HintTooltip>
        )}
      </span>
      {children}
    </label>
  );
}

function HintTooltip({ children }: { children: ReactNode }) {
  const t = translateRuntimeMessage;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = wrapRef.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={t(msg`说明`)}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setOpen(false);
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full border border-[color:var(--text-muted)]/40 text-[10px] font-semibold leading-none text-[color:var(--text-muted)] transition hover:border-[color:var(--text-secondary)] hover:text-[color:var(--text-secondary)]"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-5 top-full z-20 mt-1 w-max max-w-[240px] whitespace-normal rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-2.5 py-1.5 text-xs font-normal leading-relaxed text-[color:var(--text-primary)] shadow-md"
        >
          {children}
        </span>
      )}
    </span>
  );
}
