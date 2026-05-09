import type { CloudAdminSessionSourceGroupRiskSignal } from "@yinjie/contracts";
import { formatAdminSessionSourceGroupRiskSignalLabel } from "../lib/admin-session-helpers";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

type AdminSessionSourceGroupRiskSignalsProps = {
  signals: CloudAdminSessionSourceGroupRiskSignal[];
  keyPrefix: string;
  className?: string;
  pillClassName?: string;
  emptyMessage?: string | null;
  emptyClassName?: string;
};

export function AdminSessionSourceGroupRiskSignals({
  signals,
  keyPrefix,
  className = "flex flex-wrap gap-2 text-[11px] text-[color:var(--text-secondary)]",
  pillClassName = "rounded-full border border-[color:var(--border-faint)] px-2 py-1",
  emptyMessage,
  emptyClassName = "text-[11px] text-[color:var(--text-muted)]",
}: AdminSessionSourceGroupRiskSignalsProps) {
  const t = useCloudConsoleText();

  if (!signals.length) {
    return emptyMessage ? <div className={emptyClassName}>{emptyMessage}</div> : null;
  }

  return (
    <div className={className}>
      {signals.map((signal) => (
        <span key={`${keyPrefix}-${signal}`} className={pillClassName}>
          {t(formatAdminSessionSourceGroupRiskSignalLabel(signal))}
        </span>
      ))}
    </div>
  );
}
