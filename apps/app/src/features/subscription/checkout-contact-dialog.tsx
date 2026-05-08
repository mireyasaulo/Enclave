import { useCallback, useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, InlineNotice } from "@yinjie/ui";

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

const EMAIL_REGEX = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const WECHAT_REGEX = /(?:微信号|微信|wechat|WeChat|WECHAT)\s*[:：]?\s*([A-Za-z][A-Za-z0-9_-]{4,29})/g; // i18n-ignore-line

type ContactItem = {
  label: string;
  value: string;
  successMessage: string;
};

function extractContacts(
  text: string,
  t: ReturnType<typeof useRuntimeTranslator>,
): ContactItem[] {
  const items: ContactItem[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(WECHAT_REGEX)) {
    const value = match[1];
    if (!value || seen.has(`wechat:${value}`)) continue;
    seen.add(`wechat:${value}`);
    items.push({
      label: t(msg`微信号`),
      value,
      successMessage: t(msg`已复制微信号`),
    });
  }

  for (const match of text.matchAll(EMAIL_REGEX)) {
    const value = match[0];
    if (!value || seen.has(`email:${value}`)) continue;
    seen.add(`email:${value}`);
    items.push({
      label: t(msg`邮箱`),
      value,
      successMessage: t(msg`已复制邮箱`),
    });
  }

  return items;
}

type CheckoutContactDialogProps = {
  open: boolean;
  hint: string;
  contact: string;
  planName?: string;
  onClose: () => void;
};

export function CheckoutContactDialog({
  open,
  hint,
  contact,
  planName,
  onClose,
}: CheckoutContactDialogProps) {
  const t = useRuntimeTranslator();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    message: string;
  } | null>(null);

  const combinedText = useMemo(
    () => [hint, contact].filter(Boolean).join(" ").trim(),
    [hint, contact],
  );

  const contacts = useMemo(
    () => extractContacts(`${hint} ${contact}`, t),
    [hint, contact, t],
  );

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleCopy = useCallback(
    async (text: string, successMessage: string) => {
      const ok = await copyTextToClipboard(text);
      setFeedback({
        tone: ok ? "success" : "danger",
        message: ok ? successMessage : t(msg`复制失败，请手动选中复制。`),
      });
    },
    [t],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(17,24,39,0.45)] p-4 backdrop-blur-[3px] sm:items-center">
      <button
        type="button"
        aria-label={t(msg`关闭弹窗`)}
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative w-full max-w-[400px] overflow-hidden rounded-[24px] border border-[color:var(--border-faint)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="px-6 pt-6 pb-2">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
            {t(msg`联系开通`)}
          </div>
          <h2 className="mt-2 text-[18px] font-semibold text-[color:var(--text-primary)]">
            {planName
              ? t(msg`开通 ${planName}`)
              : t(msg`联系运营开通会员`)}
          </h2>
          {hint ? (
            <p className="mt-3 text-[13px] leading-6 text-[color:var(--text-secondary)]">
              {hint}
            </p>
          ) : null}
        </div>

        {contacts.length ? (
          <div className="px-6 pt-3 pb-2 space-y-2">
            {contacts.map((item) => (
              <div
                key={`${item.label}:${item.value}`}
                className="flex items-center justify-between gap-3 rounded-[14px] bg-[#f6f7f7] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-[color:var(--text-muted)]">
                    {item.label}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-[color:var(--text-primary)]">
                    {item.value}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 py-1.5 text-[12px] shadow-none"
                  onClick={() => void handleCopy(item.value, item.successMessage)}
                >
                  {t(msg`复制`)}
                </Button>
              </div>
            ))}
          </div>
        ) : contact ? (
          <div className="px-6 pt-3 pb-2">
            <div className="rounded-[14px] bg-[#f6f7f7] px-3 py-2 text-[13px] leading-6 break-all text-[color:var(--text-secondary)]">
              {contact}
            </div>
          </div>
        ) : null}

        {feedback ? (
          <div className="px-6 pt-2">
            <InlineNotice tone={feedback.tone}>{feedback.message}</InlineNotice>
          </div>
        ) : null}

        <div className="mt-4 flex gap-3 border-t border-[color:var(--border-faint)] px-4 py-3">
          {combinedText ? (
            <Button
              type="button"
              variant="secondary"
              className="flex-1 rounded-[12px] border-[color:var(--border-faint)] bg-[#f5f5f5] py-2 shadow-none"
              onClick={() =>
                void handleCopy(combinedText, t(msg`已复制全部信息。`))
              }
            >
              {t(msg`复制全部`)}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            className="flex-1 rounded-[12px] bg-[#07c160] py-2 text-white shadow-none hover:bg-[#06ad56]"
            onClick={onClose}
          >
            {t(msg`我知道了`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
