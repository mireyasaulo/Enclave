import type { HTMLAttributes } from "react";

const BASE_CLASS =
  "rounded-[28px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] p-5 shadow-[var(--shadow-section)]";

export type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "article";
};

export function SurfaceCard({
  as = "section",
  className,
  children,
  ...rest
}: SurfaceCardProps) {
  const Tag = as;
  const composed = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  return (
    <Tag className={composed} {...rest}>
      {children}
    </Tag>
  );
}
