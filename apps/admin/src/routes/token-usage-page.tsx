import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type {
  Character,
  TokenPricingCatalog,
  TokenPricingCatalogItem,
  TokenUsageBillingSource,
  TokenUsageBudgetConfig,
  TokenUsageBudgetEnforcement,
  TokenUsageBudgetMetric,
  TokenUsageBudgetPeriodSummary,
  TokenUsageBudgetState,
  TokenUsageBudgetStatus,
  TokenUsageBreakdownItem,
  TokenUsageCharacterBudgetRule,
  TokenUsageCharacterBudgetStatus,
  TokenUsageDowngradeCharacterQualityItem,
  TokenUsageDowngradeModelSwitchItem,
  TokenUsageDowngradeReviewSample,
  TokenUsageQuery,
  TokenUsageStatus,
} from "@yinjie/contracts";
import {
  Button,
  Card,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
} from "@yinjie/ui";
import {
  AdminMetaText,
  AdminPageHero,
  AdminSectionHeader,
} from "../components/admin-workbench";
import { adminApi } from "../lib/admin-api";
import {
  formatAdminCurrency,
  formatAdminDateTime as formatLocalizedDateTime,
  formatAdminInteger,
  formatAdminPercent,
} from "../lib/format";

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function monthStartInput() {
  const date = new Date();
  date.setDate(1);
  return formatDateInput(date);
}

function readInitialTokenUsageFocus(search?: string): {
  from: string;
  to: string;
  grain: "day" | "week" | "month";
  characterId: string;
  conversationId: string;
} {
  const raw =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(raw);
  const grain = params.get("grain");

  return {
    from: params.get("from")?.trim() || shiftDate(-6),
    to: params.get("to")?.trim() || formatDateInput(new Date()),
    grain: grain === "week" || grain === "month" ? grain : ("day" as const),
    characterId: params.get("characterId")?.trim() || "",
    conversationId: params.get("conversationId")?.trim() || "",
  };
}

function formatInteger(value: number) {
  return formatAdminInteger(value);
}

function formatCost(value: number, currency: "CNY" | "USD") {
  return formatAdminCurrency(value, currency, 2);
}

