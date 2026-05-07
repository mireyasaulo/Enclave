import { useEffect } from "react";
import { msg } from "@lingui/macro";
import { useNavigate } from "@tanstack/react-router";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, Button } from "@yinjie/ui";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { SubscriptionPanel } from "../features/subscription/subscription-panel";
import { clearCloudRuntimeSession } from "../lib/cloud-session";
import { useCloudSessionStore } from "../store/cloud-session-store";

export function ProfileSubscriptionPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const accessToken = useCloudSessionStore((state) => state.accessToken);

  useEffect(() => {
    if (accessToken) {
      return;
    }

    clearCloudRuntimeSession();
    void navigate({ to: "/welcome", replace: true });
  }, [accessToken, navigate]);

  function handleCloudLogout() {
    clearCloudRuntimeSession();
    void navigate({ to: "/welcome", replace: true });
  }

  if (!accessToken) {
    return null;
  }

  return (
    <AppPage
      className="bg-[color:var(--bg-canvas)] px-4 pt-6"
      style={{
        paddingBottom:
          "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))",
      }}
    >
      <SubscriptionPanel
        headerActions={
          <>
            <Button
              variant="secondary"
              className="rounded-2xl border-[color:var(--border-faint)] bg-white shadow-none"
              onClick={() =>
                void navigate({
                  to: isDesktopLayout
                    ? "/desktop/settings"
                    : "/profile/settings",
                })
              }
            >
              {t(msg`返回设置`)}
            </Button>
            <Button
              variant="secondary"
              className="rounded-2xl border-[rgba(220,38,38,0.14)] bg-white text-[#b42318] shadow-none hover:bg-[#fff5f5]"
              onClick={handleCloudLogout}
            >
              {t(msg`退出登录`)}
            </Button>
          </>
        }
      />
    </AppPage>
  );
}
