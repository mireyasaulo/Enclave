import { useEffect } from "react";
import { msg } from "@lingui/macro";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, QrCode } from "lucide-react";
import { AppPage, cn } from "@yinjie/ui";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AvatarChip } from "../components/avatar-chip";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { navigateBackOrFallback } from "../lib/history-back";
import { useWorldOwnerStore } from "../store/world-owner-store";

export function ProfileInfoPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const username = useWorldOwnerStore((state) => state.username);
  const ownerId = useWorldOwnerStore((state) => state.id);
  const avatar = useWorldOwnerStore((state) => state.avatar);
  const signature = useWorldOwnerStore((state) => state.signature);

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/desktop/settings", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  if (isDesktopLayout) {
    return null;
  }

  const ownerLabel = username ?? t(msg`世界主人`);
  const trimmedSignature = signature?.trim() ?? "";

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`个人信息`)}
        titleAlign="center"
        leftActions={
          <button
            type="button"
            onClick={() =>
              navigateBackOrFallback(
                () => navigate({ to: "/tabs/profile", replace: true }),
                "/tabs/profile",
              )
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-primary)] transition-colors active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </button>
        }
      />

      <div className="pb-8">
        <InfoRowGroup className="mt-1">
          <InfoRow
            label={t(msg`头像`)}
            to="/profile/info/avatar"
            value={
              <AvatarChip name={ownerLabel} src={avatar} size="wechat" />
            }
            denseValue
          />
          <InfoRow
            label={t(msg`名字`)}
            to="/profile/info/name"
            value={
              <span className="truncate text-[14px] text-[color:var(--text-primary)]">
                {ownerLabel}
              </span>
            }
          />
          <InfoRow
            label={t(msg`隐界号`)}
            value={
              <span className="truncate text-[13px] text-[color:var(--text-muted)]">
                {ownerId ?? "—"}
              </span>
            }
            readOnly
          />
          <InfoRow
            label={t(msg`更多信息`)}
            to="/profile/info/more"
          />
        </InfoRowGroup>

        <InfoRowGroup className="mt-2">
          <InfoRow
            label={t(msg`我的二维码名片`)}
            to="/profile/info/qr"
            value={
              <QrCode
                size={16}
                className="text-[color:var(--text-muted)]"
                aria-hidden="true"
              />
            }
          />
        </InfoRowGroup>

        <InfoRowGroup className="mt-2">
          <InfoRow
            label={t(msg`个性签名`)}
            to="/profile/info/signature"
            value={
              <span
                className={cn(
                  "max-w-[55vw] truncate text-[13px]",
                  trimmedSignature
                    ? "text-[color:var(--text-muted)]"
                    : "text-[color:var(--text-dim)]",
                )}
              >
                {trimmedSignature || t(msg`未填写`)}
              </span>
            }
          />
        </InfoRowGroup>
      </div>
    </AppPage>
  );
}

function InfoRowGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden border-y border-[color:var(--border-faint)] divide-y divide-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type InfoRowProps = {
  label: string;
  value?: React.ReactNode;
  to?: string;
  readOnly?: boolean;
  denseValue?: boolean;
};

function InfoRow({
  label,
  value,
  to,
  readOnly,
  denseValue,
}: InfoRowProps) {
  const inner = (
    <>
      <div className="min-w-0 flex-1 text-[15px] text-[color:var(--text-primary)]">
        {label}
      </div>
      {value ? (
        <div
          className={cn(
            "flex shrink-0 items-center justify-end",
            denseValue ? "min-w-0" : "min-w-0 max-w-[60%]",
          )}
        >
          {value}
        </div>
      ) : null}
      {readOnly ? null : (
        <ChevronRight
          size={14}
          className="shrink-0 text-[color:var(--text-dim)]"
          aria-hidden="true"
        />
      )}
    </>
  );

  const cellClass = cn(
    "flex w-full items-center gap-3 px-4 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
    denseValue ? "py-2" : "py-3",
    readOnly ? undefined : "hover:bg-[color:var(--surface-card-hover)]",
  );

  if (readOnly || !to) {
    return <div className={cellClass}>{inner}</div>;
  }

  return (
    <Link to={to as never} className={cellClass}>
      {inner}
    </Link>
  );
}
