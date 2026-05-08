import { useEffect, useMemo } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { useNavigate } from "@tanstack/react-router";
import { RouteRedirectState } from "../../components/route-redirect-state";

const t = translateRuntimeMessage;
import {
  buildDesktopOfficialServiceThreadPath,
  buildDesktopSubscriptionInboxPath,
} from "../desktop/chat/desktop-chat-route-state";
import {
  parseDesktopOfficialMessageRouteHash,
  resolveDesktopServiceMessageArticleId,
  resolveDesktopSubscriptionMessageArticleId,
} from "./official-message-route-state";

export type OfficialMessageWorkspaceShellProps = {
  hash: string;
  selectedServiceAccountId?: string;
  selectedSpecialView?: "subscription-inbox";
};

export function OfficialMessageWorkspaceShell({
  hash,
  selectedServiceAccountId,
  selectedSpecialView,
}: OfficialMessageWorkspaceShellProps) {
  const navigate = useNavigate();
  const routeState = parseDesktopOfficialMessageRouteHash(hash);
  const safeServiceArticleId = useMemo(
    () =>
      resolveDesktopServiceMessageArticleId(
        routeState,
        selectedServiceAccountId,
      ),
    [routeState, selectedServiceAccountId],
  );
  const safeSubscriptionArticleId = useMemo(
    () => resolveDesktopSubscriptionMessageArticleId(routeState),
    [routeState],
  );
  const targetPath = useMemo(() => {
    if (selectedServiceAccountId) {
      return buildDesktopOfficialServiceThreadPath({
        accountId: selectedServiceAccountId,
        articleId: safeServiceArticleId,
      });
    }

    if (selectedSpecialView === "subscription-inbox") {
      return buildDesktopSubscriptionInboxPath({
        articleId: safeSubscriptionArticleId,
      });
    }

    return "/tabs/chat";
  }, [
    safeServiceArticleId,
    safeSubscriptionArticleId,
    selectedServiceAccountId,
    selectedSpecialView,
  ]);

  useEffect(() => {
    void navigate({
      to: targetPath,
      replace: true,
    });
  }, [navigate, targetPath]);

  return (
    <RouteRedirectState
      title={t(msg`正在切换到桌面公众号消息`)}
      description={t(msg`正在同步桌面消息工作区的公众号路由状态。`)}
      loadingLabel={t(msg`切换桌面公众号消息...`)}
    />
  );
}
