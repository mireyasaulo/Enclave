import { Fragment, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { msg } from "@lingui/macro";
import { Link, useLocation } from "@tanstack/react-router";
import type {
  AdminChatRecordActivityWindow,
  AdminChatRecordConversationDetail,
  AdminChatRecordConversationExportResponse,
  AdminChatRecordConversationListItem,
  AdminChatRecordConversationListQuery,
  AdminChatRecordConversationSearchQuery,
  AdminChatRecordReviewStatus,
  Character,
  Message,
} from "@yinjie/contracts";
import {
  Button,
  Card,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  MetricCard,
  SectionHeading,
  StatusPill,
  ToggleChip,
} from "@yinjie/ui";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHero,
  AdminSkeletonCard,
} from "../components/admin-workbench";
import { adminApi } from "../lib/admin-api";
import { chatRecordsAdminApi } from "../lib/chat-records-api";
import {
  formatAdminCompactInteger,
  formatAdminCurrency,
  formatAdminDateTime as formatLocalizedDateTime,
  formatAdminPercent,
} from "../lib/format";
import { resolveAdminCoreApiBaseUrl } from "../lib/core-api-base";
import { translateRuntimeMessage } from "@yinjie/i18n";

const SORT_OPTIONS: Array<{
  value: AdminChatRecordConversationListQuery["sortBy"];
  label: ReturnType<typeof msg>;
}> = [
  { value: "lastActivityAt", label: msg`最近活跃` },
  { value: "recentMessageCount30d", label: msg`近 30 天消息量` },
  { value: "storedMessageCount", label: msg`累计消息量` },
];

const TYPE_OPTIONS: Array<{
  value: AdminChatRecordConversationSearchQuery["messageType"] | "all";
  label: ReturnType<typeof msg>;
}> = [
  { value: "all", label: msg`全部类型` },
  { value: "text", label: msg`文本` },
  { value: "proactive", label: msg`主动消息` },
  { value: "image", label: msg`图片` },
  { value: "file", label: msg`文件` },
  { value: "voice", label: msg`语音` },
  { value: "sticker", label: msg`表情` },
  { value: "system", label: msg`系统` },
];

const ACTIVITY_WINDOW_OPTIONS: Array<{
  value: AdminChatRecordActivityWindow;
  label: ReturnType<typeof msg>;
}> = [
  { value: "all", label: msg`全部会话` },
  { value: "7d", label: msg`近 7 天活跃` },
  { value: "30d", label: msg`近 30 天活跃` },
];

const REVIEW_STATUS_OPTIONS: Array<{
  value: AdminChatRecordReviewStatus;
  label: ReturnType<typeof msg>;
}> = [
  { value: "backlog", label: msg`待复盘` },
  { value: "watching", label: msg`持续观察` },
  { value: "important", label: msg`重点样本` },
  { value: "resolved", label: msg`已处理` },
];

function readInitialChatRecordsFocus(search?: string) {
  const raw =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(raw);
  return {
    characterId: params.get("characterId")?.trim() || "",
    conversationId: params.get("conversationId")?.trim() || "",
  };
}

