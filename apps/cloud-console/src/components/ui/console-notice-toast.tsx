import { InlineNotice } from "@yinjie/ui";
import { useCloudConsoleText } from "../../lib/cloud-console-i18n";
import { useConsoleNotice } from "../console-notice";

export function ConsoleNoticeToast() {
  const t = useCloudConsoleText();
  const { notice } = useConsoleNotice();
  if (!notice) {
    return null;
  }
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:left-auto sm:right-4 sm:top-4 sm:max-w-md sm:justify-end"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full sm:w-auto sm:min-w-[20rem] sm:max-w-md">
        <InlineNotice tone={notice.tone}>
          <div>{notice.message}</div>
          {notice.requestId ? (
            <div className="mt-3 border-t border-current/15 pt-3 text-xs leading-5 text-current/90">
              <div className="uppercase tracking-[0.12em] opacity-80">
                {t("Request id")}
              </div>
              <div className="mt-1 break-all font-mono">{notice.requestId}</div>
            </div>
          ) : null}
        </InlineNotice>
      </div>
    </div>
  );
}
