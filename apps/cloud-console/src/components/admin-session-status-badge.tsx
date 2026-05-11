import type { CloudAdminSessionStatus } from "@yinjie/contracts";
import {
  formatAdminSessionStatusLabel,
  getAdminSessionStatusTone,
  getAdminSessionStatusToneStyles,
} from "../lib/admin-session-helpers";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

type AdminSessionStatusBadgeProps = {
  status: CloudAdminSessionStatus;
  className?: string;
};

export function AdminSessionStatusBadge({
  status,
  className,
}: AdminSessionStatusBadgeProps) {
  const t = useCloudConsoleText();
  const tone = getAdminSessionStatusTone(status);
  const toneStyles = getAdminSessionStatusToneStyles(status);

  return (
    <span
      data-tone={tone}
      className={`rounded-full border ${toneStyles.badge}${className ? ` ${className}` : ""}`}
    >
      {t(formatAdminSessionStatusLabel(status))}
    </span>
  );
}
