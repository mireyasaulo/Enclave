import type { CloudAdminSessionSourceGroupRiskLevel } from "@yinjie/contracts";
import {
  formatAdminSessionSourceGroupRiskLevelLabel,
  getAdminSessionSourceGroupRiskTone,
  getAdminSessionSourceGroupRiskToneStyles,
} from "../lib/admin-session-helpers";
import { useCloudConsoleText } from "../lib/cloud-console-i18n";

type AdminSessionSourceGroupRiskBadgeProps = {
  riskLevel: CloudAdminSessionSourceGroupRiskLevel;
  className?: string;
};

export function AdminSessionSourceGroupRiskBadge({
  riskLevel,
  className,
}: AdminSessionSourceGroupRiskBadgeProps) {
  const t = useCloudConsoleText();
  const tone = getAdminSessionSourceGroupRiskTone(riskLevel);
  const toneStyles = getAdminSessionSourceGroupRiskToneStyles(riskLevel);

  return (
    <span
      data-tone={tone}
      className={`rounded-full border ${toneStyles.badge}${className ? ` ${className}` : ""}`}
    >
      {t(formatAdminSessionSourceGroupRiskLevelLabel(riskLevel))}
    </span>
  );
}
