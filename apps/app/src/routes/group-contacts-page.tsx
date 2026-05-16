import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { onChatMessage, onConversationUpdated } from "../lib/socket";
import { ArrowLeft, MessageSquarePlus, Search } from "lucide-react";
import { getGroups, type Group } from "@yinjie/contracts";
import { AppPage, Button, cn } from "@yinjie/ui";
import { GroupAvatarChip } from "../components/group-avatar-chip";
import { RouteRedirectState } from "../components/route-redirect-state";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import {
  buildMobileGroupRouteHash,
  parseMobileGroupRouteState,
} from "../features/chat/mobile-group-route-state";
import { parseDesktopContactsRouteState } from "../features/contacts/contacts-route-state";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { buildCreateGroupRouteHash } from "../lib/create-group-route-state";
import { formatConversationTimestamp } from "../lib/format";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";

const t = translateRuntimeMessage;

const DesktopContactsRouteRedirectShell = lazy(async () => {
  const mod =
    await import("../features/contacts/contacts-route-redirect-shell");
  return { default: mod.ContactsRouteRedirectShell };
});

export function GroupContactsPage() {
  const isDesktopLayout = useDesktopLayout();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const desktopPaneState = useMemo(() => {
    const routeState = parseDesktopContactsRouteState(hash);
    return routeState.pane === "groups" ? routeState : null;
  }, [hash]);

  if (isDesktopLayout) {
    return (
      <Suspense
        fallback={
          <RouteRedirectState
            title={t(msg`正在切换到桌面群聊`)}
            description={t(msg`正在跳转到桌面通讯录工作区中的群聊视图。`)}
            loadingLabel={t(msg`切换桌面群聊视图...`)}
          />
        }
      >
        <DesktopContactsRouteRedirectShell
          pane="groups"
          characterId={desktopPaneState?.characterId}
        />
      </Suspense>
    );
  }

  return <MobileGroupContactsPage />;
}

function MobileGroupContactsPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const hash = useRouterState({
    select: (state) => state.location.hash,
  });
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const [searchText, setSearchText] = useState("");
  const routeState = useMemo(() => parseMobileGroupRouteState(hash), [hash]);
  const safeReturnPath =
    routeState.returnPath && !isDesktopOnlyPath(routeState.returnPath)
      ? routeState.returnPath
      : undefined;
  const safeReturnHash = safeReturnPath ? routeState.returnHash : undefined;
  // 群聊列表页不需要 highlightedMessageId（那是 /group/\$id 聊天页用的）。
  // 不要把它带到 currentRouteHash 里，避免 deep-link 进来时把它泄到子页 returnHash。
  const currentRouteHash = useMemo(
    () =>
      buildMobileGroupRouteHash({
        returnPath: safeReturnPath,
        returnHash: safeReturnHash,
      }),
    [safeReturnHash, safeReturnPath],
  );

  const queryClient = useQueryClient();
  const groupsQuery = useQuery({
    queryKey: ["app-contact-groups", baseUrl],
    queryFn: () => getGroups(baseUrl),
  });

  // 走查 Round 5：群被 AI 回复触发 touchGroupActivity → isHidden=false 翻回
  // 可见时，chat-list 通过 socket onChatMessage/onConversationUpdated 立即拉
  // 刷新；但通讯录页只裸 useQuery 没订阅 socket，要等用户离开再回来才看到
  // 这条群。这里订阅同样的两个事件 invalidate 自己的 cache key，对齐
  // chat-list-page 的口径。
  // 走查 Round 6：onChatMessage 同时分发单聊 + 群聊消息，原版无条件 invalidate
  // 让每条单聊消息也强制 refetch /groups——一个活跃单聊用户每秒能在通讯录-群
  // 聊页打出几十次 getGroups 浪费 RTT。按 payload 有没有 groupId 过滤一下。
  useEffect(() => {
    const offUpdated = onConversationUpdated(() => {
      void queryClient.invalidateQueries({
        queryKey: ["app-contact-groups", baseUrl],
      });
    });
    const offMessage = onChatMessage((payload) => {
      if (!("groupId" in payload)) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ["app-contact-groups", baseUrl],
      });
    });
    return () => {
      offUpdated();
      offMessage();
    };
  }, [baseUrl, queryClient]);

  // 走查 Round 3：getGroups 后端 listGroups 不过滤 isHidden，被 hideGroup 隐藏
  // 的群当前会和正常群混在通讯录里——和 hide 的语义不符（hide=暂时从入口摘掉，
  // 收到新消息再重新冒出来；通讯录是"长期入口"，hide 期间不应该有）。客户端先
  // 滤一遍 isHidden=true，避免改后端 listGroups 影响别处。
  const visibleGroups = useMemo(
    () => (groupsQuery.data ?? []).filter((group) => !group.isHidden),
    [groupsQuery.data],
  );
  const filteredGroups = useFilteredGroups(visibleGroups, searchText);
  const hasSearchText = searchText.trim().length > 0;

  function navigateToRouteStateReturn() {
    if (!safeReturnPath) {
      return false;
    }

    void navigate({
      to: safeReturnPath,
      ...(safeReturnHash ? { hash: safeReturnHash } : {}),
    });
    return true;
  }

  function handleStatusBack() {
    if (navigateToRouteStateReturn()) {
      return;
    }

    void navigate({ to: "/tabs/contacts" });
  }

  function handleRetryGroups() {
    void groupsQuery.refetch();
  }

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`群聊`)}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        leftActions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-[color:var(--text-primary)] active:bg-black/[0.05]"
            onClick={() =>
              navigateBackOrFallback(
                () => {
                  if (navigateToRouteStateReturn()) {
                    return;
                  }

                  void navigate({ to: "/tabs/contacts" });
                },
                safeReturnPath ?? "/tabs/contacts",
              )
            }
            aria-label={t(msg`返回通讯录`)}
          >
            <ArrowLeft size={18} />
          </Button>
        }
        rightActions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-[color:var(--text-primary)] active:bg-black/[0.05]"
            onClick={() => {
              void navigate({
                to: "/group/new",
                hash: buildCreateGroupRouteHash({
                  source: "group-contacts",
                  returnPath: pathname,
                  returnHash: currentRouteHash || undefined,
                }),
              });
            }}
            aria-label={t(msg`发起群聊`)}
          >
            <MessageSquarePlus size={17} />
          </Button>
        }
      >
        <div className="pt-1.5">
          <label className="flex h-9 items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-canvas-elevated)] px-3 text-[12px] text-[color:var(--text-dim)]">
            <Search size={14} className="shrink-0" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t(msg`搜索群聊`)}
              // text-[16px]: iOS Safari focus 时 <16px 会强制 viewport zoom-in；
              // 和 group-member-picker / create-group 等其他群相关搜索框对齐。
              className="min-w-0 flex-1 bg-transparent text-[16px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-dim)]"
            />
          </label>
        </div>
      </TabPageTopBar>

      <div className="pb-8">
        {groupsQuery.isLoading ? (
          <div className="px-4 pt-2.5">
            <MobileGroupContactsStatusCard
              badge={t(msg`读取中`)}
              title={t(msg`正在读取群聊`)}
              description={t(msg`稍等一下，正在同步当前世界里的群聊列表。`)}
              tone="loading"
            />
          </div>
        ) : null}
        {groupsQuery.isError && groupsQuery.error instanceof Error ? (
          <div className="px-4 pt-2.5">
            <MobileGroupContactsStatusCard
              badge={t(msg`读取失败`)}
              title={t(msg`群聊列表暂时不可用`)}
              description={groupsQuery.error.message}
              tone="danger"
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={handleRetryGroups}
                  >
                    {t(msg`重试读取`)}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={handleStatusBack}
                  >
                    {safeReturnPath ? t(msg`返回上一页`) : t(msg`返回通讯录`)}
                  </Button>
                </div>
              }
            />
          </div>
        ) : null}

        {!groupsQuery.isLoading &&
        !groupsQuery.isError &&
        !filteredGroups.length ? (
          <div className="px-4 pt-4">
            <MobileGroupContactsStatusCard
              badge={hasSearchText ? t(msg`暂无结果`) : t(msg`群聊`)}
              title={hasSearchText ? t(msg`没有找到匹配的群聊`) : t(msg`还没有群聊`)}
              description={
                hasSearchText
                  ? t(msg`换个群名称或公告关键词试试。`)
                  : t(msg`先发起一个新的群聊，建好后就会出现在这里。`)
              }
              action={
                hasSearchText ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={() => setSearchText("")}
                  >
                    {t(msg`清除搜索`)}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full border-[color:var(--border-subtle)] bg-white px-3.5 text-[11px]"
                    onClick={() => {
                      void navigate({
                        to: "/group/new",
                        hash: buildCreateGroupRouteHash({
                          source: "group-contacts",
                          returnPath: pathname,
                          returnHash: currentRouteHash || undefined,
                        }),
                      });
                    }}
                  >
                    {t(msg`发起群聊`)}
                  </Button>
                )
              }
            />
          </div>
        ) : null}

        {filteredGroups.length ? (
          <section className="mt-1 overflow-hidden border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
            {filteredGroups.map((group, index) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  void navigate({
                    to: "/group/$groupId",
                    params: { groupId: group.id },
                    hash: buildMobileGroupRouteHash({
                      returnPath: pathname,
                      returnHash: currentRouteHash || undefined,
                    }),
                  });
                }}
                className={cn(
                  "flex w-full items-center gap-3 bg-[color:var(--bg-canvas-elevated)] px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--surface-card-hover)]",
                  index > 0
                    ? "border-t border-[color:var(--border-faint)]"
                    : undefined,
                )}
              >
                <GroupAvatarChip name={group.name} size="wechat" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 truncate text-[14px] text-[color:var(--text-primary)]">
                      {group.name}
                    </div>
                    <div className="shrink-0 text-[9px] text-[color:var(--text-dim)]">
                      {formatConversationTimestamp(
                        group.savedToContactsAt ?? group.lastActivityAt,
                      )}
                    </div>
                  </div>
                  {!group.savedToContacts ? (
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[color:var(--text-dim)]">
                      <span className="inline-flex items-center rounded-full bg-[rgba(15,23,42,0.04)] px-1.5 py-0.5 text-[9px] text-[color:var(--text-muted)]">
                        {t(msg`未保存到通讯录`)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </section>
        ) : null}
      </div>
    </AppPage>
  );
}

function MobileGroupContactsStatusCard({
  badge,
  title,
  description,
  action,
  tone = "default",
}: {
  badge: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "default" | "danger" | "loading";
}) {
  return (
    <section
      className={cn(
        "rounded-[16px] border px-3.5 py-4 text-center shadow-none",
        tone === "danger"
          ? "border-[color:var(--border-danger)] bg-[linear-gradient(180deg,rgba(255,245,245,0.96),rgba(254,242,242,0.94))]"
          : "border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]",
      )}
    >
      <div
        className={cn(
          "mx-auto inline-flex rounded-full px-2 py-0.5 text-[8px] font-medium tracking-[0.04em]",
          tone === "danger"
            ? "bg-[rgba(220,38,38,0.08)] text-[color:var(--state-danger-text)]"
            : "bg-[rgba(7,193,96,0.1)] text-[#07c160]",
        )}
      >
        {badge}
      </div>
      {tone === "loading" ? (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-black/15" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-black/25 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8ecf9d] [animation-delay:240ms]" />
        </div>
      ) : null}
      <div className="mt-2.5 text-[14px] font-medium text-[color:var(--text-primary)]">
        {title}
      </div>
      <p className="mx-auto mt-1.5 max-w-[17rem] text-[11px] leading-[1.35rem] text-[color:var(--text-secondary)]">
        {description}
      </p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </section>
  );
}

function useFilteredGroups(groups: Group[], searchText: string) {
  return useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();
    if (!normalizedSearchText) {
      return groups;
    }

    return groups.filter((group) => {
      const announcement = group.announcement?.trim().toLowerCase() ?? "";
      return (
        group.name.toLowerCase().includes(normalizedSearchText) ||
        announcement.includes(normalizedSearchText)
      );
    });
  }, [groups, searchText]);
}
