import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Copy, QrCode } from "lucide-react";
import { AppPage, cn } from "@yinjie/ui";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AvatarChip } from "../components/avatar-chip";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { navigateBackOrFallback } from "../lib/history-back";
import { buildYinjieId } from "../lib/yinjie-id";
import { writeClipboardText } from "../runtime/native-clipboard";
import { useWorldOwnerStore } from "../store/world-owner-store";

export function ProfileInfoPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const username = useWorldOwnerStore((state) => state.username);
  const ownerId = useWorldOwnerStore((state) => state.id);
  const avatar = useWorldOwnerStore((state) => state.avatar);
  const signature = useWorldOwnerStore((state) => state.signature);
  // 隐界号像微信号一样要能复制给好友——之前这一行是 readOnly、点不动也长按
  // 没菜单（mobile webview 长按选中文本经常被 yj-no-callout 一类的祖先样式吃掉），
  // 用户想分享给朋友只能在 Welcome 页拼一次拿到。给它配 toast 短反馈，{key} 走
  // mobile-moments-publish-page 同款 setTimeout 重置，连点也稳。
  const [toast, setToast] = useState<{ message: string; key: number } | null>(
    null,
  );
  const toastKeyRef = useRef(0);
  function showToast(message: string) {
    toastKeyRef.current += 1;
    setToast({ message, key: toastKeyRef.current });
  }
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast?.key]);

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/desktop/settings", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  if (isDesktopLayout) {
    return null;
  }

  // 后端早期数据里有过 username = "" 的脏行，?? 只兜 null/undefined，会
  // 让空串穿透下来 → AvatarChip alt / 名字行都渲染成空。用 || 把空串也
  // 一起 fallback 到「世界主人」。
  const ownerLabel = username?.trim() || t(msg`世界主人`);
  const trimmedSignature = signature?.trim() ?? "";
  const yinjieIdText = ownerId ? buildYinjieId(ownerId) : null;

  async function handleCopyYinjieId() {
    if (!yinjieIdText) {
      return;
    }
    const copied = await writeClipboardText(yinjieIdText);
    showToast(copied ? t(msg`已复制隐界号`) : t(msg`复制失败，请重试`));
  }

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
          {yinjieIdText ? (
            <InfoRow
              label={t(msg`隐界号`)}
              value={
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="truncate text-[13px] text-[color:var(--text-muted)]"
                    data-i18n-skip="true"
                  >
                    {yinjieIdText}
                  </span>
                  <Copy
                    size={13}
                    className="shrink-0 text-[color:var(--text-dim)]"
                    aria-hidden="true"
                  />
                </span>
              }
              onClick={() => {
                void handleCopyYinjieId();
              }}
              ariaLabel={t(msg`复制隐界号`)}
            />
          ) : (
            <InfoRow
              label={t(msg`隐界号`)}
              value={
                <span className="truncate text-[13px] text-[color:var(--text-muted)]">
                  {t(msg`未生成`)}
                </span>
              }
              readOnly
            />
          )}
          <InfoRow
            label={t(msg`更多信息`)}
            to="/profile/info/more"
            value={
              <span className="truncate text-[12px] text-[color:var(--text-dim)]">
                {t(msg`敬请期待`)}
              </span>
            }
          />
        </InfoRowGroup>

        <InfoRowGroup className="mt-2">
          <InfoRow
            label={t(msg`我的二维码名片`)}
            to="/profile/info/qr"
            value={
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] text-[color:var(--text-dim)]">
                  {t(msg`敬请期待`)}
                </span>
                <QrCode
                  size={16}
                  className="text-[color:var(--text-muted)]"
                  aria-hidden="true"
                />
              </span>
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

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] z-[1100] flex justify-center">
          <div className="rounded-[6px] bg-black/72 px-3 py-1.5 text-[13px] text-white">
            {toast.message}
          </div>
        </div>
      ) : null}
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
  // onClick：纯按钮型行（如「点一下复制隐界号」），不导航也不是 readOnly。
  // 跟 to 互斥；同时传时 onClick 优先。
  onClick?: () => void;
  ariaLabel?: string;
};

function InfoRow({
  label,
  value,
  to,
  readOnly,
  denseValue,
  onClick,
  ariaLabel,
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
      {readOnly || onClick ? null : (
        <ChevronRight
          size={14}
          className="shrink-0 text-[color:var(--text-dim)]"
          aria-hidden="true"
        />
      )}
    </>
  );

  const interactive = !readOnly && (Boolean(to) || Boolean(onClick));
  const cellClass = cn(
    "flex w-full items-center gap-3 px-4 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
    denseValue ? "py-2" : "py-3",
    interactive ? "hover:bg-[color:var(--surface-card-hover)]" : undefined,
  );

  if (onClick && !readOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(cellClass, "active:bg-[color:var(--surface-card-hover)]")}
      >
        {inner}
      </button>
    );
  }

  if (readOnly || !to) {
    return <div className={cellClass}>{inner}</div>;
  }

  return (
    <Link to={to as never} className={cellClass}>
      {inner}
    </Link>
  );
}