function formatDateTime(value: string) {
  return formatLocalizedDateTime(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBudgetValue(
  value: number | null,
  metric: TokenUsageBudgetMetric,
  currency: "CNY" | "USD",
) {
  if (value == null) {
    return translateRuntimeMessage(msg`未设置`);
  }
  return metric === "cost"
    ? formatCost(value, currency)
    : `${formatInteger(value)} token`;
}

function formatRatio(value: number | null) {
  if (value == null) {
    return translateRuntimeMessage(msg`未启用`);
  }
  return formatAdminPercent(value, 0);
}

function emptyPricingItem(): TokenPricingCatalogItem {
  return {
    model: "",
    inputPer1kTokens: 0,
    outputPer1kTokens: 0,
    enabled: true,
  };
}

function emptyBudgetConfig(): TokenUsageBudgetConfig {
  return {
    overall: {
      enabled: false,
      metric: "tokens",
      enforcement: "monitor",
      downgradeModel: null,
      dailyLimit: null,
      monthlyLimit: null,
      warningRatio: 0.8,
    },
    characters: [],
  };
}

function emptyCharacterBudgetRule(
  characterId = "",
): TokenUsageCharacterBudgetRule {
  return {
    characterId,
    enabled: true,
    metric: "tokens",
    enforcement: "monitor",
    downgradeModel: null,
    dailyLimit: null,
    monthlyLimit: null,
    warningRatio: 0.8,
    note: "",
  };
}

type TokenUsageWorkspace = "overview" | "budget" | "exceptions" | "pricing";
type TokenUsageExceptionView = "blocked" | "downgraded" | "quality";

export function TokenUsagePage() {
  const t = translateRuntimeMessage;
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationSearch = location.searchStr ?? "";
  const initialFocus = useMemo(
    () => readInitialTokenUsageFocus(locationSearch),
    [locationSearch],
  );
  const [from, setFrom] = useState(() => initialFocus.from);
  const [to, setTo] = useState(() => initialFocus.to);
  const [grain, setGrain] = useState<"day" | "week" | "month">(
    initialFocus.grain,
  );
  const [characterId, setCharacterId] = useState(initialFocus.characterId);
  const [conversationId, setConversationId] = useState(
    initialFocus.conversationId,
  );

  // Re-sync filters when URL search changes (e.g. user clicks a
  // /token-usage?... link from chat-records or elsewhere mid-session).
  useEffect(() => {
    setFrom(initialFocus.from);
    setTo(initialFocus.to);
    setGrain(initialFocus.grain);
    setCharacterId(initialFocus.characterId);
    setConversationId(initialFocus.conversationId);
  }, [
    initialFocus.from,
    initialFocus.to,
    initialFocus.grain,
    initialFocus.characterId,
    initialFocus.conversationId,
  ]);
  const [status, setStatus] = useState<"" | TokenUsageStatus>("");
  const [billingSource, setBillingSource] = useState<
    "" | TokenUsageBillingSource
  >("");
  const [pricingDraft, setPricingDraft] = useState<TokenPricingCatalog | null>(
    null,
  );
  const [budgetDraft, setBudgetDraft] = useState<TokenUsageBudgetConfig | null>(
    null,
  );
  const [activeWorkspace, setActiveWorkspace] =
    useState<TokenUsageWorkspace>("overview");
  const [activeExceptionView, setActiveExceptionView] =
    useState<TokenUsageExceptionView>("blocked");
  const activeQuickRange = resolveActiveQuickRange(from, to);

  const listQuery = useMemo<TokenUsageQuery>(
    () => ({
      from,
      to,
      grain,
      characterId: characterId || undefined,
      conversationId: conversationId || undefined,
      status: status || undefined,
      billingSource: billingSource || undefined,
      limit: 8,
    }),
    [billingSource, characterId, conversationId, from, grain, status, to],
  );

  const recordsQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...listQuery,
      page: 1,
      pageSize: 20,
    }),
    [listQuery],
  );

  const blockedBaseQuery = useMemo<TokenUsageQuery>(
    () => ({
      from,
      to,
      characterId: characterId || undefined,
      conversationId: conversationId || undefined,
      billingSource: billingSource || undefined,
      status: "failed",
      errorCode: "BUDGET_BLOCKED",
    }),
    [billingSource, characterId, conversationId, from, to],
  );

  const blockedTrendQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...blockedBaseQuery,
      grain,
    }),
    [blockedBaseQuery, grain],
  );

  const blockedBreakdownQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...blockedBaseQuery,
      limit: 5,
    }),
    [blockedBaseQuery],
  );

  const blockedRecordsQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...blockedBaseQuery,
      page: 1,
      pageSize: 8,
    }),
    [blockedBaseQuery],
  );

  const downgradedBaseQuery = useMemo<TokenUsageQuery>(
    () => ({
      from,
      to,
      characterId: characterId || undefined,
      conversationId: conversationId || undefined,
      billingSource: billingSource || undefined,
      status: "success",
      errorCode: "BUDGET_DOWNGRADED",
    }),
    [billingSource, characterId, conversationId, from, to],
  );

  const downgradedTrendQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...downgradedBaseQuery,
      grain,
    }),
    [downgradedBaseQuery, grain],
  );

  const downgradedBreakdownQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...downgradedBaseQuery,
      limit: 5,
    }),
    [downgradedBaseQuery],
  );

  const downgradedRecordsQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...downgradedBaseQuery,
      page: 1,
      pageSize: 8,
    }),
    [downgradedBaseQuery],
  );

  const downgradeInsightsQueryInput = useMemo<TokenUsageQuery>(
    () => ({
      ...downgradedBaseQuery,
      limit: 6,
    }),
    [downgradedBaseQuery],
  );

  const charactersQuery = useQuery({
    queryKey: ["admin-token-usage-characters"],
    queryFn: () => adminApi.getCharacters(),
  });

  const overviewQuery = useQuery({
    queryKey: ["admin-token-usage-overview", listQuery],
    queryFn: () => adminApi.getTokenUsageOverview(listQuery),
  });

  const trendQuery = useQuery({
    queryKey: ["admin-token-usage-trend", listQuery],
    queryFn: () => adminApi.getTokenUsageTrend(listQuery),
  });

  const breakdownQuery = useQuery({
    queryKey: ["admin-token-usage-breakdown", listQuery],
    queryFn: () => adminApi.getTokenUsageBreakdown(listQuery),
  });

  const recordsQuery = useQuery({
    queryKey: ["admin-token-usage-records", recordsQueryInput],
    queryFn: () => adminApi.getTokenUsageRecords(recordsQueryInput),
  });

  const blockedOverviewQuery = useQuery({
    queryKey: ["admin-token-usage-blocked-overview", blockedBaseQuery],
    queryFn: () => adminApi.getTokenUsageOverview(blockedBaseQuery),
  });

  const blockedTrendQuery = useQuery({
    queryKey: ["admin-token-usage-blocked-trend", blockedTrendQueryInput],
    queryFn: () => adminApi.getTokenUsageTrend(blockedTrendQueryInput),
  });

  const blockedBreakdownQuery = useQuery({
    queryKey: [
      "admin-token-usage-blocked-breakdown",
      blockedBreakdownQueryInput,
    ],
    queryFn: () => adminApi.getTokenUsageBreakdown(blockedBreakdownQueryInput),
  });

  const blockedRecordsQuery = useQuery({
    queryKey: ["admin-token-usage-blocked-records", blockedRecordsQueryInput],
    queryFn: () => adminApi.getTokenUsageRecords(blockedRecordsQueryInput),
  });

  const downgradedOverviewQuery = useQuery({
    queryKey: ["admin-token-usage-downgraded-overview", downgradedBaseQuery],
    queryFn: () => adminApi.getTokenUsageOverview(downgradedBaseQuery),
  });

  const downgradedTrendQuery = useQuery({
    queryKey: ["admin-token-usage-downgraded-trend", downgradedTrendQueryInput],
    queryFn: () => adminApi.getTokenUsageTrend(downgradedTrendQueryInput),
  });

  const downgradedBreakdownQuery = useQuery({
    queryKey: [
      "admin-token-usage-downgraded-breakdown",
      downgradedBreakdownQueryInput,
    ],
    queryFn: () =>
      adminApi.getTokenUsageBreakdown(downgradedBreakdownQueryInput),
  });

  const downgradedRecordsQuery = useQuery({
    queryKey: [
      "admin-token-usage-downgraded-records",
      downgradedRecordsQueryInput,
    ],
    queryFn: () => adminApi.getTokenUsageRecords(downgradedRecordsQueryInput),
  });

  const downgradeInsightsQuery = useQuery({
    queryKey: [
      "admin-token-usage-downgrade-insights",
      downgradeInsightsQueryInput,
    ],
    queryFn: () =>
      adminApi.getTokenUsageDowngradeInsights(downgradeInsightsQueryInput),
  });

  const downgradeQualityQuery = useQuery({
    queryKey: [
      "admin-token-usage-downgrade-quality",
      downgradeInsightsQueryInput,
    ],
    queryFn: () =>
      adminApi.getTokenUsageDowngradeQuality(downgradeInsightsQueryInput),
  });

  const pricingQuery = useQuery({
    queryKey: ["admin-token-usage-pricing"],
    queryFn: () => adminApi.getTokenUsagePricing(),
  });

  const budgetQuery = useQuery({
    queryKey: ["admin-token-usage-budgets"],
    queryFn: () => adminApi.getTokenUsageBudgets(),
  });

  useEffect(() => {
    if (pricingQuery.data) {
      setPricingDraft(pricingQuery.data);
    }
  }, [pricingQuery.data]);

  useEffect(() => {
    if (budgetQuery.data) {
      setBudgetDraft(budgetQuery.data.config);
    }
  }, [budgetQuery.data]);

  const savePricingMutation = useMutation({
    mutationFn: async () => {
      if (!pricingDraft) {
        throw new Error(translateRuntimeMessage(msg`价格配置暂不可用。`));
      }

      const items = pricingDraft.items
        .map((item) => ({
          model: item.model.trim(),
          inputPer1kTokens: Number(item.inputPer1kTokens) || 0,
          outputPer1kTokens: Number(item.outputPer1kTokens) || 0,
          enabled: item.enabled !== false,
          note: item.note?.trim() || undefined,
        }))
        .filter((item) => item.model);

      return adminApi.setTokenUsagePricing({
        currency: pricingDraft.currency,
        items,
      });
    },
    onSuccess: async (result) => {
      setPricingDraft(result);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-pricing"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-overview"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-trend"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-breakdown"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-records"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-downgrade-insights"],
        }),
      ]);
    },
  });

  const syncN1nMutation = useMutation({
    mutationFn: () => adminApi.syncTokenUsagePricingFromN1n(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-pricing"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-overview"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-trend"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-breakdown"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-records"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-token-usage-downgrade-insights"],
        }),
      ]);
    },
  });

  const saveBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!budgetDraft) {
        throw new Error(translateRuntimeMessage(msg`预算配置暂不可用。`));
      }
      return adminApi.setTokenUsageBudgets({
        overall: {
          ...budgetDraft.overall,
          downgradeModel: budgetDraft.overall.downgradeModel?.trim() || null,
          dailyLimit: normalizeNullableNumber(budgetDraft.overall.dailyLimit),
          monthlyLimit: normalizeNullableNumber(
            budgetDraft.overall.monthlyLimit,
          ),
        },
        characters: budgetDraft.characters
          .map((item) => ({
            ...item,
            characterId: item.characterId.trim(),
            downgradeModel: item.downgradeModel?.trim() || null,
            dailyLimit: normalizeNullableNumber(item.dailyLimit),
            monthlyLimit: normalizeNullableNumber(item.monthlyLimit),
            note: item.note?.trim() || undefined,
          }))
          .filter((item) => item.characterId),
      });
    },
    onSuccess: async (result) => {
      setBudgetDraft(result.config);
      await queryClient.invalidateQueries({
        queryKey: ["admin-token-usage-budgets"],
      });
    },
  });

  const loading =
    overviewQuery.isLoading ||
    trendQuery.isLoading ||
    breakdownQuery.isLoading ||
    recordsQuery.isLoading ||
    blockedOverviewQuery.isLoading ||
    blockedTrendQuery.isLoading ||
    blockedBreakdownQuery.isLoading ||
    blockedRecordsQuery.isLoading ||
    downgradedOverviewQuery.isLoading ||
    downgradedTrendQuery.isLoading ||
    downgradedBreakdownQuery.isLoading ||
    downgradedRecordsQuery.isLoading ||
    downgradeInsightsQuery.isLoading ||
    downgradeQualityQuery.isLoading ||
    pricingQuery.isLoading ||
    budgetQuery.isLoading;

  const fatalError =
    (overviewQuery.error instanceof Error && overviewQuery.error) ||
    (trendQuery.error instanceof Error && trendQuery.error) ||
    (breakdownQuery.error instanceof Error && breakdownQuery.error) ||
    (recordsQuery.error instanceof Error && recordsQuery.error) ||
    (blockedOverviewQuery.error instanceof Error &&
      blockedOverviewQuery.error) ||
    (blockedTrendQuery.error instanceof Error && blockedTrendQuery.error) ||
    (blockedBreakdownQuery.error instanceof Error &&
      blockedBreakdownQuery.error) ||
    (blockedRecordsQuery.error instanceof Error && blockedRecordsQuery.error) ||
    (downgradedOverviewQuery.error instanceof Error &&
      downgradedOverviewQuery.error) ||
    (downgradedTrendQuery.error instanceof Error &&
      downgradedTrendQuery.error) ||
    (downgradedBreakdownQuery.error instanceof Error &&
      downgradedBreakdownQuery.error) ||
    (downgradedRecordsQuery.error instanceof Error &&
      downgradedRecordsQuery.error) ||
    (downgradeInsightsQuery.error instanceof Error &&
      downgradeInsightsQuery.error) ||
    (downgradeQualityQuery.error instanceof Error &&
      downgradeQualityQuery.error) ||
    (pricingQuery.error instanceof Error && pricingQuery.error) ||
    (budgetQuery.error instanceof Error && budgetQuery.error) ||
    null;

  const overview = overviewQuery.data;
  const trend = trendQuery.data ?? [];
  const breakdown = breakdownQuery.data;
  const records = recordsQuery.data;
  const blockedOverview = blockedOverviewQuery.data;
  const blockedTrend = blockedTrendQuery.data ?? [];
  const blockedBreakdown = blockedBreakdownQuery.data;
  const blockedRecords = blockedRecordsQuery.data;
  const downgradedOverview = downgradedOverviewQuery.data;
  const downgradedTrend = downgradedTrendQuery.data ?? [];
  const downgradedBreakdown = downgradedBreakdownQuery.data;
  const downgradedRecords = downgradedRecordsQuery.data;
  const downgradeInsights = downgradeInsightsQuery.data;
  const downgradeQuality = downgradeQualityQuery.data;
  const budgetSummary = budgetQuery.data?.summary;
  const characters = charactersQuery.data ?? [];
  const currency =
    overview?.currency ??
    pricingDraft?.currency ??
    budgetSummary?.currency ??
    "CNY";
  const hasConfiguredPricing = Boolean(
    pricingDraft?.items.some(
      (item) =>
        item.enabled &&
        (item.inputPer1kTokens > 0 || item.outputPer1kTokens > 0),
    ),
  );

  const maxTrendTokens = Math.max(...trend.map((item) => item.totalTokens), 1);
  const maxBlockedRequestCount = Math.max(
    ...blockedTrend.map((item) => item.requestCount),
    1,
  );
  const maxDowngradedRequestCount = Math.max(
    ...downgradedTrend.map((item) => item.requestCount),
    1,
  );

  const availableCharacters = (() => {
    const used = new Set(
      (budgetDraft?.characters ?? []).map((item) => item.characterId),
    );
    return characters.filter((item) => !used.has(item.id));
  })();

  if (
    loading &&
    !overview &&
    !breakdown &&
    !records &&
    !budgetSummary &&
    !blockedOverview &&
    !downgradedOverview &&
    !downgradeInsights &&
    !downgradeQuality
  ) {
    return <LoadingBlock label={t(msg`正在加载 Token 用量中心...`)} />;
  }

  if (fatalError) {
    return <ErrorBlock message={fatalError.message} />;
  }

  const overallBudgetStatus =
    budgetSummary?.overall ?? createInactiveBudgetStatus();
  const blockedRequestCount = blockedOverview?.requestCount ?? 0;
  const blockedLastRecord = blockedRecords?.items[0] ?? null;
  const blockedFailureShare = calculateRatio(
    blockedRequestCount,
    overview?.failedCount ?? 0,
  );
  const downgradedRequestCount = downgradedOverview?.requestCount ?? 0;
  const downgradedLastRecord = downgradedRecords?.items[0] ?? null;
  const downgradedSuccessShare = calculateRatio(
    downgradedRequestCount,
    overview?.successCount ?? 0,
  );
  const downgradeSwitches = downgradeInsights?.byModelSwitch ?? [];
  const downgradeTraceability = calculateRatio(
    downgradeInsights?.traceableRequestCount ?? 0,
    downgradeInsights?.requestCount ?? 0,
  );
  const downgradeScopedCoverage = calculateRatio(
    downgradeQuality?.conversationScopedRequestCount ?? 0,
    downgradeQuality?.requestCount ?? 0,
  );
  const qualityByCharacter = downgradeQuality?.byCharacter ?? [];
  const tooWeakSamples = downgradeQuality?.tooWeakSamples ?? [];
  const pendingOutcomeSamples = downgradeQuality?.pendingOutcomeSamples ?? [];
  const activeCharacterName =
    characters.find((item) => item.id === characterId)?.name ?? "";
  const overallBudgetState = resolveBudgetState(overallBudgetStatus);
  const budgetAlertCount = budgetSummary?.alerts.length ?? 0;
  const enabledPricingCount = (pricingDraft?.items ?? []).filter(
    (item) => item.enabled !== false,
  ).length;
  const configuredPricingCount = (pricingDraft?.items ?? []).filter(
    (item) =>
      item.enabled !== false &&
      item.model.trim() &&
      (item.inputPer1kTokens > 0 || item.outputPer1kTokens > 0),
  ).length;
  const activeFilterTags = [
    { label: t(msg`时间`), value: `${from} 至 ${to}` },
    {
      label: t(msg`粒度`),
      value:
        grain === "month"
          ? t(msg`按月`)
          : grain === "week"
            ? t(msg`按周`)
            : t(msg`按天`),
    },
    characterId
      ? { label: t(msg`角色`), value: activeCharacterName || characterId }
      : null,
    conversationId ? { label: t(msg`会话`), value: conversationId } : null,
    status
      ? {
          label: t(msg`状态`),
          value: status === "success" ? t(msg`仅成功`) : t(msg`仅失败`),
        }
      : null,
    billingSource
      ? { label: t(msg`计费来源`), value: formatBillingSource(billingSource) }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const workspaceItems = [
    {
      key: "overview",
      label: t(msg`总览`),
      detail: t(msg`看趋势、排行和最近账本，先判断是否真的有异常。`),
      badge: `${formatInteger(overview?.requestCount ?? 0)} ${t(msg`次请求`)}`,
      tone: "default" as const,
    },
    {
      key: "budget",
      label: t(msg`预算操作`),
      detail: t(msg`查看整体和角色预算状态，集中调整规则和阈值。`),
      badge: budgetAlertCount
        ? `${formatInteger(budgetAlertCount)} ${t(msg`条预警`)}`
        : t(msg`当前无预警`),
      tone: (overallBudgetState === "exceeded" ||
      overallBudgetState === "warning"
        ? "warning"
        : "success") as "warning" | "success",
    },
    {
      key: "exceptions",
      label: t(msg`异常闭环`),
      detail: t(msg`排查预算阻断、自动降级和质量回看样本。`),
      badge:
        blockedRequestCount || downgradedRequestCount
          ? `${formatInteger(blockedRequestCount + downgradedRequestCount)} ${t(msg`条异常`)}`
          : t(msg`当前无异常`),
      tone: (blockedRequestCount || downgradedRequestCount
        ? "warning"
        : "success") as "warning" | "success",
    },
    {
      key: "pricing",
      label: t(msg`价格配置`),
      detail: t(msg`维护模型单价，保证费用估算口径稳定可用。`),
      badge: configuredPricingCount
        ? `${formatInteger(configuredPricingCount)} ${t(msg`个已计价模型`)}`
        : t(msg`待补价格`),
      tone: (configuredPricingCount ? "info" : "warning") as "info" | "warning",
    },
  ];
  const exceptionViewItems = [
    {
      key: "blocked",
      label: t(msg`预算阻断`),
      detail: t(msg`优先确认哪些请求被直接拦截、是否误伤关键角色。`),
      badge: blockedRequestCount
        ? `${formatInteger(blockedRequestCount)} ${t(msg`次阻断`)}`
        : t(msg`当前无阻断`),
      tone: (blockedRequestCount ? "warning" : "success") as
        | "warning"
        | "success",
    },
    {
      key: "downgraded",
      label: t(msg`预算降级`),
      detail: t(msg`看哪些请求被降级，以及是否集中命中某些角色或场景。`),
      badge: downgradedRequestCount
        ? `${formatInteger(downgradedRequestCount)} ${t(msg`次降级`)}`
        : t(msg`当前无降级`),
      tone: (downgradedRequestCount ? "info" : "success") as "info" | "success",
    },
    {
      key: "quality",
      label: t(msg`降级质量`),
      detail: t(msg`检查节省是否有效，质量是否还能接受，是否需要复盘。`),
      badge: downgradeQuality?.reviewedConversationCount
        ? `${formatInteger(downgradeQuality.reviewedConversationCount)} ${t(msg`条已复盘`)}`
        : t(msg`等待复盘样本`),
      tone: ((downgradeQuality?.tooWeakConversationCount ?? 0) > 0 ||
      pendingOutcomeSamples.length > 0
        ? "warning"
        : "info") as "warning" | "info",
    },
  ];
  const budgetFocusItems = [...(budgetSummary?.characters ?? [])]
    .sort((left, right) => compareBudgetStatus(left.budget, right.budget))
    .slice(0, 4);
  const topBlockedCharacter = blockedBreakdown?.byCharacter[0] ?? null;
  const topDowngradedCharacter = downgradedBreakdown?.byCharacter[0] ?? null;
  const topTooWeakCharacter = qualityByCharacter[0] ?? null;
  const resetFilters = () => {
    applyPreset("7d", setFrom, setTo);
    setGrain("day");
    setCharacterId("");
    setConversationId("");
    setStatus("");
    setBillingSource("");
  };

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow={t(msg`AI 用量`)}
        title={t(msg`Token 用量与预算中心`)}
        description={t(
          msg`这里把实例里的 AI 请求沉淀成运营账本，方便先看预算健康度，再处理阻断、降级和价格配置。`,
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickRangeButton
              label={t(msg`今日`)}
              active={activeQuickRange === "today"}
              onClick={() => applyPreset("today", setFrom, setTo)}
            />
            <QuickRangeButton
              label={t(msg`近 7 天`)}
              active={activeQuickRange === "7d"}
              onClick={() => applyPreset("7d", setFrom, setTo)}
            />
            <QuickRangeButton
              label={t(msg`近 30 天`)}
              active={activeQuickRange === "30d"}
              onClick={() => applyPreset("30d", setFrom, setTo)}
            />
            <QuickRangeButton
              label={t(msg`本月`)}
              active={activeQuickRange === "month"}
              onClick={() => applyPreset("month", setFrom, setTo)}
            />
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              {t(msg`重置筛选`)}
            </Button>
          </div>
        }
        metrics={[
          {
            label: t(msg`总 Token`),
            value: formatInteger(overview?.totalTokens ?? 0),
          },
          {
            label: t(msg`输入 Token`),
            value: formatInteger(overview?.promptTokens ?? 0),
          },
          {
            label: t(msg`输出 Token`),
            value: formatInteger(overview?.completionTokens ?? 0),
          },
          {
            label: t(msg`估算费用`),
            value: formatCost(overview?.estimatedCost ?? 0, currency),
          },
        ]}
      />

      {savePricingMutation.isError &&
      savePricingMutation.error instanceof Error ? (
        <ErrorBlock message={savePricingMutation.error.message} />
      ) : null}

      {saveBudgetMutation.isError &&
      saveBudgetMutation.error instanceof Error ? (
        <ErrorBlock message={saveBudgetMutation.error.message} />
      ) : null}

      <Card className="bg-[color:var(--surface-console)]">
        <AdminSectionHeader
          title={t(msg`工作区切换`)}
          actions={
            <span className="text-xs text-[color:var(--text-muted)]">
              {t(msg`当前视图：`)}
              {workspaceItems.find((item) => item.key === activeWorkspace)
                ?.label ?? t(msg`总览`)}
            </span>
          }
        />

        <div className="mt-5">
          <SelectionDeck
            items={workspaceItems}
            activeKey={activeWorkspace}
            onChange={(key) => setActiveWorkspace(key as TokenUsageWorkspace)}
          />
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <AdminMetaText>{t(msg`当前口径`)}</AdminMetaText>
            <span className="text-xs text-[color:var(--text-muted)]">
              {formatInteger(activeFilterTags.length)} {t(msg`个条件`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilterTags.map((item) => (
              <ActiveFilterPill
                key={`${item.label}-${item.value}`}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-5 bg-[color:var(--surface-console)]">
        <AdminSectionHeader
          title={t(msg`筛选工作台`)}
          actions={
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              {t(msg`重置筛选`)}
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <FilterField label={t(msg`开始日期`)}>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={INPUT_CLASS_NAME}
            />
          </FilterField>
          <FilterField label={t(msg`结束日期`)}>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className={INPUT_CLASS_NAME}
            />
          </FilterField>
          <FilterField label={t(msg`聚合粒度`)}>
            <select
              value={grain}
              onChange={(event) =>
                setGrain(event.target.value as "day" | "week" | "month")
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="day">{t(msg`按天`)}</option>
              <option value="week">{t(msg`按周`)}</option>
              <option value="month">{t(msg`按月`)}</option>
            </select>
          </FilterField>
          <FilterField label={t(msg`角色`)}>
            <select
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
              className={INPUT_CLASS_NAME}
            >
              <option value="">{t(msg`全部角色`)}</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t(msg`请求状态`)}>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "" | TokenUsageStatus)
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="">{t(msg`全部状态`)}</option>
              <option value="success">{t(msg`仅成功`)}</option>
              <option value="failed">{t(msg`仅失败`)}</option>
            </select>
          </FilterField>
          <FilterField label={t(msg`计费来源`)}>
            <select
              value={billingSource}
              onChange={(event) =>
                setBillingSource(
                  event.target.value as "" | TokenUsageBillingSource,
                )
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="">{t(msg`全部来源`)}</option>
              <option value="instance_default">{t(msg`实例默认 Key`)}</option>
              <option value="owner_custom">{t(msg`世界主人 Key`)}</option>
            </select>
          </FilterField>
        </div>

        <div className="flex flex-wrap gap-2">
          {conversationId ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConversationId("")}
            >
              {t(msg`清除会话聚焦`)}
            </Button>
          ) : null}
          {characterId ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCharacterId("")}
            >
              {t(msg`清除角色筛选`)}
            </Button>
          ) : null}
          {status ? (
            <Button variant="secondary" size="sm" onClick={() => setStatus("")}>
              {t(msg`清除状态筛选`)}
            </Button>
          ) : null}
          {billingSource ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBillingSource("")}
            >
              {t(msg`清除计费来源`)}
            </Button>
          ) : null}
        </div>
      </Card>

      {activeWorkspace === "overview" ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card className="bg-[color:var(--surface-console)]">
              <AdminSectionHeader
                title={t(msg`时间趋势`)}
                actions={
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {t(msg`请求`)} {formatInteger(overview?.requestCount ?? 0)}{" "}
                    {t(msg`次`)}
                  </span>
                }
              />
              {trend.length ? (
                <div className="mt-5 space-y-3">
                  {trend.map((point) => (
                    <div key={point.bucketStart} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--text-secondary)]">
                        <span>{point.label}</span>
                        <span>
                          {formatInteger(point.totalTokens)} token /{" "}
                          {formatCost(point.estimatedCost, currency)}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-[color:var(--surface-primary)]">
                        <div
                          className="h-3 rounded-full bg-[linear-gradient(90deg,rgba(249,115,22,0.92),rgba(244,114,182,0.9))]"
                          style={{
                            width: `${Math.max(6, (point.totalTokens / maxTrendTokens) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  text={t(msg`当前筛选条件下还没有可展示的趋势数据。`)}
                />
              )}
            </Card>

            <Card className="bg-[color:var(--surface-console)]">
              <AdminSectionHeader title={t(msg`运行概况`)} />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SummaryTile
                  label={t(msg`成功请求`)}
                  value={formatInteger(overview?.successCount ?? 0)}
                />
                <SummaryTile
                  label={t(msg`失败请求`)}
                  value={formatInteger(overview?.failedCount ?? 0)}
                />
                <SummaryTile
                  label={t(msg`活跃角色`)}
                  value={formatInteger(overview?.activeCharacterCount ?? 0)}
                />
                <SummaryTile
                  label={t(msg`平均单次 Token`)}
                  value={formatInteger(
                    calculateAverageTokens(
                      overview?.totalTokens ?? 0,
                      overview?.requestCount ?? 0,
                    ),
                  )}
                />
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <AdminMetaText>{t(msg`运营提示`)}</AdminMetaText>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {t(msg`查看口径摘要`)}
                  </span>
                </div>
                <div className="grid gap-3">
                  <FocusSignalCard
                    title={t(msg`整体预算`)}
                    value={formatBudgetState(overallBudgetState)}
                    detail={`${t(msg`今日 / 本月按真实账本累计判断，当前模式为`)} ${formatBudgetEnforcement(overallBudgetStatus.enforcement)}`}
                    tone={
                      overallBudgetState === "exceeded" ||
                      overallBudgetState === "warning"
                        ? "warning"
                        : "default"
                    }
                  />
                  <FocusSignalCard
                    title={t(msg`价格配置`)}
                    value={
                      hasConfiguredPricing ? t(msg`已就绪`) : t(msg`待补价格`)
                    }
                    detail={
                      hasConfiguredPricing
                        ? `${t(msg`已计价`)} ${formatInteger(configuredPricingCount)} ${t(msg`个模型`)}`
                        : t(msg`补充模型单价后，新入账请求才会写入价格快照`)
                    }
                    tone={hasConfiguredPricing ? "info" : "warning"}
                  />
                  <FocusSignalCard
                    title={t(msg`会话聚焦`)}
                    value={conversationId ? t(msg`已开启`) : t(msg`未聚焦`)}
                    detail={conversationId || t(msg`当前正在查看全局账本`)}
                    tone={conversationId ? "info" : "default"}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-4">
            <BreakdownCard
              title={t(msg`角色排行`)}
              items={breakdown?.byCharacter ?? []}
              currency={currency}
              emptyText={t(msg`当前还没有角色维度的账本。`)}
            />
            <BreakdownCard
              title={t(msg`场景排行`)}
              items={breakdown?.byScene ?? []}
              currency={currency}
              emptyText={t(msg`当前还没有场景维度的账本。`)}
              labelFormatter={(item) => formatScene(item.key)}
            />
            <BreakdownCard
              title={t(msg`模型排行`)}
              items={breakdown?.byModel ?? []}
              currency={currency}
              emptyText={t(msg`当前还没有模型维度的账本。`)}
            />
            <BreakdownCard
              title={t(msg`计费来源`)}
              items={breakdown?.byBillingSource ?? []}
              currency={currency}
              emptyText={t(msg`当前还没有计费来源维度的账本。`)}
            />
          </div>

          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader title={t(msg`最近账本明细`)} />
            {records?.items.length ? (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">{t(msg`时间`)}</th>
                      <th className="pb-3 pr-4 font-medium">{t(msg`对象`)}</th>
                      <th className="pb-3 pr-4 font-medium">{t(msg`场景`)}</th>
                      <th className="pb-3 pr-4 font-medium">{t(msg`模型`)}</th>
                      <th className="pb-3 pr-4 font-medium">Token</th>
                      <th className="pb-3 pr-4 font-medium">{t(msg`费用`)}</th>
                      <th className="pb-3 font-medium">{t(msg`状态`)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-faint)] text-[color:var(--text-secondary)]">
                    {records.items.map((record) => (
                      <tr key={record.id}>
                        <td className="py-3 pr-4">
                          {formatDateTime(record.occurredAt)}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium text-[color:var(--text-primary)]">
                            {record.targetLabel}
                          </div>
                          <div className="text-xs text-[color:var(--text-muted)]">
                            {record.characterName || record.scopeType}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {formatScene(record.scene)}
                        </td>
                        <td className="py-3 pr-4">
                          {record.model || t(msg`未记录`)}
                        </td>
                        <td className="py-3 pr-4">
                          <div>{formatInteger(record.totalTokens)}</div>
                          <div className="text-xs text-[color:var(--text-muted)]">
                            {t(msg`输入`)} {formatInteger(record.promptTokens)}{" "}
                            / {t(msg`输出`)}{" "}
                            {formatInteger(record.completionTokens)}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {formatCost(record.estimatedCost, record.currency)}
                        </td>
                        <td className="py-3">
                          <div className="space-y-1">
                            <span
                              className={
                                record.status === "success"
                                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                                  : "rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                              }
                            >
                              {record.status === "success"
                                ? t(msg`成功`)
                                : t(msg`失败`)}
                            </span>
                            {record.errorCode ? (
                              <div className="text-xs text-[color:var(--text-muted)]">
                                {formatErrorCode(record.errorCode)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text={t(msg`当前筛选条件下还没有账本明细。`)} />
            )}
          </Card>
        </>
      ) : null}

      {activeWorkspace === "budget" ? (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader
              title={t(msg`预算与预警`)}
              actions={
                budgetSummary ? (
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {t(msg`更新于`)} {formatDateTime(budgetSummary.generatedAt)}
                  </span>
                ) : null
              }
            />

            <div className="mt-5 space-y-5">
              <BudgetStatusPanel
                title={t(msg`整体预算`)}
                description={t(
                  msg`按今天和本月累计的真实账本用量来判断是否逼近阈值。`,
                )}
                status={overallBudgetStatus}
                currency={currency}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <AdminMetaText>{t(msg`预警列表`)}</AdminMetaText>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {budgetSummary?.alerts.length ?? 0} {t(msg`条`)}
                  </span>
                </div>
                {budgetSummary?.alerts.length ? (
                  <div className="grid gap-3">
                    {budgetSummary.alerts.map((alert, index) => (
                      <div
                        key={`${alert.scope}-${alert.period}-${alert.characterId ?? "overall"}-${index}`}
                        className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-[color:var(--text-primary)]">
                              {alert.message}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {t(msg`已使用`)}{" "}
                              {formatBudgetValue(
                                alert.used,
                                alert.metric,
                                currency,
                              )}{" "}
                              / {t(msg`上限`)}{" "}
                              {formatBudgetValue(
                                alert.limit,
                                alert.metric,
                                currency,
                              )}
                            </div>
                          </div>
                          <BudgetStateBadge state={alert.level} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text={t(msg`当前没有触发预算预警。`)} />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <AdminMetaText>{t(msg`按角色预算`)}</AdminMetaText>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {(budgetSummary?.characters ?? []).length} {t(msg`个角色`)}
                  </span>
                </div>
                {(budgetSummary?.characters ?? []).length ? (
                  <div className="grid gap-3">
                    {(budgetSummary?.characters ?? []).map((item) => (
                      <CharacterBudgetPanel
                        key={item.characterId}
                        item={item}
                        currency={currency}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState text={t(msg`还没有配置任何角色预算。`)} />
                )}
              </div>
            </div>
          </Card>

          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader
              title={t(msg`预算配置`)}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    addCharacterBudgetRule(setBudgetDraft, characters)
                  }
                  disabled={!availableCharacters.length}
                >
                  {t(msg`新增角色预算`)}
                </Button>
              }
            />

            <div className="mt-5 space-y-5">
              <div className="rounded-[20px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-[color:var(--text-primary)]">
                      {t(msg`整体预算`)}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)]">
                      {t(
                        msg`支持按 token 或费用设置日预算、月预算和预警阈值。`,
                      )}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={budgetDraft?.overall.enabled === true}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  enabled: event.target.checked,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    {t(msg`启用`)}
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FilterField label={t(msg`预算维度`)}>
                    <select
                      value={budgetDraft?.overall.metric ?? "tokens"}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  metric:
                                    event.target.value === "cost"
                                      ? "cost"
                                      : "tokens",
                                },
                              }
                            : current,
                        )
                      }
                      className={INPUT_CLASS_NAME}
                    >
                      <option value="tokens">{t(msg`按 Token`)}</option>
                      <option value="cost">{t(msg`按费用`)}</option>
                    </select>
                  </FilterField>
                  <FilterField label={t(msg`执行方式`)}>
                    <select
                      value={budgetDraft?.overall.enforcement ?? "monitor"}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  enforcement:
                                    event.target.value === "block"
                                      ? "block"
                                      : event.target.value === "downgrade"
                                        ? "downgrade"
                                        : "monitor",
                                },
                              }
                            : current,
                        )
                      }
                      className={INPUT_CLASS_NAME}
                    >
                      <option value="monitor">{t(msg`监控预警`)}</option>
                      <option value="downgrade">{t(msg`超限降级`)}</option>
                      <option value="block">{t(msg`超限阻断`)}</option>
                    </select>
                  </FilterField>
                  <FilterField label={t(msg`降级模型`)}>
                    <input
                      value={budgetDraft?.overall.downgradeModel ?? ""}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  downgradeModel: event.target.value,
                                },
                              }
                            : current,
                        )
                      }
                      placeholder={t(msg`例如 gpt-4o-mini`)}
                      className={INPUT_CLASS_NAME}
                    />
                  </FilterField>
                  <FilterField label={t(msg`预警阈值`)}>
                    <select
                      value={String(budgetDraft?.overall.warningRatio ?? 0.8)}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  warningRatio:
                                    Number(event.target.value) || 0.8,
                                },
                              }
                            : current,
                        )
                      }
                      className={INPUT_CLASS_NAME}
                    >
                      <option value="0.7">70%</option>
                      <option value="0.8">80%</option>
                      <option value="0.9">90%</option>
                    </select>
                  </FilterField>
                  <FilterField label={t(msg`日预算上限`)}>
                    <input
                      type="number"
                      min="0"
                      step={
                        budgetDraft?.overall.metric === "cost" ? "0.01" : "1000"
                      }
                      value={budgetDraft?.overall.dailyLimit ?? ""}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  dailyLimit: event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                },
                              }
                            : current,
                        )
                      }
                      placeholder={
                        budgetDraft?.overall.metric === "cost"
                          ? t(msg`例如 30`)
                          : t(msg`例如 500000`)
                      }
                      className={INPUT_CLASS_NAME}
                    />
                  </FilterField>
                  <FilterField label={t(msg`月预算上限`)}>
                    <input
                      type="number"
                      min="0"
                      step={
                        budgetDraft?.overall.metric === "cost" ? "0.01" : "1000"
                      }
                      value={budgetDraft?.overall.monthlyLimit ?? ""}
                      onChange={(event) =>
                        setBudgetDraft((current) =>
                          current
                            ? {
                                ...current,
                                overall: {
                                  ...current.overall,
                                  monthlyLimit: event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                },
                              }
                            : current,
                        )
                      }
                      placeholder={
                        budgetDraft?.overall.metric === "cost"
                          ? t(msg`例如 500`)
                          : t(msg`例如 5000000`)
                      }
                      className={INPUT_CLASS_NAME}
                    />
                  </FilterField>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <AdminMetaText>{t(msg`角色预算`)}</AdminMetaText>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {(budgetDraft?.characters ?? []).length} {t(msg`条`)}
                  </span>
                </div>

                {(budgetDraft?.characters ?? []).length ? (
                  (budgetDraft?.characters ?? []).map((item, index) => (
                    <CharacterBudgetEditor
                      key={`${item.characterId || "character"}-${index}`}
                      characters={characters}
                      item={item}
                      index={index}
                      setBudgetDraft={setBudgetDraft}
                    />
                  ))
                ) : (
                  <EmptyState
                    text={t(msg`还没有角色预算配置，点击右上角可以新增。`)}
                  />
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => saveBudgetMutation.mutate()}
                  disabled={saveBudgetMutation.isPending}
                >
                  {saveBudgetMutation.isPending
                    ? t(msg`保存中...`)
                    : t(msg`保存预算配置`)}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {activeWorkspace === "exceptions" ? (
        <>
          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader
              title={t(msg`异常闭环`)}
              actions={
                <span className="text-xs text-[color:var(--text-muted)]">
                  {t(msg`当前视图：`)}
                  {exceptionViewItems.find(
                    (item) => item.key === activeExceptionView,
                  )?.label ?? t(msg`预算阻断`)}
                </span>
              }
            />
            <div className="mt-5">
              <SelectionDeck
                items={exceptionViewItems}
                activeKey={activeExceptionView}
                onChange={(key) =>
                  setActiveExceptionView(key as TokenUsageExceptionView)
                }
              />
            </div>
          </Card>

          {activeExceptionView === "blocked" ? (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.85fr]">
                <Card className="bg-[color:var(--surface-console)]">
                  <AdminSectionHeader
                    title={t(msg`预算阻断日志`)}
                    actions={
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {formatInteger(blockedRequestCount)} {t(msg`次`)}
                      </span>
                    }
                  />

                  {blockedRequestCount ? (
                    <div className="mt-5 space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryTile
                          label={t(msg`阻断请求`)}
                          value={formatInteger(blockedRequestCount)}
                        />
                        <SummaryTile
                          label={t(msg`受影响角色`)}
                          value={formatInteger(
                            blockedOverview?.activeCharacterCount ?? 0,
                          )}
                        />
                        <SummaryTile
                          label={t(msg`失败占比`)}
                          value={formatPercent(blockedFailureShare)}
                        />
                        <SummaryTile
                          label={t(msg`最近一次`)}
                          value={
                            blockedLastRecord
                              ? formatDateTime(blockedLastRecord.occurredAt)
                              : "--"
                          }
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <AdminMetaText>{t(msg`阻断趋势`)}</AdminMetaText>
                          <span className="text-xs text-[color:var(--text-muted)]">
                            {grain === "month"
                              ? t(msg`按月聚合`)
                              : grain === "week"
                                ? t(msg`按周聚合`)
                                : t(msg`按天聚合`)}
                          </span>
                        </div>

                        {blockedTrend.length ? (
                          <div className="space-y-3">
                            {blockedTrend.map((point) => (
                              <div
                                key={point.bucketStart}
                                className="space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--text-secondary)]">
                                  <span>{point.label}</span>
                                  <span>
                                    {formatInteger(point.requestCount)}{" "}
                                    {t(msg`次阻断`)}
                                  </span>
                                </div>
                                <div className="h-3 rounded-full bg-[color:var(--surface-primary)]">
                                  <div
                                    className="h-3 rounded-full bg-[linear-gradient(90deg,rgba(244,63,94,0.92),rgba(249,115,22,0.92))]"
                                    style={{
                                      width: `${Math.max(8, (point.requestCount / maxBlockedRequestCount) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            text={t(msg`当前时间范围内没有预算阻断趋势数据。`)}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <EmptyState
                        text={t(msg`当前时间范围内没有预算阻断记录。`)}
                      />
                    </div>
                  )}
                </Card>

                <div className="grid gap-6">
                  <RequestBreakdownCard
                    title={t(msg`阻断角色`)}
                    items={blockedBreakdown?.byCharacter ?? []}
                    emptyText={t(msg`当前还没有角色维度的阻断记录。`)}
                  />
                  <RequestBreakdownCard
                    title={t(msg`阻断场景`)}
                    items={blockedBreakdown?.byScene ?? []}
                    emptyText={t(msg`当前还没有场景维度的阻断记录。`)}
                    labelFormatter={(item) => formatScene(item.key)}
                  />
                </div>
              </div>

              <Card className="bg-[color:var(--surface-console)]">
                <AdminSectionHeader title={t(msg`最近预算阻断`)} />
                {blockedRecords?.items.length ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                        <tr>
                          <th className="pb-3 pr-4 font-medium">
                            {t(msg`时间`)}
                          </th>
                          <th className="pb-3 pr-4 font-medium">
                            {t(msg`对象`)}
                          </th>
                          <th className="pb-3 pr-4 font-medium">
                            {t(msg`场景`)}
                          </th>
                          <th className="pb-3 font-medium">{t(msg`原因`)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--border-faint)] text-[color:var(--text-secondary)]">
                        {blockedRecords.items.map((record) => (
                          <tr key={`blocked-${record.id}`}>
                            <td className="py-3 pr-4">
                              {formatDateTime(record.occurredAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-[color:var(--text-primary)]">
                                {record.targetLabel}
                              </div>
                              <div className="text-xs text-[color:var(--text-muted)]">
                                {record.characterName || record.scopeType}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {formatScene(record.scene)}
                            </td>
                            <td className="py-3">
                              <div className="font-medium text-[color:var(--text-primary)]">
                                {formatErrorCode(record.errorCode)}
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                                {record.errorMessage || t(msg`预算已阻断`)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyState text={t(msg`当前还没有最近预算阻断记录。`)} />
                  </div>
                )}
              </Card>
            </>
          ) : null}

          {activeExceptionView === "downgraded" ? (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.85fr]">
                <Card className="bg-[color:var(--surface-console)]">
                  <AdminSectionHeader
                    title={t(msg`预算降级日志`)}
                    actions={
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {formatInteger(downgradedRequestCount)} {t(msg`次`)}
                      </span>
                    }
                  />

                  {downgradedRequestCount ? (
                    <div className="mt-5 space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryTile
                          label={t(msg`降级请求`)}
                          value={formatInteger(downgradedRequestCount)}
                        />
                        <SummaryTile
                          label={t(msg`受影响角色`)}
                          value={formatInteger(
                            downgradedOverview?.activeCharacterCount ?? 0,
                          )}
                        />
                        <SummaryTile
                          label={t(msg`成功占比`)}
                          value={formatPercent(downgradedSuccessShare)}
                        />
                        <SummaryTile
                          label={t(msg`最近一次`)}
                          value={
                            downgradedLastRecord
                              ? formatDateTime(downgradedLastRecord.occurredAt)
                              : "--"
                          }
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <AdminMetaText>{t(msg`降级趋势`)}</AdminMetaText>
                          <span className="text-xs text-[color:var(--text-muted)]">
                            {grain === "month"
                              ? t(msg`按月聚合`)
                              : grain === "week"
                                ? t(msg`按周聚合`)
                                : t(msg`按天聚合`)}
                          </span>
                        </div>

                        {downgradedTrend.length ? (
                          <div className="space-y-3">
                            {downgradedTrend.map((point) => (
                              <div
                                key={point.bucketStart}
                                className="space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--text-secondary)]">
                                  <span>{point.label}</span>
                                  <span>
                                    {formatInteger(point.requestCount)}{" "}
                                    {t(msg`次降级`)}
                                  </span>
                                </div>
                                <div className="h-3 rounded-full bg-[color:var(--surface-primary)]">
                                  <div
                                    className="h-3 rounded-full bg-[linear-gradient(90deg,rgba(14,165,233,0.92),rgba(59,130,246,0.92))]"
                                    style={{
                                      width: `${Math.max(8, (point.requestCount / maxDowngradedRequestCount) * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            text={t(msg`当前时间范围内没有预算降级趋势数据。`)}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <EmptyState
                        text={t(msg`当前时间范围内没有预算降级记录。`)}
                      />
                    </div>
                  )}
                </Card>

                <div className="grid gap-6">
                  <RequestBreakdownCard
                    title={t(msg`降级角色`)}
                    items={downgradedBreakdown?.byCharacter ?? []}
                    emptyText={t(msg`当前还没有角色维度的降级记录。`)}
                  />
                  <RequestBreakdownCard
                    title={t(msg`降级场景`)}
                    items={downgradedBreakdown?.byScene ?? []}
                    emptyText={t(msg`当前还没有场景维度的降级记录。`)}
                    labelFormatter={(item) => formatScene(item.key)}
                  />
                </div>
              </div>

              <Card className="bg-[color:var(--surface-console)]">
                <AdminSectionHeader title={t(msg`最近预算降级`)} />
                {downgradedRecords?.items.length ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                        <tr>
                          <th className="pb-3 pr-4 font-medium">
                            {t(msg`时间`)}
                          </th>
                          <th className="pb-3 pr-4 font-medium">
                            {t(msg`对象`)}
                          </th>
                          <th className="pb-3 pr-4 font-medium">
                            {t(msg`场景`)}
                          </th>
                          <th className="pb-3 font-medium">{t(msg`原因`)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--border-faint)] text-[color:var(--text-secondary)]">
                        {downgradedRecords.items.map((record) => (
                          <tr key={`downgraded-${record.id}`}>
                            <td className="py-3 pr-4">
                              {formatDateTime(record.occurredAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-[color:var(--text-primary)]">
                                {record.targetLabel}
                              </div>
                              <div className="text-xs text-[color:var(--text-muted)]">
                                {record.characterName || record.scopeType}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {formatScene(record.scene)}
                            </td>
                            <td className="py-3">
                              <div className="font-medium text-[color:var(--text-primary)]">
                                {formatErrorCode(record.errorCode)}
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                                {record.errorMessage || t(msg`预算已降级`)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyState text={t(msg`当前还没有最近预算降级记录。`)} />
                  </div>
                )}
              </Card>
            </>
          ) : null}

          {activeExceptionView === "quality" ? (
            <>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
                <Card className="bg-[color:var(--surface-console)]">
                  <AdminSectionHeader
                    title={t(msg`降级效果`)}
                    actions={
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {t(msg`已追踪`)}{" "}
                        {formatInteger(
                          downgradeInsights?.traceableRequestCount ?? 0,
                        )}{" "}
                        / {formatInteger(downgradeInsights?.requestCount ?? 0)}
                      </span>
                    }
                  />

                  <div className="mt-5 space-y-5">
                    {downgradeInsights?.untraceableRequestCount ? (
                      <InlineNotice tone="warning">
                        {t(msg`当前仍有`)}{" "}
                        {formatInteger(
                          downgradeInsights.untraceableRequestCount,
                        )}{" "}
                        {t(
                          msg`次降级记录缺少原模型快照，节省金额会按已追踪到的模型切换保守估算。`,
                        )}
                      </InlineNotice>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <SummaryTile
                        label={t(msg`估算节省`)}
                        value={formatCost(
                          downgradeInsights?.estimatedSavings ?? 0,
                          downgradeInsights?.currency ?? currency,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`节省率`)}
                        value={formatPercent(
                          downgradeInsights?.savingsRate ?? 0,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`降级成功率`)}
                        value={formatPercent(
                          downgradeInsights?.successRate ?? 0,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`模型切换覆盖`)}
                        value={formatPercent(downgradeTraceability)}
                      />
                    </div>

                    {downgradeSwitches.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                            <tr>
                              <th className="pb-3 pr-4 font-medium">
                                {t(msg`原模型`)}
                              </th>
                              <th className="pb-3 pr-4 font-medium">
                                {t(msg`降级后模型`)}
                              </th>
                              <th className="pb-3 pr-4 font-medium">
                                {t(msg`请求数`)}
                              </th>
                              <th className="pb-3 pr-4 font-medium">
                                {t(msg`实际成本`)}
                              </th>
                              <th className="pb-3 font-medium">
                                {t(msg`节省`)}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[color:var(--border-faint)] text-[color:var(--text-secondary)]">
                            {downgradeSwitches.map((item) => (
                              <tr key={`switch-table-${item.key}`}>
                                <td className="py-3 pr-4">
                                  <div className="font-medium text-[color:var(--text-primary)]">
                                    {item.requestedModel ||
                                      t(msg`未记录原模型`)}
                                  </div>
                                </td>
                                <td className="py-3 pr-4">
                                  <div className="font-medium text-[color:var(--text-primary)]">
                                    {item.appliedModel ||
                                      t(msg`未记录降级模型`)}
                                  </div>
                                </td>
                                <td className="py-3 pr-4">
                                  {formatInteger(item.requestCount)}
                                </td>
                                <td className="py-3 pr-4">
                                  {formatCost(
                                    item.estimatedCost,
                                    downgradeInsights?.currency ?? currency,
                                  )}
                                </td>
                                <td className="py-3">
                                  <div className="font-medium text-[color:var(--text-primary)]">
                                    {formatCost(
                                      item.estimatedSavings,
                                      downgradeInsights?.currency ?? currency,
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                                    {t(msg`原本`)}{" "}
                                    {formatCost(
                                      item.estimatedOriginalCost,
                                      downgradeInsights?.currency ?? currency,
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        text={t(msg`当前时间范围内还没有模型切换洞察数据。`)}
                      />
                    )}
                  </div>
                </Card>

                <DowngradeSwitchCard
                  title={t(msg`主要模型切换`)}
                  items={downgradeSwitches}
                  currency={downgradeInsights?.currency ?? currency}
                  emptyText={t(msg`当前还没有可比较的模型切换。`)}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                <Card className="bg-[color:var(--surface-console)]">
                  <AdminSectionHeader
                    title={t(msg`降级质量闭环`)}
                    actions={
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {t(msg`可追踪会话`)}{" "}
                        {formatPercent(downgradeScopedCoverage)}
                      </span>
                    }
                  />

                  <div className="mt-5 space-y-5">
                    {(downgradeQuality?.unscopedRequestCount ?? 0) > 0 ? (
                      <InlineNotice tone="warning">
                        {t(msg`当前有`)}{" "}
                        {formatInteger(
                          downgradeQuality?.unscopedRequestCount ?? 0,
                        )}{" "}
                        {t(
                          msg`次降级请求不在会话范围内，因此质量追踪只覆盖可还原的聊天线程。`,
                        )}
                      </InlineNotice>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <SummaryTile
                        label={t(msg`已复盘`)}
                        value={formatInteger(
                          downgradeQuality?.reviewedConversationCount ?? 0,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`可接受`)}
                        value={formatInteger(
                          downgradeQuality?.acceptableConversationCount ?? 0,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`质量偏弱`)}
                        value={formatInteger(
                          downgradeQuality?.tooWeakConversationCount ?? 0,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`复盘覆盖率`)}
                        value={formatPercentNullable(
                          downgradeQuality?.reviewCoverageRate ?? null,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`可接受占比`)}
                        value={formatPercentNullable(
                          downgradeQuality?.acceptableReviewRate ?? null,
                        )}
                      />
                      <SummaryTile
                        label={t(msg`偏弱占比`)}
                        value={formatPercentNullable(
                          downgradeQuality?.tooWeakReviewRate ?? null,
                        )}
                      />
                    </div>

                    <div className="space-y-3">
                      <SignalProgressRow
                        label={t(msg`复盘覆盖率`)}
                        value={formatPercentNullable(
                          downgradeQuality?.reviewCoverageRate ?? null,
                        )}
                        ratio={downgradeQuality?.reviewCoverageRate ?? 0}
                        gradient="bg-[linear-gradient(90deg,rgba(59,130,246,0.92),rgba(14,165,233,0.92))]"
                      />
                      <SignalProgressRow
                        label={t(msg`复盘后可接受`)}
                        value={formatPercentNullable(
                          downgradeQuality?.acceptableReviewRate ?? null,
                        )}
                        ratio={downgradeQuality?.acceptableReviewRate ?? 0}
                        gradient="bg-[linear-gradient(90deg,rgba(34,197,94,0.92),rgba(16,185,129,0.92))]"
                      />
                      <SignalProgressRow
                        label={t(msg`复盘后偏弱`)}
                        value={formatPercentNullable(
                          downgradeQuality?.tooWeakReviewRate ?? null,
                        )}
                        ratio={downgradeQuality?.tooWeakReviewRate ?? 0}
                        gradient="bg-[linear-gradient(90deg,rgba(244,63,94,0.92),rgba(249,115,22,0.92))]"
                      />
                    </div>

                    <div className="grid gap-4">
                      <ReviewSampleList
                        title={t(msg`质量偏弱样本`)}
                        description={t(
                          msg`这些降级会话已经在复盘中被明确标记为质量偏弱。`,
                        )}
                        samples={tooWeakSamples}
                        emptyText={t(
                          msg`当前时间范围内没有质量偏弱的降级样本。`,
                        )}
                      />
                      <ReviewSampleList
                        title={t(msg`等待补结果`)}
                        description={t(
                          msg`这些会话已经被复盘，但还没有落下可接受或偏弱结论。`,
                        )}
                        samples={pendingOutcomeSamples}
                        emptyText={t(msg`当前没有等待补结论的降级样本。`)}
                      />
                    </div>
                  </div>
                </Card>

                <DowngradeCharacterQualityCard
                  items={qualityByCharacter}
                  currency={currency}
                  emptyText={t(msg`当前时间范围内没有角色级降级复盘样本。`)}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {activeWorkspace === "pricing" ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader
              title={t(msg`模型价格`)}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => syncN1nMutation.mutate()}
                    disabled={syncN1nMutation.isPending}
                  >
                    {syncN1nMutation.isPending
                      ? t(msg`同步中...`)
                      : t(msg`从 n1n.ai 同步并回填`)}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setPricingDraft((current) => ({
                        currency: current?.currency ?? "CNY",
                        items: [...(current?.items ?? []), emptyPricingItem()],
                      }))
                    }
                  >
                    {t(msg`新增模型`)}
                  </Button>
                </div>
              }
            />
            {syncN1nMutation.isSuccess && syncN1nMutation.data ? (
              <InlineNotice tone="success" className="mt-3">
                {t(msg`已同步`)} {syncN1nMutation.data.catalogItems}{" "}
                {t(msg`个模型单价，并回填`)}{" "}
                {syncN1nMutation.data.recomputedRows} {t(msg`条历史账本费用。`)}
              </InlineNotice>
            ) : null}
            {syncN1nMutation.isError &&
            syncN1nMutation.error instanceof Error ? (
              <ErrorBlock
                message={syncN1nMutation.error.message}
                className="mt-3"
              />
            ) : null}

            <div className="mt-5 space-y-3">
              <FilterField label={t(msg`结算币种`)}>
                <select
                  value={pricingDraft?.currency ?? "CNY"}
                  onChange={(event) =>
                    setPricingDraft((current) => ({
                      currency: event.target.value === "USD" ? "USD" : "CNY",
                      items: current?.items ?? [],
                    }))
                  }
                  className={INPUT_CLASS_NAME}
                >
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                </select>
              </FilterField>

              {(pricingDraft?.items ?? []).length ? (
                (pricingDraft?.items ?? []).map((item, index) => (
                  <div
                    key={`${item.model}-${index}`}
                    className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-3"
                  >
                    <div className="grid gap-3">
                      <input
                        value={item.model}
                        onChange={(event) =>
                          updatePricingItem(setPricingDraft, index, {
                            model: event.target.value,
                          })
                        }
                        placeholder={t(msg`模型名，例如 deepseek-chat`)}
                        className={INPUT_CLASS_NAME}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.inputPer1kTokens}
                          onChange={(event) =>
                            updatePricingItem(setPricingDraft, index, {
                              inputPer1kTokens: Number(event.target.value) || 0,
                            })
                          }
                          placeholder={t(msg`输入单价 / 1K token`)}
                          className={INPUT_CLASS_NAME}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.outputPer1kTokens}
                          onChange={(event) =>
                            updatePricingItem(setPricingDraft, index, {
                              outputPer1kTokens:
                                Number(event.target.value) || 0,
                            })
                          }
                          placeholder={t(msg`输出单价 / 1K token`)}
                          className={INPUT_CLASS_NAME}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={item.enabled !== false}
                            onChange={(event) =>
                              updatePricingItem(setPricingDraft, index, {
                                enabled: event.target.checked,
                              })
                            }
                          />
                          {t(msg`启用该模型`)}
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPricingDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    items: current.items.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  }
                                : current,
                            )
                          }
                        >
                          {t(msg`删除`)}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text={t(msg`还没有配置任何模型价格。`)} />
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="primary"
                onClick={() => savePricingMutation.mutate()}
                disabled={savePricingMutation.isPending}
              >
                {savePricingMutation.isPending
                  ? t(msg`保存中...`)
                  : t(msg`保存价格配置`)}
              </Button>
            </div>
          </Card>

          <div className="grid gap-6">
            <Card className="bg-[color:var(--surface-console)]">
              <AdminSectionHeader title={t(msg`价格配置健康度`)} />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label={t(msg`已启用模型`)}
                  value={formatInteger(enabledPricingCount)}
                />
                <SummaryTile
                  label={t(msg`已计价模型`)}
                  value={formatInteger(configuredPricingCount)}
                />
                <SummaryTile
                  label={t(msg`本期估算费用`)}
                  value={formatCost(overview?.estimatedCost ?? 0, currency)}
                />
                <SummaryTile
                  label={t(msg`结算币种`)}
                  value={pricingDraft?.currency ?? currency}
                />
              </div>

              <div className="mt-5 space-y-3">
                {!hasConfiguredPricing ? (
                  <InlineNotice tone="warning">
                    {t(
                      msg`当前还没有配置有效模型单价，页面里的估算费用会先按 0 计算。补齐后，新入账请求会开始写入价格快照。`,
                    )}
                  </InlineNotice>
                ) : null}

                <FocusSignalCard
                  title={t(msg`运营建议`)}
                  value={
                    hasConfiguredPricing
                      ? t(msg`价格口径已建立`)
                      : t(msg`优先补价格`)
                  }
                  detail={
                    hasConfiguredPricing
                      ? t(
                          msg`后续如果模型价格发生变化，只会影响新入账请求，不会回改历史快照。`,
                        )
                      : t(
                          msg`建议先把高频模型补齐，避免运营判断成本时出现 0 金额误判。`,
                        )
                  }
                  tone={hasConfiguredPricing ? "info" : "warning"}
                />
              </div>
            </Card>

            <BreakdownCard
              title={t(msg`计费来源分布`)}
              items={breakdown?.byBillingSource ?? []}
              currency={currency}
              emptyText={t(msg`当前还没有按计费来源归档的账本。`)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SelectionDeckItem = {
  key: string;
  label: string;
  detail: string;
  badge: string;
  tone?: "default" | "warning" | "success" | "info";
};

function SelectionDeck({
  items,
  activeKey,
  onChange,
}: {
  items: readonly SelectionDeckItem[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => {
        const active = item.key === activeKey;
        const toneClassName =
          item.tone === "warning"
            ? "border-amber-200 bg-[linear-gradient(160deg,rgba(255,251,235,0.98),rgba(255,243,219,0.9))]"
            : item.tone === "success"
              ? "border-emerald-200 bg-[linear-gradient(160deg,rgba(236,253,245,0.98),rgba(220,252,231,0.9))]"
              : item.tone === "info"
                ? "border-sky-200 bg-[linear-gradient(160deg,rgba(239,246,255,0.98),rgba(224,242,254,0.9))]"
                : "border-[color:var(--border-faint)] bg-[color:var(--surface-card)]";

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`rounded-[20px] border px-4 py-4 text-left transition hover:border-[color:var(--border-subtle)] ${
              active
                ? "border-[color:var(--border-brand)] bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(255,247,235,0.9))] shadow-[var(--shadow-soft)]"
                : toneClassName
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-[color:var(--text-primary)]">
                  {item.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                  {item.detail}
                </div>
              </div>
              {active ? (
                <span className="rounded-full border border-[color:var(--border-brand)] bg-white px-2 py-1 text-[12px] font-medium text-[color:var(--brand-primary)]">
                  {t(msg`当前`)}
                </span>
              ) : null}
            </div>
            <div className="mt-3 text-sm font-medium text-[color:var(--text-primary)]">
              {item.badge}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActiveFilterPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)]">
      <span className="font-medium text-[color:var(--text-primary)]">
        {label}
      </span>
      <span>{value}</span>
    </span>
  );
}

function FocusSignalCard({
  title,
  value,
  detail,
  tone = "default",
}: {
  title: string;
  value: string;
  detail: string;
  tone?: "default" | "warning" | "info";
}) {
  const className =
    tone === "warning"
      ? "border-amber-200 bg-[linear-gradient(160deg,rgba(255,251,235,0.98),rgba(255,243,219,0.92))]"
      : tone === "info"
        ? "border-sky-200 bg-[linear-gradient(160deg,rgba(239,246,255,0.98),rgba(224,242,254,0.9))]"
        : "border-[color:var(--border-faint)] bg-[color:var(--surface-card)]";

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${className}`}>
      <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {title}
      </div>
      <div className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
        {detail}
      </div>
    </div>
  );
}

function QuickRangeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const t = translateRuntimeMessage;
  return (
    <Button
      variant={active ? "primary" : "secondary"}
      size="sm"
      onClick={onClick}
      className={active ? "ring-2 ring-[color:var(--border-brand)]/40" : ""}
    >
      <span>{label}</span>
      {active ? (
        <span className="rounded-full border border-white/30 bg-white/15 px-1.5 py-0.5 text-[12px] font-semibold tracking-[0.08em]">
          {t(msg`当前`)}
        </span>
      ) : null}
    </Button>
  );
}

function formatBillingSource(value?: TokenUsageBillingSource | null | "") {
  if (value === "owner_custom") {
    return translateRuntimeMessage(msg`世界主人 Key`);
  }
  if (value === "instance_default") {
    return translateRuntimeMessage(msg`实例默认 Key`);
  }
  return translateRuntimeMessage(msg`全部来源`);
}

function compareBudgetStatus(
  left: TokenUsageBudgetStatus,
  right: TokenUsageBudgetStatus,
) {
  const stateDiff =
    getBudgetStateRank(resolveBudgetState(right)) -
    getBudgetStateRank(resolveBudgetState(left));
  if (stateDiff !== 0) {
    return stateDiff;
  }
  return getBudgetStatusMaxRatio(right) - getBudgetStatusMaxRatio(left);
}

function getBudgetStateRank(state: TokenUsageBudgetState) {
  if (state === "exceeded") {
    return 3;
  }
  if (state === "warning") {
    return 2;
  }
  if (state === "normal") {
    return 1;
  }
  return 0;
}

function getBudgetStatusMaxRatio(status: TokenUsageBudgetStatus) {
  return Math.max(status.daily.ratio ?? 0, status.monthly.ratio ?? 0);
}

function formatBudgetRatioSummary(status: TokenUsageBudgetStatus) {
  const ratio = getBudgetStatusMaxRatio(status);
  if (!ratio) {
    return translateRuntimeMessage(msg`未接近阈值`);
  }
  return formatPercent(ratio);
}

function BudgetStatusPanel({
  title,
  description,
  status,
  currency,
}: {
  title: string;
  description: string;
  status: TokenUsageBudgetStatus;
  currency: "CNY" | "USD";
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="rounded-[20px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[color:var(--text-primary)]">
            {title}
          </div>
          <div className="text-xs text-[color:var(--text-muted)]">
            {description}
          </div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            {t(msg`当前模式：`)}
            {formatBudgetEnforcement(status.enforcement)}
          </div>
          {status.enforcement === "downgrade" ? (
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
              {t(msg`降级模型：`)}
              {status.downgradeModel?.trim() || t(msg`未配置，超限后将阻断`)}
            </div>
          ) : null}
        </div>
        <BudgetStateBadge state={resolveBudgetState(status)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <BudgetPeriodCard
          label={t(msg`今日`)}
          summary={status.daily}
          metric={status.metric}
          currency={currency}
        />
        <BudgetPeriodCard
          label={t(msg`本月`)}
          summary={status.monthly}
          metric={status.metric}
          currency={currency}
        />
      </div>
    </div>
  );
}

function CharacterBudgetPanel({
  item,
  currency,
}: {
  item: TokenUsageCharacterBudgetStatus;
  currency: "CNY" | "USD";
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[color:var(--text-primary)]">
            {item.characterName}
          </div>
          {item.note ? (
            <div className="text-xs text-[color:var(--text-muted)]">
              {item.note}
            </div>
          ) : null}
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            {t(msg`当前模式：`)}
            {formatBudgetEnforcement(item.budget.enforcement)}
          </div>
          {item.budget.enforcement === "downgrade" ? (
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
              {t(msg`降级模型：`)}
              {item.budget.downgradeModel?.trim() ||
                t(msg`未配置，超限后将阻断`)}
            </div>
          ) : null}
        </div>
        <BudgetStateBadge state={resolveBudgetState(item.budget)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <BudgetPeriodCard
          label={t(msg`今日`)}
          summary={item.budget.daily}
          metric={item.budget.metric}
          currency={currency}
          compact
        />
        <BudgetPeriodCard
          label={t(msg`本月`)}
          summary={item.budget.monthly}
          metric={item.budget.metric}
          currency={currency}
          compact
        />
      </div>
    </div>
  );
}

function BudgetPeriodCard({
  label,
  summary,
  metric,
  currency,
  compact = false,
}: {
  label: string;
  summary: TokenUsageBudgetPeriodSummary;
  metric: TokenUsageBudgetMetric;
  currency: "CNY" | "USD";
  compact?: boolean;
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-primary)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[color:var(--text-primary)]">
          {label}
        </div>
        <BudgetStateBadge state={summary.state} compact />
      </div>
      <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}>
        <div className="text-xs text-[color:var(--text-muted)]">
          {t(msg`已使用`)} {formatBudgetValue(summary.used, metric, currency)}
        </div>
        <div className="text-xs text-[color:var(--text-muted)]">
          {t(msg`预算上限`)}{" "}
          {formatBudgetValue(summary.limit, metric, currency)}
        </div>
        <div className="text-xs text-[color:var(--text-muted)]">
          {t(msg`剩余额度`)}{" "}
          {formatBudgetValue(summary.remaining, metric, currency)}
        </div>
        <div className="text-xs text-[color:var(--text-muted)]">
          {t(msg`预算占比`)} {formatRatio(summary.ratio)}
        </div>
      </div>
    </div>
  );
}

function CharacterBudgetEditor({
  characters,
  item,
  index,
  setBudgetDraft,
}: {
  characters: Character[];
  item: TokenUsageCharacterBudgetRule;
  index: number;
  setBudgetDraft: Dispatch<SetStateAction<TokenUsageBudgetConfig | null>>;
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-medium text-[color:var(--text-primary)]">
            {t(msg`角色预算`)} #{index + 1}
          </div>
          <div className="text-xs text-[color:var(--text-muted)]">
            {t(msg`可按 token 或费用给单个角色设置今天、本月预算上限。`)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setBudgetDraft((current) =>
              current
                ? {
                    ...current,
                    characters: current.characters.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  }
                : current,
            )
          }
        >
          {t(msg`删除`)}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FilterField label={t(msg`角色`)}>
          <select
            value={item.characterId}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                characterId: event.target.value,
              })
            }
            className={INPUT_CLASS_NAME}
          >
            <option value="">{t(msg`选择角色`)}</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label={t(msg`预警阈值`)}>
          <select
            value={String(item.warningRatio ?? 0.8)}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                warningRatio: Number(event.target.value) || 0.8,
              })
            }
            className={INPUT_CLASS_NAME}
          >
            <option value="0.7">70%</option>
            <option value="0.8">80%</option>
            <option value="0.9">90%</option>
          </select>
        </FilterField>
        <FilterField label={t(msg`执行方式`)}>
          <select
            value={item.enforcement ?? "monitor"}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                enforcement:
                  event.target.value === "block"
                    ? "block"
                    : event.target.value === "downgrade"
                      ? "downgrade"
                      : "monitor",
              })
            }
            className={INPUT_CLASS_NAME}
          >
            <option value="monitor">{t(msg`监控预警`)}</option>
            <option value="downgrade">{t(msg`超限降级`)}</option>
            <option value="block">{t(msg`超限阻断`)}</option>
          </select>
        </FilterField>
        <FilterField label={t(msg`降级模型`)}>
          <input
            value={item.downgradeModel ?? ""}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                downgradeModel: event.target.value,
              })
            }
            placeholder={t(msg`例如 gpt-4o-mini`)}
            className={INPUT_CLASS_NAME}
          />
        </FilterField>
        <FilterField label={t(msg`预算维度`)}>
          <select
            value={item.metric}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                metric: event.target.value === "cost" ? "cost" : "tokens",
              })
            }
            className={INPUT_CLASS_NAME}
          >
            <option value="tokens">{t(msg`按 Token`)}</option>
            <option value="cost">{t(msg`按费用`)}</option>
          </select>
        </FilterField>
        <FilterField label={t(msg`备注`)}>
          <input
            value={item.note ?? ""}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                note: event.target.value,
              })
            }
            placeholder={t(msg`例如高频聊天角色`)}
            className={INPUT_CLASS_NAME}
          />
        </FilterField>
        <FilterField label={t(msg`日预算上限`)}>
          <input
            type="number"
            min="0"
            step={item.metric === "cost" ? "0.01" : "1000"}
            value={item.dailyLimit ?? ""}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                dailyLimit: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            placeholder={
              item.metric === "cost" ? t(msg`例如 10`) : t(msg`例如 100000`)
            }
            className={INPUT_CLASS_NAME}
          />
        </FilterField>
        <FilterField label={t(msg`月预算上限`)}>
          <input
            type="number"
            min="0"
            step={item.metric === "cost" ? "0.01" : "1000"}
            value={item.monthlyLimit ?? ""}
            onChange={(event) =>
              updateBudgetCharacter(setBudgetDraft, index, {
                monthlyLimit: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            placeholder={
              item.metric === "cost" ? t(msg`例如 200`) : t(msg`例如 1000000`)
            }
            className={INPUT_CLASS_NAME}
          />
        </FilterField>
      </div>

      <label className="mt-4 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
        <input
          type="checkbox"
          checked={item.enabled !== false}
          onChange={(event) =>
            updateBudgetCharacter(setBudgetDraft, index, {
              enabled: event.target.checked,
            })
          }
        />
        {t(msg`启用该角色预算`)}
      </label>
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  currency,
  emptyText,
  labelFormatter,
}: {
  title: string;
  items: TokenUsageBreakdownItem[];
  currency: "CNY" | "USD";
  emptyText: string;
  labelFormatter?: (item: TokenUsageBreakdownItem) => string;
}) {
  const t = translateRuntimeMessage;
  const maxTokens = Math.max(...items.map((item) => item.totalTokens), 1);

  return (
    <Card className="bg-[color:var(--surface-console)]">
      <AdminSectionHeader title={title} />
      {items.length ? (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={`${title}-${item.key}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {labelFormatter?.(item) ?? item.label}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)]">
                    {formatInteger(item.requestCount)} {t(msg`次请求`)} /{" "}
                    {formatCost(item.estimatedCost, currency)}
                  </div>
                </div>
                <div className="text-sm font-medium text-[color:var(--text-primary)]">
                  {formatInteger(item.totalTokens)}
                </div>
              </div>
              <div className="h-2 rounded-full bg-[color:var(--surface-primary)]">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(249,115,22,0.92),rgba(251,191,36,0.92))]"
                  style={{
                    width: `${Math.max(8, (item.totalTokens / maxTokens) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </Card>
  );
}

function RequestBreakdownCard({
  title,
  items,
  emptyText,
  labelFormatter,
}: {
  title: string;
  items: TokenUsageBreakdownItem[];
  emptyText: string;
  labelFormatter?: (item: TokenUsageBreakdownItem) => string;
}) {
  const t = translateRuntimeMessage;
  const maxRequests = Math.max(...items.map((item) => item.requestCount), 1);

  return (
    <Card className="bg-[color:var(--surface-console)]">
      <AdminSectionHeader title={title} />
      {items.length ? (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={`${title}-${item.key}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {labelFormatter?.(item) ?? item.label}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)]">
                    {formatInteger(item.requestCount)} {t(msg`次请求`)}
                  </div>
                </div>
                <div className="text-sm font-medium text-[color:var(--text-primary)]">
                  {formatInteger(item.requestCount)}
                </div>
              </div>
              <div className="h-2 rounded-full bg-[color:var(--surface-primary)]">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(244,63,94,0.92),rgba(249,115,22,0.92))]"
                  style={{
                    width: `${Math.max(8, (item.requestCount / maxRequests) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </Card>
  );
}

function DowngradeSwitchCard({
  title,
  items,
  currency,
  emptyText,
}: {
  title: string;
  items: TokenUsageDowngradeModelSwitchItem[];
  currency: "CNY" | "USD";
  emptyText: string;
}) {
  const t = translateRuntimeMessage;
  const maxSavings = Math.max(...items.map((item) => item.estimatedSavings), 1);

  return (
    <Card className="bg-[color:var(--surface-console)]">
      <AdminSectionHeader title={title} />
      {items.length ? (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={`${title}-${item.key}`} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {(item.requestedModel || t(msg`未记录原模型`)) +
                      " -> " +
                      (item.appliedModel || t(msg`未记录降级模型`))}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)]">
                    {formatInteger(item.requestCount)} {t(msg`次请求`)} /{" "}
                    {t(msg`实际`)} {formatCost(item.estimatedCost, currency)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-[color:var(--text-primary)]">
                    {formatCost(item.estimatedSavings, currency)}
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)]">
                    {t(msg`原本`)}{" "}
                    {formatCost(item.estimatedOriginalCost, currency)}
                  </div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[color:var(--surface-primary)]">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(14,165,233,0.92),rgba(34,197,94,0.92))]"
                  style={{
                    width: `${Math.max(8, (item.estimatedSavings / maxSavings) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </Card>
  );
}

function ReviewSampleList({
  title,
  description,
  samples,
  emptyText,
}: {
  title: string;
  description: string;
  samples: TokenUsageDowngradeReviewSample[];
  emptyText: string;
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            {title}
          </div>
          <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
            {description}
          </div>
        </div>
        <div className="text-sm font-medium text-[color:var(--text-primary)]">
          {formatInteger(samples.length)}
        </div>
      </div>

      {samples.length ? (
        <div className="mt-4 space-y-3">
          {samples.map((sample) => (
            <a
              key={`${title}-${sample.conversationId}`}
              href={buildChatRecordsReviewHref(
                sample.conversationId,
                sample.characterId,
              )}
              className="block rounded-[16px] border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-3 transition hover:border-[color:var(--border-subtle)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {sample.targetLabel}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {sample.characterName || t(msg`未记录角色`)} /{" "}
                    {formatScene(sample.scene)}
                  </div>
                </div>
                <div className="text-right text-xs text-[color:var(--text-muted)]">
                  <div>{formatDateTime(sample.occurredAt)}</div>
                  <div className="mt-1">
                    {t(msg`复盘于`)} {formatDateTime(sample.reviewUpdatedAt)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[color:var(--text-muted)]">
                {sample.reviewTags.length ? (
                  sample.reviewTags.map((tag) => (
                    <span
                      key={`${sample.conversationId}-${tag}`}
                      className="rounded-full border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-2 py-1"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-2 py-1">
                    {sample.reviewStatus}
                  </span>
                )}
              </div>
              <div className="mt-3 text-xs font-medium text-[color:var(--brand-primary)]">
                {t(msg`打开聊天复盘`)}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState text={emptyText} />
        </div>
      )}
    </div>
  );
}

function DowngradeCharacterQualityCard({
  items,
  currency,
  emptyText,
}: {
  items: TokenUsageDowngradeCharacterQualityItem[];
  currency: "CNY" | "USD";
  emptyText: string;
}) {
  const t = translateRuntimeMessage;
  return (
    <Card className="bg-[color:var(--surface-console)]">
      <AdminSectionHeader title={t(msg`角色样本下钻`)} />
      {items.length ? (
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <div
              key={item.characterId || item.characterName}
              className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[color:var(--text-primary)]">
                      {item.characterName}
                    </div>
                    <PriorityBadge score={item.priorityScore} />
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {formatInteger(item.requestCount)} {t(msg`次降级请求`)} /{" "}
                    {formatInteger(item.reviewedConversationCount)}{" "}
                    {t(msg`条已复盘`)} /{" "}
                    {formatInteger(item.distinctConversationCount)}{" "}
                    {t(msg`个会话`)}
                  </div>
                </div>
                <div className="text-right text-xs text-[color:var(--text-muted)]">
                  <div>
                    {t(msg`质量偏弱`)}{" "}
                    {formatInteger(item.tooWeakConversationCount)}
                  </div>
                  <div className="mt-1">
                    {t(msg`待补结论`)}{" "}
                    {formatInteger(item.pendingOutcomeConversationCount)}
                  </div>
                  <div className="mt-1">
                    {t(msg`成本`)} {formatCost(item.estimatedCost, currency)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <SignalProgressRow
                  label={t(msg`复盘覆盖率`)}
                  value={formatPercentNullable(item.reviewCoverageRate)}
                  ratio={item.reviewCoverageRate ?? 0}
                  gradient="bg-[linear-gradient(90deg,rgba(59,130,246,0.92),rgba(14,165,233,0.92))]"
                />
                <SignalProgressRow
                  label={t(msg`复盘后偏弱`)}
                  value={formatPercentNullable(item.tooWeakReviewRate)}
                  ratio={item.tooWeakReviewRate ?? 0}
                  gradient="bg-[linear-gradient(90deg,rgba(244,63,94,0.92),rgba(249,115,22,0.92))]"
                />
                <SignalProgressRow
                  label={t(msg`24 小时续聊`)}
                  value={formatPercentNullable(item.continuedWithin24hRate)}
                  ratio={item.continuedWithin24hRate ?? 0}
                  gradient="bg-[linear-gradient(90deg,rgba(34,197,94,0.92),rgba(59,130,246,0.92))]"
                />
                <SignalProgressRow
                  label={t(msg`后续失败率`)}
                  value={formatPercentNullable(item.postDowngradeFailureRate)}
                  ratio={item.postDowngradeFailureRate ?? 0}
                  gradient="bg-[linear-gradient(90deg,rgba(244,63,94,0.92),rgba(168,85,247,0.92))]"
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <CompactSampleLinks
                  title={t(msg`质量偏弱`)}
                  samples={item.tooWeakSamples}
                  emptyText={t(msg`这个角色当前没有质量偏弱样本。`)}
                />
                <CompactSampleLinks
                  title={t(msg`等待补结论`)}
                  samples={item.pendingOutcomeSamples}
                  emptyText={t(msg`这个角色当前没有待补结论样本。`)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState text={emptyText} />
        </div>
      )}
    </Card>
  );
}

function CompactSampleLinks({
  title,
  samples,
  emptyText,
}: {
  title: string;
  samples: TokenUsageDowngradeReviewSample[];
  emptyText: string;
}) {
  return (
    <div className="rounded-[16px] border border-[color:var(--border-faint)] bg-[color:var(--surface-soft)] p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {title}
      </div>
      {samples.length ? (
        <div className="mt-3 space-y-2">
          {samples.map((sample) => (
            <a
              key={`${title}-${sample.conversationId}`}
              href={buildChatRecordsReviewHref(
                sample.conversationId,
                sample.characterId,
              )}
              className="block rounded-[14px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-2.5 transition hover:border-[color:var(--border-subtle)]"
            >
              <div className="text-sm font-medium text-[color:var(--text-primary)]">
                {sample.targetLabel}
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                {formatDateTime(sample.occurredAt)} /{" "}
                {formatScene(sample.scene)}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState text={emptyText} />
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ score }: { score: number }) {
  const t = translateRuntimeMessage;
  const className =
    score >= 70
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : score >= 45
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const label =
    score >= 70
      ? t(msg`高优先级`)
      : score >= 45
        ? t(msg`持续关注`)
        : t(msg`稳定`);

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[12px] font-medium ${className}`}
    >
      {label} {score}
    </span>
  );
}

function SignalProgressRow({
  label,
  value,
  ratio,
  gradient,
}: {
  label: string;
  value: string;
  ratio: number;
  gradient: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-[color:var(--text-primary)]">{label}</span>
        <span className="text-[color:var(--text-secondary)]">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-[color:var(--surface-primary)]">
        <div
          className={`h-2 rounded-full ${gradient}`}
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <AdminMetaText>{label}</AdminMetaText>
      {children}
    </label>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-[color:var(--text-muted)]">{text}</div>;
}

function BudgetStateBadge({
  state,
}: {
  state: TokenUsageBudgetState | "warning" | "exceeded";
  compact?: boolean;
}) {
  const normalizedState: TokenUsageBudgetState =
    state === "warning" || state === "exceeded" ? state : state;
  const className =
    normalizedState === "exceeded"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : normalizedState === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalizedState === "normal"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-medium ${className}`}
    >
      {formatBudgetState(normalizedState)}
    </span>
  );
}

function calculateAverageTokens(totalTokens: number, requestCount: number) {
  if (!requestCount) {
    return 0;
  }
  return Math.round(totalTokens / requestCount);
}

function calculateRatio(value: number, total: number) {
  if (!total) {
    return 0;
  }
  return value / total;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPercentNullable(value: number | null | undefined) {
  if (value == null) {
    return "--";
  }
  return formatPercent(value);
}

function formatErrorCode(value?: string | null) {
  if (value === "BUDGET_BLOCKED") {
    return translateRuntimeMessage(msg`预算阻断`);
  }
  if (value === "BUDGET_DOWNGRADED") {
    return translateRuntimeMessage(msg`预算降级`);
  }
  if (!value) {
    return translateRuntimeMessage(msg`未知`);
  }
  return value;
}

function formatBudgetState(state: TokenUsageBudgetState) {
  if (state === "exceeded") {
    return translateRuntimeMessage(msg`超限`);
  }
  if (state === "warning") {
    return translateRuntimeMessage(msg`预警`);
  }
  if (state === "normal") {
    return translateRuntimeMessage(msg`正常`);
  }
  return translateRuntimeMessage(msg`未启用`);
}

function formatBudgetEnforcement(value: TokenUsageBudgetEnforcement) {
  if (value === "block") {
    return translateRuntimeMessage(msg`超限阻断`);
  }
  if (value === "downgrade") {
    return translateRuntimeMessage(msg`超限降级`);
  }
  return translateRuntimeMessage(msg`监控预警`);
}

function resolveBudgetState(
  status: TokenUsageBudgetStatus,
): TokenUsageBudgetState {
  const states = [status.daily.state, status.monthly.state];
  if (states.includes("exceeded")) {
    return "exceeded";
  }
  if (states.includes("warning")) {
    return "warning";
  }
  if (states.includes("normal")) {
    return "normal";
  }
  return "inactive";
}

function createInactiveBudgetStatus(): TokenUsageBudgetStatus {
  return {
    enabled: false,
    metric: "tokens",
    enforcement: "monitor",
    downgradeModel: null,
    warningRatio: 0.8,
    daily: {
      period: "daily",
      limit: null,
      used: 0,
      remaining: null,
      ratio: null,
      state: "inactive",
    },
    monthly: {
      period: "monthly",
      limit: null,
      used: 0,
      remaining: null,
      ratio: null,
      state: "inactive",
    },
  };
}

function formatScene(scene: string) {
  const sceneMap: Record<string, string> = {
    chat_reply: translateRuntimeMessage(msg`单聊回复生成`),
    group_reply: translateRuntimeMessage(msg`群聊回复生成`),
    moment_post_generate: translateRuntimeMessage(msg`朋友圈发帖生成`),
    moment_comment_generate: translateRuntimeMessage(msg`朋友圈评论生成`),
    feed_post_generate: translateRuntimeMessage(msg`广场动态生成`),
    feed_comment_generate: translateRuntimeMessage(msg`广场评论生成`),
    channel_post_generate: translateRuntimeMessage(msg`视频号内容生成`),
    social_greeting_generate: translateRuntimeMessage(msg`社交问候生成`),
    memory_compress: translateRuntimeMessage(msg`近期记忆压缩`),
    character_factory_extract: translateRuntimeMessage(msg`角色工厂资料抽取`),
    quick_character_generate: translateRuntimeMessage(msg`快速生成角色`),
    intent_classify: translateRuntimeMessage(msg`意图分类`),
    proactive: translateRuntimeMessage(msg`主动消息生成`),
    recent_memory_daily: translateRuntimeMessage(msg`近期记忆日更`),
    core_memory_weekly: translateRuntimeMessage(msg`核心记忆周更`),
    core_memory_extract: translateRuntimeMessage(msg`核心记忆提炼`),
    shake_discovery_plan: translateRuntimeMessage(msg`摇一摇候选规划`),
    shake_discovery_generate: translateRuntimeMessage(msg`摇一摇候选生成`),
    need_discovery_short_analyze: translateRuntimeMessage(msg`短周期需求分析`),
    need_discovery_daily_analyze: translateRuntimeMessage(msg`每日需求分析`),
    need_discovery_character_generate: translateRuntimeMessage(
      msg`需求补位角色生成`,
    ),
    followup_runtime_open_loop_extract: translateRuntimeMessage(
      msg`主动跟进线索提取`,
    ),
    followup_runtime_handoff_message: translateRuntimeMessage(
      msg`主动跟进推荐文案生成`,
    ),
    followup_runtime_friend_request_greeting: translateRuntimeMessage(
      msg`主动跟进好友申请问候`,
    ),
    followup_runtime_friend_request_notice: translateRuntimeMessage(
      msg`主动跟进好友申请提醒`,
    ),
    cyber_avatar_incremental: translateRuntimeMessage(msg`赛博分身增量建模`),
    cyber_avatar_deep_refresh: translateRuntimeMessage(msg`赛博分身深度刷新`),
    cyber_avatar_full_rebuild: translateRuntimeMessage(msg`赛博分身全量重建`),
    cyber_avatar_real_world_brief: translateRuntimeMessage(
      msg`赛博分身现实摘要`,
    ),
    action_runtime_plan: translateRuntimeMessage(msg`动作执行规划`),
  };

  return sceneMap[scene] ?? scene;
}

function resolveActiveQuickRange(
  from: string,
  to: string,
): "today" | "7d" | "30d" | "month" | null {
  const today = formatDateInput(new Date());
  if (to !== today) {
    return null;
  }
  if (from === today) {
    return "today";
  }
  if (from === monthStartInput()) {
    return "month";
  }
  if (from === shiftDate(-29)) {
    return "30d";
  }
  if (from === shiftDate(-6)) {
    return "7d";
  }
  return null;
}

function applyPreset(
  preset: "today" | "7d" | "30d" | "month",
  setFrom: (value: string) => void,
  setTo: (value: string) => void,
) {
  const today = formatDateInput(new Date());
  setTo(today);
  if (preset === "today") {
    setFrom(today);
    return;
  }
  if (preset === "month") {
    setFrom(monthStartInput());
    return;
  }
  setFrom(preset === "30d" ? shiftDate(-29) : shiftDate(-6));
}

function normalizeNullableNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Number(value);
}

function buildChatRecordsReviewHref(
  conversationId: string,
  characterId?: string | null,
) {
  const params = new URLSearchParams();
  params.set("conversationId", conversationId);
  if (characterId) {
    params.set("characterId", characterId);
  }
  return `/chat-records?${params.toString()}`;
}

function updatePricingItem(
  setPricingDraft: Dispatch<SetStateAction<TokenPricingCatalog | null>>,
  index: number,
  patch: Partial<TokenPricingCatalogItem>,
) {
  setPricingDraft((current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    };
  });
}

function addCharacterBudgetRule(
  setBudgetDraft: Dispatch<SetStateAction<TokenUsageBudgetConfig | null>>,
  characters: Character[],
) {
  setBudgetDraft((current) => {
    const next = current ?? emptyBudgetConfig();
    const used = new Set(next.characters.map((item) => item.characterId));
    const candidate = characters.find((item) => !used.has(item.id));
    if (!candidate) {
      return next;
    }
    return {
      ...next,
      characters: [...next.characters, emptyCharacterBudgetRule(candidate.id)],
    };
  });
}

function updateBudgetCharacter(
  setBudgetDraft: Dispatch<SetStateAction<TokenUsageBudgetConfig | null>>,
  index: number,
  patch: Partial<TokenUsageCharacterBudgetRule>,
) {
  setBudgetDraft((current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      characters: current.characters.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    };
  });
}

const INPUT_CLASS_NAME =
  "w-full rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]";
