import type { ReactNode } from "react";
import { CloudAdminErrorBlock } from "../cloud-admin-error-block";

export type DataStateProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  loading?: ReactNode;
  empty?: ReactNode;
  errorFallback?: (error: unknown) => ReactNode;
  children: ReactNode;
};

const DEFAULT_ROW_CLASS =
  "rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] px-4 py-6 text-center text-sm text-[color:var(--text-muted)]";

export function DataState({
  isLoading,
  isError,
  error,
  isEmpty,
  loading,
  empty,
  errorFallback,
  children,
}: DataStateProps) {
  if (isLoading) {
    return <div className={DEFAULT_ROW_CLASS}>{loading ?? "Loading..."}</div>;
  }
  if (isError) {
    return errorFallback ? (
      <>{errorFallback(error)}</>
    ) : (
      <CloudAdminErrorBlock error={error} />
    );
  }
  if (isEmpty) {
    return <div className={DEFAULT_ROW_CLASS}>{empty ?? "No items."}</div>;
  }
  return <>{children}</>;
}