export function ChatRecordsPage() {
  const t = translateRuntimeMessage;
  const baseUrl = resolveAdminCoreApiBaseUrl();
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationSearch = location.searchStr ?? "";
  const initialFocus = useMemo(
    () => readInitialChatRecordsFocus(locationSearch),
    [locationSearch],
  );
  const [characterId, setCharacterId] = useState(initialFocus.characterId);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [includeClearedHistory, setIncludeClearedHistory] = useState(false);
  const [activityWindow, setActivityWindow] =
    useState<AdminChatRecordActivityWindow>("all");
  const [sortBy, setSortBy] =
    useState<AdminChatRecordConversationListQuery["sortBy"]>("lastActivityAt");
  const [page, setPage] = useState(1);
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialFocus.conversationId,
  );
  const [focusedMessageId, setFocusedMessageId] = useState("");
  const [timelineMessageType, setTimelineMessageType] =
    useState<AdminChatRecordConversationSearchQuery["messageType"] | "all">(
      "all",
    );
  const [search, setSearch] = useState<{
    keyword: string;
    messageType: AdminChatRecordConversationSearchQuery["messageType"] | "all";
    dateFrom: string;
    dateTo: string;
  }>({
    keyword: "",
    messageType: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [searchContext, setSearchContext] = useState<{
    conversationId: string;
    includeClearedHistory: boolean;
  } | null>(null);

  // Re-sync focus state when URL search changes (e.g. user clicks another
  // /chat-records?... link without leaving the page).
  useEffect(() => {
    setCharacterId(initialFocus.characterId);
    setSelectedConversationId(initialFocus.conversationId);
  }, [initialFocus.characterId, initialFocus.conversationId]);

  const listQuery = useMemo(
    () => ({
      characterId: characterId || undefined,
      includeHidden,
      onlyReviewed,
      activityWindow,
      sortBy,
      page,
      pageSize: 24,
    }),
    [activityWindow, characterId, includeHidden, onlyReviewed, page, sortBy],
  );

  const overviewQuery = useQuery({
    queryKey: ["admin-chat-records-overview", baseUrl],
    queryFn: () => chatRecordsAdminApi.getOverview(),
  });
  const charactersQuery = useQuery({
    queryKey: ["admin-chat-records-characters", baseUrl],
    queryFn: () => adminApi.getCharacters(),
  });
  const conversationsQuery = useQuery({
    queryKey: ["admin-chat-records-conversations", baseUrl, listQuery],
    queryFn: () => chatRecordsAdminApi.listConversations(listQuery),
  });

  const characters = charactersQuery.data ?? [];
  const conversations = useMemo(
    () => conversationsQuery.data?.items ?? [],
    [conversationsQuery.data?.items],
  );
  const activeConversationId = selectedConversationId || conversations[0]?.id || "";

  useEffect(() => {
    if (!conversations.length) {
      if (selectedConversationId) {
        setSelectedConversationId("");
      }
      return;
    }

    const stillVisible = conversations.some(
      (item) => item.id === selectedConversationId,
    );
    if (!selectedConversationId || !stillVisible) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    setFocusedMessageId("");
  }, [activeConversationId, includeClearedHistory]);

  const detailQuery = useQuery({
    queryKey: [
      "admin-chat-records-detail",
      baseUrl,
      activeConversationId,
      includeClearedHistory,
    ],
    queryFn: () =>
      chatRecordsAdminApi.getConversationDetail(activeConversationId, {
        includeClearedHistory,
      }),
    enabled: Boolean(activeConversationId),
  });
  const tokenUsageQuery = useQuery({
    queryKey: ["admin-chat-records-token-usage", baseUrl, activeConversationId],
    queryFn: () => chatRecordsAdminApi.getConversationTokenUsage(activeConversationId),
    enabled: Boolean(activeConversationId),
  });
  const searchMutation = useMutation({
    mutationFn: (payload: AdminChatRecordConversationSearchQuery) =>
      chatRecordsAdminApi.searchConversationMessages(activeConversationId, payload),
  });
  const exportMutation = useMutation({
    mutationFn: (format: "markdown" | "json") =>
      chatRecordsAdminApi.exportConversation(activeConversationId, {
        format,
        includeClearedHistory,
      }),
    onSuccess: (file) => downloadExportFile(file),
  });
  const messagesQuery = useInfiniteQuery({
    queryKey: [
      "admin-chat-records-messages",
      baseUrl,
      activeConversationId,
      includeClearedHistory,
      focusedMessageId,
    ],
    queryFn: ({ pageParam }) =>
      chatRecordsAdminApi.getConversationMessages(activeConversationId, {
        includeClearedHistory,
        limit: 60,
        cursor: focusedMessageId || !pageParam ? undefined : String(pageParam),
        aroundMessageId: focusedMessageId || undefined,
        before: focusedMessageId ? 18 : undefined,
        after: focusedMessageId ? 18 : undefined,
      }),
    initialPageParam: 0,
    enabled: Boolean(activeConversationId),
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor ? Number(lastPage.nextCursor) : undefined,
  });

  const detail = detailQuery.data;
  const selectedConversation =
    detail?.conversation ??
    conversations.find((item) => item.id === activeConversationId) ??
    null;
  const selectedCharacterName = characterId
    ? characters.find((item) => item.id === characterId)?.name || t(msg`当前角色`)
    : "";

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    if (!pages.length) {
      return [] as Message[];
    }
    return focusedMessageId
      ? pages[0].items
      : [...pages].reverse().flatMap((pageData) => pageData.items);
  }, [focusedMessageId, messagesQuery.data?.pages]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => matchesMessageType(message, timelineMessageType)),
    [messages, timelineMessageType],
  );

  const filterLabels = useMemo(
    () =>
      buildConversationFilterLabels({
        characterName: selectedCharacterName,
        includeHidden,
        onlyReviewed,
        includeClearedHistory,
        activityWindow,
        sortBy,
      }),
    [
      activityWindow,
      includeClearedHistory,
      includeHidden,
      onlyReviewed,
      selectedCharacterName,
      sortBy,
    ],
  );
  const searchLabels = useMemo(() => buildSearchLabels(search), [search]);
  const hasConversationFilters = filterLabels.length > 0;
  const searchContextActive =
    searchContext?.conversationId === activeConversationId &&
    searchContext.includeClearedHistory === includeClearedHistory;
  const searchResults = searchContextActive
    ? searchMutation.data?.items ?? []
    : [];
  const searchedTotal = searchContextActive ? searchMutation.data?.total ?? 0 : 0;

  function runSearch() {
    if (!activeConversationId) {
      return;
    }

    setSearchContext({
      conversationId: activeConversationId,
      includeClearedHistory,
    });
    searchMutation.mutate({
      keyword: search.keyword.trim() || undefined,
      messageType: search.messageType !== "all" ? search.messageType : undefined,
      dateFrom: search.dateFrom || undefined,
      dateTo: search.dateTo || undefined,
      includeClearedHistory,
    });
  }

  function clearSearchContextState() {
    setSearchContext(null);
    searchMutation.reset();
    setFocusedMessageId("");
  }

  function resetSearchFields() {
    setSearch({
      keyword: "",
      messageType: "all",
      dateFrom: "",
      dateTo: "",
    });
  }

  function resetConversationFilters() {
    setCharacterId("");
    setIncludeHidden(false);
    setOnlyReviewed(false);
    setIncludeClearedHistory(false);
    setActivityWindow("all");
    setSortBy("lastActivityAt");
    setPage(1);
    clearSearchContextState();
  }

  function selectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    clearSearchContextState();
  }

  if (overviewQuery.isLoading && conversationsQuery.isLoading) {
    return <AdminSkeletonCard rows={5} showAction />;
  }
  if (overviewQuery.error instanceof Error) {
    return (
      <AdminErrorState
        title={t(msg`聊天记录概览加载失败`)}
        detail={overviewQuery.error.message}
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }
  if (conversationsQuery.error instanceof Error) {
    return (
      <AdminErrorState
        title={t(msg`会话列表加载失败`)}
        detail={conversationsQuery.error.message}
        onRetry={() => conversationsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow={t(msg`聊天记录`)}
        title={t(msg`世界样本与会话档案`)}
        actions={
          <div className="flex flex-wrap gap-2">
            {focusedMessageId ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFocusedMessageId("")}
              >
                {t(msg`返回最新消息`)}
              </Button>
            ) : null}
            {hasConversationFilters ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={resetConversationFilters}
              >
                {t(msg`恢复默认筛选`)}
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          { label: t(msg`总会话数`), value: overviewQuery.data?.totalConversationCount ?? 0 },
          {
            label: t(msg`近 7 天活跃`),
            value: overviewQuery.data?.activeConversationCount7d ?? 0,
          },
          { label: t(msg`近 30 天消息`), value: overviewQuery.data?.messageCount30d ?? 0 },
          {
            label: t(msg`近 30 天成本`),
            value: formatCurrency(
              overviewQuery.data?.estimatedCost30d ?? 0,
              overviewQuery.data?.currency ?? "CNY",
            ),
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          <Card className="space-y-5 bg-[color:var(--surface-console)]">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading>{t(msg`会话导航`)}</SectionHeading>
              {conversationsQuery.isFetching ? (
                <StatusPill tone="muted">{t(msg`刷新中`)}</StatusPill>
              ) : null}
            </div>

            <div className="grid gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[color:var(--text-muted)]">
                  {t(msg`角色范围`)}
                </span>
                <select
                  value={characterId}
                  onChange={(event) => {
                    setCharacterId(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2.5 text-sm"
                >
                  <option value="">{t(msg`全部角色`)}</option>
                  {characters.map((character: Character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-[color:var(--text-muted)]">
                  {t(msg`排序方式`)}
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(
                      event.target
                        .value as AdminChatRecordConversationListQuery["sortBy"],
                    );
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2.5 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                {ACTIVITY_WINDOW_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setActivityWindow(option.value);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      activityWindow === option.value
                        ? "border-[color:var(--border-brand)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)]"
                        : "border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]"
                    }`}
                  >
                    {t(option.label)}
                  </button>
                ))}
                <ToggleChip
                  label={t(msg`显示隐藏会话`)}
                  checked={includeHidden}
                  onChange={(event) => {
                    setIncludeHidden(event.target.checked);
                    setPage(1);
                  }}
                />
                <ToggleChip
                  label={t(msg`仅看已标记样本`)}
                  checked={onlyReviewed}
                  onChange={(event) => {
                    setOnlyReviewed(event.target.checked);
                    setPage(1);
                  }}
                />
                <ToggleChip
                  label={t(msg`包含清空前历史`)}
                  checked={includeClearedHistory}
                  onChange={(event) => {
                    setIncludeClearedHistory(event.target.checked);
                    clearSearchContextState();
                  }}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {t(msg`当前结果`)}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {conversationsQuery.data
                      ? t(msg`共 ${conversationsQuery.data.total} 个会话，第 ${page} / ${Math.max(conversationsQuery.data.totalPages, 1)} 页`)
                      : t(msg`正在读取列表`)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-[color:var(--text-primary)]">
                    {conversations.length}
                  </div>
                  <div className="text-[12px] text-[color:var(--text-muted)]">
                    {t(msg`本页会话`)}
                  </div>
                </div>
              </div>
              {filterLabels.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {filterLabels.map((label) => (
                    <FilterBadge key={label} label={label} />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {conversations.length ? (
                conversations.map((item) => (
                  <ConversationListItemCard
                    key={item.id}
                    item={item}
                    active={item.id === activeConversationId}
                    onSelect={() => selectConversation(item.id)}
                  />
                ))
              ) : (
                <AdminEmptyState
                  title={t(msg`没有符合条件的会话`)}
                  description={t(msg`可以切回全部角色，或放宽活跃时间与隐藏会话筛选。`)}
                />
              )}
            </div>

            {conversationsQuery.data && conversationsQuery.data.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  {t(msg`上一页`)}
                </Button>
                <span className="text-xs text-[color:var(--text-muted)]">
                  {t(msg`第 ${page} / ${conversationsQuery.data.totalPages} 页`)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(conversationsQuery.data!.totalPages, current + 1),
                    )
                  }
                  disabled={page >= conversationsQuery.data.totalPages}
                >
                  {t(msg`下一页`)}
                </Button>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {selectedConversation ? (
            <ConversationWorkspaceHeader
              conversation={selectedConversation}
              detail={detail}
              recentCost={tokenUsageQuery.data?.recent30dOverview.estimatedCost ?? null}
              recentCostCurrency={
                tokenUsageQuery.data?.recent30dOverview.currency ?? "CNY"
              }
            />
          ) : (
            <AdminEmptyState
              title={t(msg`先从左侧选择一个会话`)}
              description={t(msg`选一个会话后开始查看上下文。`)}
            />
          )}

          <Card className="space-y-5 bg-[color:var(--surface-console)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SectionHeading>{t(msg`检索与定位`)}</SectionHeading>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={runSearch}
                  disabled={!activeConversationId || searchMutation.isPending}
                >
                  {searchMutation.isPending ? t(msg`搜索中...`) : t(msg`执行搜索`)}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetSearchFields}
                >
                  {t(msg`清空条件`)}
                </Button>
                {searchContextActive ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={clearSearchContextState}
                  >
                    {t(msg`清除命中`)}
                  </Button>
                ) : null}
                <span className="ml-1 inline-flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
                  <span>{t(msg`导出`)}</span>
                  <button
                    type="button"
                    onClick={() => exportMutation.mutate("markdown")}
                    disabled={!activeConversationId || exportMutation.isPending}
                    className="rounded-full border border-[color:var(--border-faint)] px-2 py-0.5 hover:border-[color:var(--border-subtle)] hover:text-[color:var(--text-primary)] disabled:opacity-50"
                  >
                    MD
                  </button>
                  <button
                    type="button"
                    onClick={() => exportMutation.mutate("json")}
                    disabled={!activeConversationId || exportMutation.isPending}
                    className="rounded-full border border-[color:var(--border-faint)] px-2 py-0.5 hover:border-[color:var(--border-subtle)] hover:text-[color:var(--text-primary)] disabled:opacity-50"
                  >
                    JSON
                  </button>
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_1fr_1fr]">
              <input
                value={search.keyword}
                onChange={(event) =>
                  setSearch((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runSearch();
                  }
                }}
                placeholder={t(msg`搜索需求、措辞、反馈或具体话题`)}
                className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2.5 text-sm"
              />
              <select
                value={search.messageType}
                onChange={(event) =>
                  setSearch((current) => ({
                    ...current,
                    messageType:
                      event.target
                        .value as AdminChatRecordConversationSearchQuery["messageType"] | "all",
                  }))
                }
                className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2.5 text-sm"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={search.dateFrom}
                onChange={(event) =>
                  setSearch((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2.5 text-sm"
              />
              <input
                type="date"
                value={search.dateTo}
                onChange={(event) =>
                  setSearch((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2.5 text-sm"
              />
            </div>

            {searchLabels.length ? (
              <div className="flex flex-wrap gap-2">
                {searchLabels.map((label) => (
                  <FilterBadge key={label} label={label} />
                ))}
              </div>
            ) : null}

            {exportMutation.error instanceof Error ? (
              <ErrorBlock message={exportMutation.error.message} />
            ) : null}

            {searchContextActive && searchMutation.isPending ? (
              <LoadingBlock label={t(msg`正在搜索命中消息...`)} />
            ) : null}

            {searchContextActive && searchResults.length ? (
              <div className="space-y-3 rounded-[22px] border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {t(msg`搜索命中`)}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      共命中 {searchedTotal} 条消息，{t(msg`点击任一条即可切到附近上下文。`)}
                    </div>
                  </div>
                  <StatusPill tone="healthy">
                    {searchLabels.length ? searchLabels.join(" · ") : t(msg`无附加条件`)}
                  </StatusPill>
                </div>
                <div className="grid gap-2">
                  {searchResults.map((item) => (
                    <button
                      key={item.messageId}
                      type="button"
                      onClick={() => setFocusedMessageId(item.messageId)}
                      className="block w-full rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-3 text-left transition hover:border-[color:var(--border-subtle)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[color:var(--text-primary)]">
                            {item.senderName}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                            {formatCompactDate(item.createdAt)} ·{" "}
                            {formatMessageType(item.messageType)}
                          </div>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[12px] font-medium text-sky-700">
                          {t(msg`定位`)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                        {truncateText(item.previewText || t(msg`空消息`), 150)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {searchContextActive &&
            searchMutation.isSuccess &&
            !searchMutation.isPending &&
            !searchResults.length ? (
              <AdminEmptyState
                title={t(msg`没有命中消息`)}
                description={t(msg`换一个关键词、放宽时间范围，或者切回全部消息类型后再试。`)}
              />
            ) : null}
          </Card>

          <Card className="space-y-4 bg-[color:var(--surface-console)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <SectionHeading>{t(msg`时间线`)}</SectionHeading>
                {messages.length ? (
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {visibleMessages.length} / {messages.length}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={timelineMessageType}
                  onChange={(event) =>
                    setTimelineMessageType(
                      event.target
                        .value as AdminChatRecordConversationSearchQuery["messageType"] | "all",
                    )
                  }
                  className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-1.5 text-sm"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
                {focusedMessageId ? (
                  <StatusPill tone="warning">{t(msg`定位上下文`)}</StatusPill>
                ) : (
                  <StatusPill tone="muted">{t(msg`最新时间线`)}</StatusPill>
                )}
              </div>
            </div>

            {includeClearedHistory ? (
              <InlineNotice title={t(msg`当前正在查看清空前历史`)}>
                {t(msg`这里展示数据库仍保留的完整会话样本，可能包含用户在前台已清空的聊天。`)}
              </InlineNotice>
            ) : null}

            <div className="space-y-4">
              {messagesQuery.isLoading ? (
                <LoadingBlock label={t(msg`正在读取时间线...`)} />
              ) : messagesQuery.error instanceof Error ? (
                <ErrorBlock message={messagesQuery.error.message} />
              ) : visibleMessages.length ? (
                <TimelineMessages
                  messages={visibleMessages}
                  focusedMessageId={focusedMessageId}
                />
              ) : messages.length ? (
                <AdminEmptyState
                  title={t(msg`当前筛选条件下没有消息`)}
                  description={t(msg`可以切回全部类型，或者通过搜索先定位到具体片段。`)}
                />
              ) : (
                <AdminEmptyState
                  title={t(msg`当前会话还没有消息`)}
                  description={t(msg`这个角色的单聊档案还没有积累可回看的历史。`)}
                />
              )}
            </div>

            {!focusedMessageId && messagesQuery.data?.pages.at(-1)?.hasMore ? (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void messagesQuery.fetchNextPage()}
                  disabled={messagesQuery.isFetchingNextPage}
                >
                  {messagesQuery.isFetchingNextPage
                    ? t(msg`正在加载更早消息...`)
                    : t(msg`继续向前加载`)}
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConversationListItemCard({
  item,
  active,
  onSelect,
}: {
  item: AdminChatRecordConversationListItem;
  active: boolean;
  onSelect: () => void;
}) {
  const t = translateRuntimeMessage;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
        active
          ? "border-[color:var(--border-brand)] bg-white shadow-[var(--shadow-card)]"
          : "border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-card)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              {item.characterName}
            </div>
            {active ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700">
                {t(msg`当前`)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            {item.relationship || t(msg`未标注关系`)}
          </div>
        </div>
        <div className="shrink-0 text-right text-[12px] text-[color:var(--text-muted)]">
          <div>{formatCompactDate(item.lastActivityAt)}</div>
          <div className="mt-1">7d {item.recentMessageCount7d}</div>
        </div>
      </div>

      <div className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
        {formatPreview(item.lastVisibleMessage ?? item.lastStoredMessage ?? null, 96)}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[color:var(--text-muted)]">
        <span>{t(msg`可见`)} {item.visibleMessageCount}</span>
        <span>{t(msg`留存`)} {item.storedMessageCount}</span>
        <span>{t(msg`30 天`)} {item.recentMessageCount30d}</span>
        {item.isHidden ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            {t(msg`已隐藏`)}
          </span>
        ) : null}
        {item.hasClearedHistory ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
            {t(msg`含清空前历史`)}
          </span>
        ) : null}
        {item.review ? (
          <span className={`rounded-full px-2 py-0.5 ${reviewBadgeClassName(item.review.status)}`}>
            {formatReviewStatus(item.review.status)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ConversationWorkspaceHeader({
  conversation,
  detail,
  recentCost,
  recentCostCurrency,
}: {
  conversation: AdminChatRecordConversationListItem;
  detail: AdminChatRecordConversationDetail | undefined;
  recentCost: number | null;
  recentCostCurrency: "CNY" | "USD";
}) {
  const t = translateRuntimeMessage;
  const characterId = detail?.character?.id ?? conversation.characterId ?? undefined;
  const reviewStatus = detail?.review?.status ?? conversation.review?.status ?? null;

  return (
    <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,249,241,0.96)_48%,rgba(237,248,245,0.94))]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-[12px] uppercase tracking-[0.28em] text-[color:var(--text-muted)]">
              {t(msg`当前工作会话`)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-semibold text-[color:var(--text-primary)]">
                {conversation.characterName}
              </h3>
              {detail?.character ? (
                <StatusPill tone={detail.character.isOnline ? "healthy" : "muted"}>
                  {detail.character.isOnline ? t(msg`在线`) : t(msg`离线`)}
                </StatusPill>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {conversation.relationship || t(msg`未标注关系`)} ·{" "}
              {formatPreview(
                conversation.lastVisibleMessage ?? conversation.lastStoredMessage ?? null,
                160,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewStatus ? (
                <span className={`rounded-full px-2.5 py-1 text-xs ${reviewBadgeClassName(reviewStatus)}`}>
                  {formatReviewStatus(reviewStatus)}
                </span>
              ) : (
                <span className="rounded-full border border-[color:var(--border-faint)] bg-white px-2.5 py-1 text-xs text-[color:var(--text-secondary)]">
                  {t(msg`未进入复盘池`)}
                </span>
              )}
              {conversation.isHidden ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                  {t(msg`已隐藏会话`)}
                </span>
              ) : null}
              {conversation.hasClearedHistory ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  {t(msg`含清空前历史`)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {characterId ? (
              <Link
                to="/characters/$characterId/runtime"
                params={{ characterId }}
                className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--border-subtle)] bg-white px-3.5 py-2 text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-soft)]"
              >
                {t(msg`运行逻辑台`)}
              </Link>
            ) : null}
            <a
              href={buildReplyLogicHref(conversation.id, characterId)}
              className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--border-subtle)] bg-white px-3.5 py-2 text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-soft)]"
            >
              {t(msg`回复逻辑`)}
            </a>
            <a
              href={buildTokenUsageHref(conversation.id, characterId)}
              className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--border-subtle)] bg-white px-3.5 py-2 text-sm font-medium text-[color:var(--text-primary)] shadow-[var(--shadow-soft)]"
            >
              {t(msg`Token 用量`)}
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t(msg`最近活跃`)}
            value={formatCompactDate(conversation.lastActivityAt)}
          />
          <MetricCard
            label={t(msg`近 30 天消息`)}
            value={detail?.stats.recentMessageCount30d ?? conversation.recentMessageCount30d}
          />
          <MetricCard
            label={t(msg`留存消息`)}
            value={detail?.stats.storedMessageCount ?? conversation.storedMessageCount}
          />
          <MetricCard
            label={t(msg`近 30 天成本`)}
            value={
              recentCost == null
                ? t(msg`读取中`)
                : formatCurrency(recentCost, recentCostCurrency)
            }
          />
        </div>
      </div>
    </Card>
  );
}

function TimelineMessages({
  messages,
  focusedMessageId,
}: {
  messages: Message[];
  focusedMessageId: string;
}) {
  let previousDateKey = "";

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const dateKey = message.createdAt.slice(0, 10);
        const showDivider = dateKey !== previousDateKey;
        previousDateKey = dateKey;

        return (
          <Fragment key={message.id}>
            {showDivider ? <TimelineDateDivider value={message.createdAt} /> : null}
            <MessageCard
              message={message}
              highlighted={focusedMessageId === message.id}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function TimelineDateDivider({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-[color:var(--border-faint)]" />
      <span className="rounded-full border border-[color:var(--border-faint)] bg-white px-3 py-1 text-[12px] font-medium text-[color:var(--text-muted)]">
        {formatTimelineDate(value)}
      </span>
      <div className="h-px flex-1 bg-[color:var(--border-faint)]" />
    </div>
  );
}

function MessageCard({
  message,
  highlighted,
}: {
  message: Message;
  highlighted: boolean;
}) {
  const t = translateRuntimeMessage;
  const isUser = message.senderType === "user";
  const isSystem = message.senderType === "system";
  const alignmentClass = isSystem
    ? "justify-center"
    : isUser
      ? "justify-end"
      : "justify-start";
  const bubbleClass = isSystem
    ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,243,219,0.92))]"
    : isUser
      ? "border-orange-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,237,0.95))]"
      : "border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.94))]";

  return (
    <div className={`flex ${alignmentClass}`}>
      <div
        className={`w-full max-w-[90%] rounded-[24px] border px-4 py-4 shadow-[var(--shadow-soft)] ${
          highlighted
            ? "border-[color:var(--border-brand)] ring-2 ring-[color:var(--brand-primary)]/12"
            : bubbleClass
        }`}
      >
        <div
          className={`flex items-start justify-between gap-3 ${
            isUser && !isSystem ? "flex-row-reverse" : ""
          }`}
        >
          <div className={`min-w-0 ${isUser && !isSystem ? "text-right" : ""}`}>
            <div className="text-sm font-semibold text-[color:var(--text-primary)]">
              {message.senderName}
            </div>
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
              {formatDateTime(message.createdAt)}
            </div>
          </div>
          <div
            className={`flex flex-wrap gap-2 ${
              isUser && !isSystem ? "justify-end" : ""
            }`}
          >
            {highlighted ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[12px] font-medium text-sky-700">
                {t(msg`命中`)}
              </span>
            ) : null}
            <StatusPill
              tone={
                message.senderType === "character"
                  ? "healthy"
                  : message.senderType === "system"
                    ? "warning"
                    : "muted"
              }
            >
              {formatMessageType(message.type)}
            </StatusPill>
          </div>
        </div>

        <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--text-secondary)]">
          {message.text?.trim() || (message.attachment ? t(msg`无额外文本描述`) : t(msg`空消息`))}
        </div>

        {message.attachment ? (
          <div className="mt-3 rounded-2xl border border-[color:var(--border-faint)] bg-white/85 px-3 py-2.5 text-sm text-[color:var(--text-secondary)]">
            {attachmentLabel(message)}
          </div>
        ) : null}
      </div>
    </div>
  );
}




function FilterBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[color:var(--border-faint)] bg-white px-2.5 py-1 text-xs text-[color:var(--text-secondary)]">
      {label}
    </span>
  );
}

function attachmentLabel(message: Message) {
  const t = translateRuntimeMessage;
  const attachment = message.attachment;
  if (!attachment) {
    return "";
  }
  if (
    attachment.kind === "image" ||
    attachment.kind === "file" ||
    attachment.kind === "voice"
  ) {
    return `${formatMessageType(message.type)}：${attachment.fileName}`;
  }
  if (attachment.kind === "sticker") {
    return `${t(msg`表情`)}：${attachment.label || attachment.stickerId}`;
  }
  if (attachment.kind === "contact_card") {
    return `${t(msg`名片`)}：${attachment.name}`;
  }
  if (attachment.kind === "location_card") {
    return `${t(msg`位置`)}：${attachment.title}`;
  }
  return `${t(msg`笔记`)}：${attachment.title}`;
}

function formatPreview(message: Message | null, maxLength = 120) {
  const t = translateRuntimeMessage;
  if (!message) {
    return t(msg`暂无消息`);
  }

  const rawText = message.attachment
    ? attachmentLabel(message)
    : message.text || t(msg`空消息`);
  return `${message.senderName}：${truncateText(rawText, maxLength)}`;
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatMessageType(type: Message["type"]) {
  const t = translateRuntimeMessage;
  if (type === "contact_card") {
    return t(msg`名片`);
  }
  if (type === "location_card") {
    return t(msg`位置`);
  }
  if (type === "note_card") {
    return t(msg`笔记`);
  }
  const found = TYPE_OPTIONS.find((item) => item.value === type);
  return found ? t(found.label) : type;
}

function matchesMessageType(
  message: Message,
  filter: AdminChatRecordConversationSearchQuery["messageType"] | "all",
) {
  if (filter === "all" || !filter) {
    return true;
  }
  if (filter === "text") {
    return message.type === "text" || message.type === "proactive";
  }
  return message.type === filter;
}

function formatCompactDate(value?: string | null) {
  return formatLocalizedDateTime(
    value,
    {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
    "none",
  );
}

function formatDateTime(value?: string | null) {
  return formatLocalizedDateTime(
    value,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
    "none",
  );
}

function formatTimelineDate(value: string) {
  return formatLocalizedDateTime(
    value,
    {
      month: "long",
      day: "numeric",
      weekday: "short",
    },
    "notRecorded",
  );
}

function formatCurrency(value: number, currency: "CNY" | "USD") {
  return formatAdminCurrency(value, currency, currency === "USD" ? 4 : 2);
}

function formatPercent(value: number) {
  return formatAdminPercent(value, value > 0 && value < 0.1 ? 1 : 0);
}





function formatReviewStatus(status: AdminChatRecordReviewStatus) {
  const t = translateRuntimeMessage;
  const found = REVIEW_STATUS_OPTIONS.find((item) => item.value === status);
  return found ? t(found.label) : status;
}

function reviewBadgeClassName(status: AdminChatRecordReviewStatus) {
  if (status === "important") {
    return "bg-rose-50 text-rose-700";
  }
  if (status === "watching") {
    return "bg-amber-50 text-amber-700";
  }
  if (status === "resolved") {
    return "bg-emerald-50 text-emerald-700";
  }
  return "bg-sky-50 text-sky-700";
}

function buildReplyLogicHref(conversationId: string, characterId?: string | null) {
  const params = new URLSearchParams();
  params.set("scope", "conversation");
  params.set("conversationId", conversationId);
  if (characterId) {
    params.set("characterId", characterId);
  }
  return `/reply-logic?${params.toString()}`;
}

function buildTokenUsageHref(conversationId: string, characterId?: string | null) {
  const params = new URLSearchParams();
  params.set("conversationId", conversationId);
  params.set("from", shiftDate(-29));
  params.set("to", formatDateInput(new Date()));
  if (characterId) {
    params.set("characterId", characterId);
  }
  return `/token-usage?${params.toString()}`;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return formatDateInput(next);
}

function downloadExportFile(file: AdminChatRecordConversationExportResponse) {
  const blob = new Blob([file.content], { type: file.contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function buildConversationFilterLabels({
  characterName,
  includeHidden,
  onlyReviewed,
  includeClearedHistory,
  activityWindow,
  sortBy,
}: {
  characterName: string;
  includeHidden: boolean;
  onlyReviewed: boolean;
  includeClearedHistory: boolean;
  activityWindow: AdminChatRecordActivityWindow;
  sortBy: AdminChatRecordConversationListQuery["sortBy"];
}) {
  const t = translateRuntimeMessage;
  const labels: string[] = [];
  if (characterName) {
    labels.push(`${t(msg`角色`)}：${characterName}`);
  }
  if (includeHidden) {
    labels.push(t(msg`显示隐藏会话`));
  }
  if (onlyReviewed) {
    labels.push(t(msg`仅看已标记样本`));
  }
  if (includeClearedHistory) {
    labels.push(t(msg`包含清空前历史`));
  }
  if (activityWindow !== "all") {
    const found = ACTIVITY_WINDOW_OPTIONS.find((item) => item.value === activityWindow);
    labels.push(`${t(msg`活跃范围`)}：${found ? t(found.label) : activityWindow}`);
  }
  if (sortBy && sortBy !== "lastActivityAt") {
    const found = SORT_OPTIONS.find((item) => item.value === sortBy);
    labels.push(`${t(msg`排序`)}：${found ? t(found.label) : sortBy}`);
  }
  return labels;
}

function buildSearchLabels(search: {
  keyword: string;
  messageType: AdminChatRecordConversationSearchQuery["messageType"] | "all";
  dateFrom: string;
  dateTo: string;
}) {
  const t = translateRuntimeMessage;
  const labels: string[] = [];
  if (search.keyword.trim()) {
    labels.push(`${t(msg`关键词`)}：${search.keyword.trim()}`);
  }
  if (search.messageType !== "all") {
    const found = TYPE_OPTIONS.find((item) => item.value === search.messageType);
    labels.push(`${t(msg`类型`)}：${found ? t(found.label) : search.messageType}`);
  }
  if (search.dateFrom) {
    labels.push(`${t(msg`起始`)}：${search.dateFrom}`);
  }
  if (search.dateTo) {
    labels.push(`${t(msg`结束`)}：${search.dateTo}`);
  }
  return labels;
}




