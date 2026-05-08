import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

export type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  minWidth?: string;
};

export function DataTable({
  minWidth = "min-w-[72rem]",
  className,
  children,
  ...rest
}: DataTableProps) {
  const composed = className
    ? `${minWidth} border-collapse text-left text-sm ${className}`
    : `${minWidth} border-collapse text-left text-sm`;
  return (
    <table className={composed} {...rest}>
      {children}
    </table>
  );
}

export function DataTableScroll({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const composed = className
    ? `overflow-x-auto ${className}`
    : "overflow-x-auto";
  return (
    <div className={composed} {...rest}>
      {children}
    </div>
  );
}

export function DataTableHead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  const composed = className
    ? `bg-[color:var(--surface-soft)] text-[color:var(--text-muted)] ${className}`
    : "bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]";
  return (
    <thead className={composed} {...rest}>
      {children}
    </thead>
  );
}

export function DataTableHeaderCell({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableCellElement>) {
  const composed = className
    ? `px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] ${className}`
    : "px-4 py-3 text-xs font-medium uppercase tracking-[0.18em]";
  return (
    <th className={composed} {...rest}>
      {children}
    </th>
  );
}

export function DataTableRow({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  const composed = className
    ? `border-t border-[color:var(--border-faint)] ${className}`
    : "border-t border-[color:var(--border-faint)]";
  return (
    <tr className={composed} {...rest}>
      {children}
    </tr>
  );
}

export type DataTableMessageRowProps = {
  colSpan: number;
  children: ReactNode;
};

export function DataTableMessageRow({
  colSpan,
  children,
}: DataTableMessageRowProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-6 text-center text-sm text-[color:var(--text-muted)]"
      >
        {children}
      </td>
    </tr>
  );
}
