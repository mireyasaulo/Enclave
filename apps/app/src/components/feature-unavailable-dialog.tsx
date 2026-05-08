import { useEffect } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { Button } from "@yinjie/ui";

const t = translateRuntimeMessage;

type FeatureUnavailableDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  confirmLabel?: string;
};

export function FeatureUnavailableDialog({
  open,
  title,
  description,
  onClose,
  confirmLabel,
}: FeatureUnavailableDialogProps) {
  const resolvedConfirmLabel = confirmLabel ?? t(msg`我知道了`);
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(17,24,39,0.32)] p-6 backdrop-blur-[3px]">
      <button
        type="button"
        aria-label={t(msg`关闭提示`)}
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative w-full max-w-[360px] overflow-hidden rounded-[20px] border border-[color:var(--border-faint)] bg-white shadow-[var(--shadow-overlay)]">
        <div className="px-6 pb-2 pt-6 text-center">
          <div className="text-[16px] font-medium text-[color:var(--text-primary)]">
            {title}
          </div>
          <div className="mt-3 text-[13px] leading-6 text-[color:var(--text-muted)]">
            {description}
          </div>
        </div>
        <div className="border-t border-[color:var(--border-faint)] px-4 pb-4 pt-3">
          <Button
            type="button"
            variant="primary"
            onClick={onClose}
            className="w-full rounded-[12px] bg-[color:var(--brand-primary)] py-2 text-white shadow-none hover:opacity-95"
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
