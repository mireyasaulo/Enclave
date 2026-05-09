import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type {
  RealWorldDigestRecord,
  RealWorldNewsBulletinSlot,
  RealWorldSignalRecord,
  RealWorldSyncCharacterDetail,
  RealWorldSyncCharacterSummary,
  RealWorldSyncOverview,
  RealWorldSyncRules,
  RealWorldSyncRunRecord,
} from "@yinjie/contracts";
import { Button, Card, ErrorBlock, LoadingBlock, StatusPill } from "@yinjie/ui";
import {
  AdminActionFeedback,
  AdminActionGroup,
  AdminCallout,
  AdminCodeBlock,
  AdminDraftStatusPill,
  AdminEmptyState,
  AdminMetaText,
  AdminPageHero,
  AdminRecordCard,
  AdminSectionHeader,
  AdminSelectField,
  AdminSelectableCard,
  AdminSoftBox,
  AdminSubpanel,
  AdminTabs,
  AdminTextArea,
  AdminTextField,
  AdminValueCard,
} from "../components/admin-workbench";
import { adminApi } from "../lib/admin-api";
import { resolveAdminCoreApiBaseUrl } from "../lib/core-api-base";
import {
  compareAdminText,
  formatAdminDateTime as formatLocalizedDateTime,
} from "../lib/format";

type WorkspaceTab = "operations" | "rules";
type DetailTab = "digest" | "signals" | "runs";
type RulesTab = "strategy" | "sources" | "prompts";
type CharacterListFilter = "all" | "attention" | "newsdesk";

const APPLY_MODE_LABELS: Record<string, ReturnType<typeof msg>> = {
  disabled: msg`关闭`,
  shadow: msg`影子模式`,
  live: msg`直接生效`,
  manual: msg`人工查看`,
};

const PROVIDER_MODE_LABELS: Record<string, ReturnType<typeof msg>> = {
  google_news_rss: msg`Google News RSS`,
  mock: msg`Mock 回退`,
};

const SUBJECT_TYPE_LABELS: Record<string, ReturnType<typeof msg>> = {
  living_public_figure: msg`现实公众人物`,
  organization_proxy: msg`机构代理主体`,
  historical_snapshot: msg`历史快照`,
  fictional_or_private: msg`虚构或私域主体`,
};

const REALITY_MOMENT_POLICY_LABELS: Record<string, ReturnType<typeof msg>> = {
  disabled: msg`关闭`,
  optional: msg`可选`,
  force_one_daily: msg`强制每日一条`,
};

const RUN_STATUS_LABELS: Record<string, ReturnType<typeof msg>> = {
  running: msg`执行中`,
  success: msg`成功`,
  failed: msg`失败`,
  partial: msg`部分成功`,
};

const RUN_TYPE_LABELS: Record<string, ReturnType<typeof msg>> = {
  signal_collect: msg`信号采集`,
  digest_generate: msg`Digest 生成`,
  manual_resync: msg`人工重跑`,
};

const DIGEST_STATUS_LABELS: Record<string, ReturnType<typeof msg>> = {
  draft: msg`草稿`,
  active: msg`生效中`,
  superseded: msg`已替换`,
  failed: msg`失败`,
};

const SIGNAL_STATUS_LABELS: Record<string, ReturnType<typeof msg>> = {
  accepted: msg`已采纳`,
  filtered_low_confidence: msg`低可信过滤`,
  filtered_identity_mismatch: msg`身份不匹配`,
  filtered_duplicate: msg`重复过滤`,
  manual_excluded: msg`人工排除`,
};

const SIGNAL_TYPE_LABELS: Record<string, ReturnType<typeof msg>> = {
  news_article: msg`新闻报道`,
  official_post: msg`官方发声`,
  interview: msg`采访`,
  public_appearance: msg`公开露面`,
  product_release: msg`产品发布`,
  other: msg`其他`,
};

const SCENE_PATCH_LABELS: Record<string, ReturnType<typeof msg>> = {
  chat: msg`聊天回复`,
  moments_post: msg`朋友圈发文`,
  moments_comment: msg`朋友圈评论`,
  feed_post: msg`广场动态发文`,
  channel_post: msg`视频号内容`,
  feed_comment: msg`广场评论`,
  greeting: msg`好友请求问候`,
  proactive: msg`主动提醒`,
};

const BULLETIN_SLOT_LABELS: Record<RealWorldNewsBulletinSlot, ReturnType<typeof msg>> = {
  morning: msg`早报`,
  noon: msg`午报`,
  evening: msg`晚报`,
};

const BULLETIN_SLOT_ORDER: RealWorldNewsBulletinSlot[] = [
  "morning",
  "noon",
  "evening",
];

function listToCsv(items: string[]) {
  return items.join(", ");
}

function csvToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseConfidence(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseBooleanSelect(value: string) {
  return value === "true";
}

function formatCompactTime(value?: string | null) {
  return formatLocalizedDateTime(
    value,
    {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
    "notExecuted",
  );
}

function formatScore(value: number) {
  return value.toFixed(2);
}

function toneForApplyMode(mode: string) {
  if (mode === "live") {
    return "healthy" as const;
  }
  if (mode === "shadow") {
    return "warning" as const;
  }
  return "muted" as const;
}

function toneForRunStatus(status: string) {
  if (status === "success") {
    return "healthy" as const;
  }
  if (status === "failed" || status === "partial") {
    return "warning" as const;
  }
  return "muted" as const;
}

function toneForDigestStatus(status: string) {
  if (status === "active") {
    return "healthy" as const;
  }
  if (status === "failed") {
    return "warning" as const;
  }
  return "muted" as const;
}

function toneForSignalStatus(status: string) {
  return status === "accepted" ? ("healthy" as const) : ("muted" as const);
}

function sortBulletinSlots(slots: RealWorldNewsBulletinSlot[]) {
  return [...slots].sort(
    (left, right) =>
      BULLETIN_SLOT_ORDER.indexOf(left) - BULLETIN_SLOT_ORDER.indexOf(right),
  );
}

function formatBulletinSlots(
  slots: RealWorldNewsBulletinSlot[],
  t: typeof translateRuntimeMessage,
) {
  const ordered = sortBulletinSlots(slots);
  if (ordered.length === 0) {
    return t(msg`未发布`);
  }
  return ordered.map((slot) => t(BULLETIN_SLOT_LABELS[slot])).join(" / ");
}

function readMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMetadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMetadataBoolean(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function buildSignalDebugSnapshot(signal: RealWorldSignalRecord) {
  const metadata = readMetadataRecord(signal.metadata);
  if (!metadata) {
    return null;
  }

  return {
    providerMode: readMetadataString(metadata, "providerMode"),
    searchQuery: readMetadataString(metadata, "searchQuery"),
    feedSource: readMetadataString(metadata, "feedSource"),
    rawFeedTitle: readMetadataString(metadata, "rawFeedTitle"),
    rawFeedSnippet: readMetadataString(metadata, "rawFeedSnippet"),
    publisherUrl: readMetadataString(metadata, "publisherUrl"),
    resolvedArticleUrl: readMetadataString(metadata, "resolvedArticleUrl"),
    articleEnrichmentStatus: readMetadataString(
      metadata,
      "articleEnrichmentStatus",
    ),
    articleResolutionMode: readMetadataString(
      metadata,
      "articleResolutionMode",
    ),
    articleResolutionQuery: readMetadataString(
      metadata,
      "articleResolutionQuery",
    ),
    resolverTitle: readMetadataString(metadata, "resolverTitle"),
    resolverSnippet: readMetadataString(metadata, "resolverSnippet"),
    resolverScore: readMetadataNumber(metadata, "resolverScore"),
    articleTitle: readMetadataString(metadata, "articleTitle"),
    articleExcerpt: readMetadataString(metadata, "articleExcerpt"),
    articleTextLength: readMetadataNumber(metadata, "articleTextLength"),
    articleErrorMessage: readMetadataString(metadata, "articleErrorMessage"),
    allowlistMatched: readMetadataBoolean(metadata, "allowlistMatched"),
    rejectionReason: readMetadataString(metadata, "rejectionReason"),
    compositeScore: readMetadataNumber(metadata, "compositeScore"),
    credibilityScore: signal.credibilityScore,
    relevanceScore: signal.relevanceScore,
    identityMatchScore: signal.identityMatchScore,
  };
}

function buildCharacterAttentionReasons(
  item: RealWorldSyncCharacterSummary,
  t: typeof translateRuntimeMessage,
) {
  const reasons: string[] = [];
  if (item.applyMode === "live" && !item.hasActiveDigest) {
    reasons.push(t(msg`Live 未生效`));
  }
  if (item.latestRunStatus === "failed") {
    reasons.push(t(msg`最近同步失败`));
  }
  if (
    !item.isWorldNewsDesk &&
    item.applyMode !== "disabled" &&
    !item.hasRealityLinkedMomentToday
  ) {
    reasons.push(t(msg`今日未发圈`));
  }
  if (
    item.isWorldNewsDesk &&
    item.applyMode !== "disabled" &&
    item.todayBulletinSlots.length === 0
  ) {
    reasons.push(t(msg`今日待播报`));
  }
  return reasons;
}

function getCharacterAttentionScore(item: RealWorldSyncCharacterSummary) {
  let score = 0;
  if (item.applyMode === "live" && !item.hasActiveDigest) {
    score += 4;
  }
  if (item.latestRunStatus === "failed") {
    score += 3;
  } else if (item.latestRunStatus === "partial") {
    score += 2;
  }
  if (
    !item.isWorldNewsDesk &&
    item.applyMode !== "disabled" &&
    !item.hasRealityLinkedMomentToday
  ) {
    score += 2;
  }
  if (
    item.isWorldNewsDesk &&
    item.applyMode !== "disabled" &&
    item.todayBulletinSlots.length === 0
  ) {
    score += 1;
  }
  return score;
}

function buildCharacterListMeta(
  item: RealWorldSyncCharacterSummary,
  t: typeof translateRuntimeMessage,
) {
  const headline = item.isWorldNewsDesk
    ? t(msg`界闻进度 ${formatBulletinSlots(item.todayBulletinSlots, t)}`)
    : t(msg`今日采纳 ${item.todayAcceptedSignalCount} 条 · 发圈 ${
        item.hasRealityLinkedMomentToday ? t(msg`已完成`) : t(msg`未完成`)
      }`);

  const followup = item.latestRunAt
    ? t(msg`最近 ${t(RUN_STATUS_LABELS[item.latestRunStatus ?? "success"] ?? msg`${item.latestRunStatus}`)} · ${formatCompactTime(item.latestRunAt)}`)
    : t(msg`最近暂无执行记录`);

  return `${headline} · ${followup}`;
}

function sortCharacters(characters: RealWorldSyncCharacterSummary[]) {
  return [...characters].sort((left, right) => {
    const scoreDiff =
      getCharacterAttentionScore(right) - getCharacterAttentionScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    if (left.isWorldNewsDesk !== right.isWorldNewsDesk) {
      return left.isWorldNewsDesk ? -1 : 1;
    }
    return compareAdminText(left.characterName, right.characterName);
  });
}

function buildOperationsSummary(
  overview: RealWorldSyncOverview,
  t: typeof translateRuntimeMessage,
) {
  const liveWithoutDigestCount = overview.characters.filter(
    (item) => item.applyMode === "live" && !item.hasActiveDigest,
  ).length;
  const failedRunsCount = overview.recentRuns.filter(
    (run) => run.status === "failed",
  ).length;
  const partialRunsCount = overview.recentRuns.filter(
    (run) => run.status === "partial",
  ).length;
  const missingMomentCount = overview.characters.filter(
    (item) =>
      !item.isWorldNewsDesk &&
      item.applyMode !== "disabled" &&
      !item.hasRealityLinkedMomentToday,
  ).length;

  const messages: string[] = [];
  if (liveWithoutDigestCount > 0) {
    messages.push(
      t(msg`${liveWithoutDigestCount} 个 Live 角色还没有生效中的 digest`),
    );
  }
  if (failedRunsCount > 0) {
    messages.push(t(msg`最近 ${failedRunsCount} 次同步失败，需要回看抓取或模板`));
  }
  if (partialRunsCount > 0) {
    messages.push(t(msg`还有 ${partialRunsCount} 次部分成功的运行值得复盘`));
  }
  if (missingMomentCount > 0) {
    messages.push(t(msg`${missingMomentCount} 个角色今天还没有形成现实发圈结果`));
  }

  if (messages.length === 0) {
    return {
      tone: "success" as const,
      title: t(msg`当前联动节奏稳定`),
      description: t(msg`Live 角色都有生效 digest，最近没有失败运行。建议按左侧角色队列做抽检，重点回看今天新增信号和界闻补发情况。`),
    };
  }

  return {
    tone:
      liveWithoutDigestCount > 0 || failedRunsCount > 0
        ? ("warning" as const)
        : ("info" as const),
    title: t(msg`当前有待处理项`),
    description: t(msg`${messages.join("；")}。建议先从左侧待处理角色开始，再决定是否调整全局规则。`),
  };
}

function SignalDebugPanel({
  signal,
  title,
  defaultOpen = false,
}: {
  signal: RealWorldSignalRecord;
  title?: string;
  defaultOpen?: boolean;
}) {
  const t = translateRuntimeMessage;
  const debugSnapshot = buildSignalDebugSnapshot(signal);
  if (!debugSnapshot) {
    return null;
  }

  const articleExcerpt = debugSnapshot.articleExcerpt;
  const resolvedArticleUrl = debugSnapshot.resolvedArticleUrl;

  return (
    <details
      className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-4 py-3"
      open={defaultOpen}
    >
      <summary className="cursor-pointer text-sm font-medium text-[color:var(--text-secondary)]">
        {title ?? t(msg`抓取调试`)}
      </summary>
      <div className="mt-3 space-y-3">
        {articleExcerpt ? (
          <AdminCallout
            title={t(msg`正文摘录`)}
            tone="info"
            description={articleExcerpt}
          />
        ) : null}
        {resolvedArticleUrl ? (
          <div className="text-xs text-[color:var(--text-secondary)]">
            <a
              href={resolvedArticleUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t(msg`打开解析后的文章`)}
            </a>
          </div>
        ) : null}
        <AdminCodeBlock value={JSON.stringify(debugSnapshot, null, 2)} />
      </div>
    </details>
  );
}

function BulletinSlotStatusGrid({
  slots,
}: {
  slots: RealWorldNewsBulletinSlot[];
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {BULLETIN_SLOT_ORDER.map((slot) => {
        const published = slots.includes(slot);
        return (
          <div
            key={slot}
            className={
              published
                ? "rounded-[18px] border border-emerald-200/70 bg-emerald-50/90 px-4 py-3"
                : "rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3"
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[color:var(--text-primary)]">
                {t(BULLETIN_SLOT_LABELS[slot])}
              </div>
              <StatusPill tone={published ? "healthy" : "muted"}>
                {published ? t(msg`已发布`) : t(msg`待发布`)}
              </StatusPill>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScenePatchPanel({ digest }: { digest: RealWorldDigestRecord }) {
  const t = translateRuntimeMessage;
  const entries = Object.entries(digest.scenePatchPayload).filter(
    ([, value]) => typeof value === "string" && value.trim(),
  ) as Array<[string, string]>;

  if (!entries.length) {
    return (
      <AdminEmptyState
        title={t(msg`当前没有可展示的 Scene Patch`)}
        description={t(msg`这轮 digest 没有向聊天、发圈或主动提醒写入额外场景覆盖。`)}
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-[18px] border border-[color:var(--border-faint)] bg-white/85 p-4 shadow-[var(--shadow-soft)]"
        >
          <AdminMetaText>{SCENE_PATCH_LABELS[key] ? t(SCENE_PATCH_LABELS[key]) : key}</AdminMetaText>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--text-secondary)]">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalRecordCard({
  signal,
  defaultDebugOpen = false,
}: {
  signal: RealWorldSignalRecord;
  defaultDebugOpen?: boolean;
}) {
  const t = translateRuntimeMessage;
  return (
    <div className="space-y-2">
      <AdminRecordCard
        title={signal.title}
        badges={
          <>
            <StatusPill tone={toneForSignalStatus(signal.status)}>
              {SIGNAL_STATUS_LABELS[signal.status] ? t(SIGNAL_STATUS_LABELS[signal.status]) : signal.status}
            </StatusPill>
            <StatusPill tone="muted">
              {SIGNAL_TYPE_LABELS[signal.signalType] ? t(SIGNAL_TYPE_LABELS[signal.signalType]) : signal.signalType}
            </StatusPill>
          </>
        }
        meta={`${signal.sourceName} · ${formatCompactTime(signal.publishedAt ?? signal.capturedAt)}`}
        description={signal.normalizedSummary ?? signal.snippet ?? t(msg`暂无概况`)}
        details={
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <AdminSoftBox className="text-xs">
                {t(msg`可信度 ${formatScore(signal.credibilityScore)}`)}
              </AdminSoftBox>
              <AdminSoftBox className="text-xs">
                {t(msg`相关性 ${formatScore(signal.relevanceScore)}`)}
              </AdminSoftBox>
              <AdminSoftBox className="text-xs">
                {t(msg`身份匹配 ${formatScore(signal.identityMatchScore)}`)}
              </AdminSoftBox>
            </div>
            {signal.sourceUrl ? (
              <div className="text-xs text-[color:var(--text-secondary)]">
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {t(msg`打开原始来源`)}
                </a>
              </div>
            ) : null}
          </div>
        }
      />
      <SignalDebugPanel signal={signal} defaultOpen={defaultDebugOpen} />
    </div>
  );
}

function RunRecordCard({
  run,
  characterName,
}: {
  run: RealWorldSyncRunRecord;
  characterName?: string | null;
}) {
  const t = translateRuntimeMessage;
  return (
    <AdminRecordCard
      title={characterName ?? (RUN_TYPE_LABELS[run.runType] ? t(RUN_TYPE_LABELS[run.runType]) : run.runType)}
      badges={
        <>
          <StatusPill tone={toneForRunStatus(run.status)}>
            {RUN_STATUS_LABELS[run.status] ? t(RUN_STATUS_LABELS[run.status]) : run.status}
          </StatusPill>
          <StatusPill tone="muted">
            {RUN_TYPE_LABELS[run.runType] ? t(RUN_TYPE_LABELS[run.runType]) : run.runType}
          </StatusPill>
        </>
      }
      meta={t(msg`开始 ${formatCompactTime(run.startedAt)}${
        run.finishedAt ? t(msg` · 结束 ${formatCompactTime(run.finishedAt)}`) : ""
      }`)}
      description={t(msg`采纳 ${run.acceptedSignalCount} 条，过滤 ${run.filteredSignalCount} 条${
        run.searchQuery ? t(msg` · 查询 ${run.searchQuery}`) : ""
      }`)}
      details={
        run.errorMessage ? (
          <AdminCallout
            title={t(msg`本轮错误`)}
            tone="warning"
            description={run.errorMessage}
          />
        ) : undefined
      }
    />
  );
}

function DigestRecordCard({ digest }: { digest: RealWorldDigestRecord }) {
  const t = translateRuntimeMessage;
  return (
    <AdminRecordCard
      title={formatCompactTime(digest.updatedAt)}
      badges={
        <>
          <StatusPill tone={toneForDigestStatus(digest.status)}>
            {DIGEST_STATUS_LABELS[digest.status] ? t(DIGEST_STATUS_LABELS[digest.status]) : digest.status}
          </StatusPill>
          {digest.appliedMode ? (
            <StatusPill tone={toneForApplyMode(digest.appliedMode)}>
              {APPLY_MODE_LABELS[digest.appliedMode] ? t(APPLY_MODE_LABELS[digest.appliedMode]) : digest.appliedMode}
            </StatusPill>
          ) : null}
        </>
      }
      meta={t(msg`信号 ${digest.signalIds.length} 条${
        digest.appliedAt
          ? t(msg` · 应用时间 ${formatCompactTime(digest.appliedAt)}`)
          : ""
      }`)}
      description={digest.dailySummary}
      details={
        digest.realityMomentBrief ? (
          <AdminSoftBox className="text-xs">
            {t(msg`发圈锚点：`)}{digest.realityMomentBrief}
          </AdminSoftBox>
        ) : undefined
      }
    />
  );
}

export function RealWorldSyncPage() {
  const t = translateRuntimeMessage;
  const baseUrl = resolveAdminCoreApiBaseUrl();
  const queryClient = useQueryClient();
  const [rulesDraft, setRulesDraft] = useState<RealWorldSyncRules | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("operations");
  const [detailTab, setDetailTab] = useState<DetailTab>("digest");
  const [rulesTab, setRulesTab] = useState<RulesTab>("strategy");
  const [characterListFilter, setCharacterListFilter] =
    useState<CharacterListFilter>("all");
  const [characterQuery, setCharacterQuery] = useState("");
  const deferredCharacterQuery = useDeferredValue(characterQuery.trim());

  const overviewQuery = useQuery({
    queryKey: ["admin-real-world-sync-overview", baseUrl],
    queryFn: () => adminApi.getRealWorldSyncOverview(),
  });

  useEffect(() => {
    if (!overviewQuery.data) {
      return;
    }
    setRulesDraft((current) => current ?? overviewQuery.data.rules);
  }, [overviewQuery.data]);

  const sortedCharacters = useMemo(
    () => sortCharacters(overviewQuery.data?.characters ?? []),
    [overviewQuery.data?.characters],
  );

  const filteredCharacters = useMemo(() => {
    const keyword = deferredCharacterQuery.toLocaleLowerCase();
    return sortedCharacters.filter((item) => {
      if (
        characterListFilter === "attention" &&
        getCharacterAttentionScore(item) === 0
      ) {
        return false;
      }
      if (characterListFilter === "newsdesk" && !item.isWorldNewsDesk) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [item.characterName, item.subjectName]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(keyword));
    });
  }, [characterListFilter, deferredCharacterQuery, sortedCharacters]);

  useEffect(() => {
    if (!sortedCharacters.length) {
      setSelectedCharacterId("");
      return;
    }

    if (!selectedCharacterId) {
      setSelectedCharacterId(sortedCharacters[0].characterId);
      return;
    }

    const currentExists = sortedCharacters.some(
      (item) => item.characterId === selectedCharacterId,
    );
    if (!currentExists) {
      setSelectedCharacterId(sortedCharacters[0].characterId);
      return;
    }

    const hasFilter =
      characterListFilter !== "all" || deferredCharacterQuery.length > 0;
    if (
      hasFilter &&
      filteredCharacters.length > 0 &&
      !filteredCharacters.some(
        (item) => item.characterId === selectedCharacterId,
      )
    ) {
      setSelectedCharacterId(filteredCharacters[0].characterId);
    }
  }, [
    characterListFilter,
    deferredCharacterQuery,
    filteredCharacters,
    selectedCharacterId,
    sortedCharacters,
  ]);

  const detailQuery = useQuery({
    queryKey: ["admin-real-world-sync-character", baseUrl, selectedCharacterId],
    queryFn: () =>
      adminApi.getRealWorldSyncCharacterDetail(selectedCharacterId),
    enabled: Boolean(selectedCharacterId),
  });

  const saveRulesMutation = useMutation({
    mutationFn: (payload: RealWorldSyncRules) =>
      adminApi.setRealWorldSyncRules(payload),
    onSuccess: (nextRules) => {
      setRulesDraft(nextRules);
      void queryClient.invalidateQueries({
        queryKey: ["admin-real-world-sync-overview", baseUrl],
      });
    },
  });

  const runMutation = useMutation({
    mutationFn: (characterId?: string | null) =>
      adminApi.runRealWorldSync({ characterId }),
    onSuccess: async (_, characterId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-real-world-sync-overview", baseUrl],
        }),
        characterId
          ? queryClient.invalidateQueries({
              queryKey: [
                "admin-real-world-sync-character",
                baseUrl,
                characterId,
              ],
            })
          : Promise.resolve(),
      ]);
    },
  });

  const publishBulletinMutation = useMutation({
    mutationFn: (slot: RealWorldNewsBulletinSlot) =>
      adminApi.publishRealWorldNewsBulletin({ slot }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-real-world-sync-overview", baseUrl],
        }),
        selectedCharacterId
          ? queryClient.invalidateQueries({
              queryKey: [
                "admin-real-world-sync-character",
                baseUrl,
                selectedCharacterId,
              ],
            })
          : Promise.resolve(),
      ]);
    },
  });

  const isRulesDirty = useMemo(() => {
    if (!rulesDraft || !overviewQuery.data) {
      return false;
    }
    return (
      JSON.stringify(rulesDraft) !== JSON.stringify(overviewQuery.data.rules)
    );
  }, [overviewQuery.data, rulesDraft]);

  if (overviewQuery.isLoading) {
    return <LoadingBlock label={t(msg`正在读取真实世界联动...`)} />;
  }

  if (overviewQuery.isError && overviewQuery.error instanceof Error) {
    return <ErrorBlock message={overviewQuery.error.message} />;
  }

  if (!overviewQuery.data || !rulesDraft) {
    return (
      <AdminEmptyState
        title={t(msg`真实世界联动暂不可用`)}
        description={t(msg`后端 real-world-sync 模块还没成功返回概览数据。`)}
      />
    );
  }

  const overview = overviewQuery.data;
  const detail: RealWorldSyncCharacterDetail | null = detailQuery.data ?? null;
  const characterNameById = new Map(
    overview.characters.map((item) => [item.characterId, item.characterName]),
  );
  const selectedCharacterSummary =
    overview.characters.find(
      (item) => item.characterId === selectedCharacterId,
    ) ?? null;
  const bulletinDeskCharacter =
    overview.characters.find((item) => item.isWorldNewsDesk) ?? null;
  const operationsSummary = buildOperationsSummary(overview, t);
  const attentionCharacters = sortedCharacters.filter(
    (item) => getCharacterAttentionScore(item) > 0,
  );
  const firstAttentionCharacter = attentionCharacters[0] ?? null;
  const recentRiskRuns = overview.recentRuns.filter(
    (run) => run.status === "failed" || run.status === "partial",
  );
  const recentAcceptedSignals = overview.recentSignals.filter(
    (signal) => signal.status === "accepted",
  );
  const latestDebugSignal =
    detail?.recentSignals.find((signal) => buildSignalDebugSnapshot(signal)) ??
    null;
  const currentRunTargetName =
    typeof runMutation.variables === "string"
      ? (characterNameById.get(runMutation.variables) ?? runMutation.variables)
      : null;

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="Reality Sync"
        title={t(msg`现实联动运营工作台`)}
        description={t(msg`把外部现实信号、Digest 生效、界闻补发和发圈结果收敛到同一条值班路径里。运营先看今日节奏和待处理角色，再决定是否调全局规则。`)}
        badges={[
          t(msg`专属播报角色：${bulletinDeskCharacter?.characterName ?? t(msg`界闻`)}`),
          t(msg`覆盖角色：已启用现实联动角色`),
        ]}
        metrics={[
          { label: t(msg`已启用角色`), value: overview.stats.enabledCharacters },
          { label: t(msg`Live 生效角色`), value: overview.stats.liveCharacters },
          { label: t(msg`生效中 Digest`), value: overview.stats.activeDigests },
          { label: t(msg`今日信号数`), value: overview.stats.signalsToday },
        ]}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["admin-real-world-sync-overview", baseUrl],
                })
              }
            >
              {overviewQuery.isFetching ? t(msg`刷新中...`) : t(msg`刷新概览`)}
            </Button>
            <Button
              variant="secondary"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate(null)}
            >
              {runMutation.isPending && runMutation.variables == null
                ? t(msg`全量同步中...`)
                : t(msg`全量立即同步`)}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setWorkspaceTab((current) =>
                  current === "operations" ? "rules" : "operations",
                )
              }
            >
              {workspaceTab === "operations"
                ? t(msg`查看全局规则`)
                : t(msg`回到运营工作台`)}
            </Button>
          </>
        }
      />

      {saveRulesMutation.isPending ? (
        <AdminActionFeedback
          tone="busy"
          title={t(msg`正在保存 Reality Sync 规则`)}
          description={t(msg`新的默认采集窗口、来源过滤和提示词模板正在写入后台配置。`)}
        />
      ) : null}
      {saveRulesMutation.isSuccess ? (
        <AdminActionFeedback
          tone="success"
          title={t(msg`Reality Sync 规则已保存`)}
          description={t(msg`新的默认搜索窗口、信号阈值和概况模板已经写入后台配置。`)}
        />
      ) : null}
      {runMutation.isPending ? (
        <AdminActionFeedback
          tone="busy"
          title={t(msg`Reality Sync 正在执行`)}
          description={
            currentRunTargetName
              ? t(msg`正在同步 ${currentRunTargetName}，完成后会自动刷新角色详情和概览。`)
              : t(msg`正在触发全量 Reality Sync，完成后会自动刷新概览。`)
          }
        />
      ) : null}
      {runMutation.isSuccess ? (
        <AdminActionFeedback
          tone="success"
          title={t(msg`Reality Sync 已执行`)}
          description={t(msg`成功 ${runMutation.data.successCount} 个，失败 ${runMutation.data.failedCount} 个。`)}
        />
      ) : null}
      {publishBulletinMutation.isPending ? (
        <AdminActionFeedback
          tone="busy"
          title={t(msg`界闻补发中`)}
          description={t(msg`正在补发${
            publishBulletinMutation.variables
              ? t(BULLETIN_SLOT_LABELS[publishBulletinMutation.variables])
              : t(msg`界闻`)
          }，完成后会自动刷新今日播报状态。`)}
        />
      ) : null}
      {publishBulletinMutation.isSuccess ? (
        <AdminActionFeedback
          tone={publishBulletinMutation.data.created ? "success" : "info"}
          title={
            publishBulletinMutation.data.created
              ? t(msg`界闻更新已发出`)
              : t(msg`界闻这轮没重复发`)
          }
          description={publishBulletinMutation.data.summary}
        />
      ) : null}
      {saveRulesMutation.isError && saveRulesMutation.error instanceof Error ? (
        <ErrorBlock message={saveRulesMutation.error.message} />
      ) : null}
      {runMutation.isError && runMutation.error instanceof Error ? (
        <ErrorBlock message={runMutation.error.message} />
      ) : null}
      {publishBulletinMutation.isError &&
      publishBulletinMutation.error instanceof Error ? (
        <ErrorBlock message={publishBulletinMutation.error.message} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader
              title={t(msg`角色队列`)}
              actions={
                <StatusPill
                  tone={attentionCharacters.length ? "warning" : "muted"}
                >
                  {attentionCharacters.length
                    ? t(msg`${attentionCharacters.length} 个待处理`)
                    : t(msg`全部平稳`)}
                </StatusPill>
              }
            />
            <div className="mt-4 space-y-4">
              <AdminTabs
                tabs={[
                  { key: "all", label: t(msg`全部 ${sortedCharacters.length}`) },
                  {
                    key: "attention",
                    label: t(msg`待处理 ${attentionCharacters.length}`),
                  },
                  {
                    key: "newsdesk",
                    label: t(msg`界闻 ${
                      sortedCharacters.filter((item) => item.isWorldNewsDesk)
                        .length
                    }`),
                  },
                ]}
                activeKey={characterListFilter}
                onChange={(value) =>
                  setCharacterListFilter(value as CharacterListFilter)
                }
              />
              <AdminTextField
                label={t(msg`搜索角色`)}
                value={characterQuery}
                onChange={setCharacterQuery}
                placeholder={t(msg`角色名 / 主体名称`)}
              />

              {filteredCharacters.length > 0 ? (
                <div className="space-y-3">
                  {filteredCharacters.map((item) => {
                    const attentionReasons =
                      buildCharacterAttentionReasons(item, t);
                    return (
                      <AdminSelectableCard
                        key={item.characterId}
                        active={selectedCharacterId === item.characterId}
                        title={item.characterName}
                        subtitle={t(msg`${item.subjectName} · ${
                          SUBJECT_TYPE_LABELS[item.subjectType]
                            ? t(SUBJECT_TYPE_LABELS[item.subjectType])
                            : item.subjectType
                        }`)}
                        meta={buildCharacterListMeta(item, t)}
                        badge={
                          <div className="flex flex-col items-end gap-2">
                            {attentionReasons.length > 0 ? (
                              <StatusPill tone="warning">{t(msg`待处理`)}</StatusPill>
                            ) : null}
                            {item.isWorldNewsDesk ? (
                              <StatusPill tone="healthy">{t(msg`界闻`)}</StatusPill>
                            ) : null}
                            <StatusPill tone={toneForApplyMode(item.applyMode)}>
                              {APPLY_MODE_LABELS[item.applyMode]
                                ? t(APPLY_MODE_LABELS[item.applyMode])
                                : item.applyMode}
                            </StatusPill>
                          </div>
                        }
                        onClick={() => {
                          setSelectedCharacterId(item.characterId);
                          setWorkspaceTab("operations");
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <AdminEmptyState
                  title={t(msg`没有匹配的角色`)}
                  description={t(msg`换一个筛选条件，或者回到"全部角色"查看完整队列。`)}
                />
              )}
            </div>
          </Card>

          <Card className="bg-[color:var(--surface-console)]">
            <AdminSectionHeader
              title={t(msg`排查提示`)}
              actions={<StatusPill tone="muted">{t(msg`值班顺序`)}</StatusPill>}
            />
            <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--text-secondary)]">
              <AdminSoftBox>
                {t(msg`先看左侧标记为"待处理"的角色，优先处理 Live 未生效和最近失败的同步。`)}
              </AdminSoftBox>
              <AdminSoftBox>
                {t(msg`界闻角色先确认三段播报进度，再决定是否补发早报 / 午报 / 晚报。`)}
              </AdminSoftBox>
              <AdminSoftBox>
                {t(msg`只有在问题跨角色重复出现时，再切到"全局规则"改 Provider、阈值或 Prompt。`)}
              </AdminSoftBox>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <AdminCallout
            title={operationsSummary.title}
            tone={operationsSummary.tone}
            description={operationsSummary.description}
            actions={
              <>
                {firstAttentionCharacter ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedCharacterId(
                        firstAttentionCharacter.characterId,
                      );
                      setWorkspaceTab("operations");
                    }}
                  >
                    {t(msg`聚焦待处理角色`)}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWorkspaceTab("rules")}
                >
                  {t(msg`检查全局规则`)}
                </Button>
              </>
            }
          />

          <AdminTabs
            tabs={[
              { key: "operations", label: t(msg`运营工作台`) },
              {
                key: "rules",
                label: isRulesDirty ? t(msg`全局规则 *`) : t(msg`全局规则`),
              },
            ]}
            activeKey={workspaceTab}
            onChange={(value) => setWorkspaceTab(value as WorkspaceTab)}
          />

          {workspaceTab === "operations" ? (
            <div className="space-y-6">
              <Card className="bg-[color:var(--surface-console)]">
                <AdminSectionHeader
                  title={t(msg`今日值班面板`)}
                  actions={
                    <StatusPill
                      tone={
                        attentionCharacters.length > 0 ? "warning" : "healthy"
                      }
                    >
                      {attentionCharacters.length > 0
                        ? t(msg`需要人工跟进`)
                        : t(msg`当前运行平稳`)}
                    </StatusPill>
                  }
                />

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <AdminValueCard
                        label={t(msg`生效中 Digest`)}
                        value={t(msg`${overview.stats.activeDigests} 个角色`)}
                      />
                      <AdminValueCard
                        label={t(msg`今日现实发圈`)}
                        value={t(msg`${overview.stats.realityLinkedMomentsToday} 条`)}
                      />
                      <AdminValueCard
                        label={t(msg`今日新闻更新`)}
                        value={t(msg`${overview.stats.newsBulletinsToday} 条`)}
                      />
                      <AdminValueCard
                        label={t(msg`最近失败运行`)}
                        value={t(msg`${recentRiskRuns.filter((run) => run.status === "failed").length} 次`)}
                      />
                      <AdminValueCard
                        label={t(msg`今日已采纳信号`)}
                        value={t(msg`${recentAcceptedSignals.length} 条`)}
                      />
                      <AdminValueCard
                        label={t(msg`待处理角色`)}
                        value={t(msg`${attentionCharacters.length} 个`)}
                      />
                    </div>

                    <AdminSubpanel title={t(msg`最新采纳信号`)}>
                      {recentAcceptedSignals.length > 0 ? (
                        <div className="space-y-3">
                          {recentAcceptedSignals.slice(0, 3).map((signal) => (
                            <AdminRecordCard
                              key={signal.id}
                              title={signal.title}
                              badges={
                                <StatusPill tone="healthy">
                                  {SIGNAL_TYPE_LABELS[signal.signalType]
                                    ? t(SIGNAL_TYPE_LABELS[signal.signalType])
                                    : signal.signalType}
                                </StatusPill>
                              }
                              meta={`${signal.sourceName} · ${formatCompactTime(signal.publishedAt ?? signal.capturedAt)}`}
                              description={
                                signal.normalizedSummary ??
                                signal.snippet ??
                                t(msg`暂无概况`)
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <AdminEmptyState
                          title={t(msg`今天还没有采纳信号`)}
                          description={t(msg`先执行同步，或者回看 Provider 和来源过滤规则。`)}
                        />
                      )}
                    </AdminSubpanel>
                  </div>

                  <div className="space-y-4">
                    <AdminActionGroup
                      title={t(msg`三段界闻`)}
                      description={
                        bulletinDeskCharacter
                          ? t(msg`当前界闻角色：${bulletinDeskCharacter.characterName}。今天已完成 ${formatBulletinSlots(
                              bulletinDeskCharacter.todayBulletinSlots,
                              t,
                            )}。`)
                          : t(msg`当前还没有启用界闻角色。`)
                      }
                    >
                      {bulletinDeskCharacter ? (
                        <div className="space-y-4">
                          <BulletinSlotStatusGrid
                            slots={bulletinDeskCharacter.todayBulletinSlots}
                          />
                          <div className="flex flex-wrap gap-3">
                            {BULLETIN_SLOT_ORDER.map((slot) => (
                              <Button
                                key={slot}
                                variant="secondary"
                                size="sm"
                                disabled={publishBulletinMutation.isPending}
                                onClick={() =>
                                  publishBulletinMutation.mutate(slot)
                                }
                              >
                                {publishBulletinMutation.isPending &&
                                publishBulletinMutation.variables === slot
                                  ? t(msg`补发${t(BULLETIN_SLOT_LABELS[slot])}中...`)
                                  : t(msg`补发${t(BULLETIN_SLOT_LABELS[slot])}`)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <AdminEmptyState
                          title={t(msg`暂无界闻角色`)}
                          description={t(msg`先在角色工厂启用现实联动，并设置一位承担三段播报的角色。`)}
                        />
                      )}
                    </AdminActionGroup>

                    <AdminActionGroup
                      title={t(msg`最近异常`)}
                      description={t(msg`优先回看失败或部分成功的运行，避免 digest 未生效。`)}
                    >
                      {recentRiskRuns.length > 0 ? (
                        <div className="space-y-3">
                          {recentRiskRuns.slice(0, 3).map((run) => (
                            <RunRecordCard
                              key={run.id}
                              run={run}
                              characterName={characterNameById.get(
                                run.characterId,
                              )}
                            />
                          ))}
                        </div>
                      ) : (
                        <AdminEmptyState
                          title={t(msg`最近没有异常运行`)}
                          description={t(msg`最近几轮同步都没有失败或部分成功。`)}
                        />
                      )}
                    </AdminActionGroup>
                  </div>
                </div>
              </Card>

              {selectedCharacterSummary ? (
                detailQuery.isLoading ? (
                  <LoadingBlock label={t(msg`正在读取角色现实概况...`)} />
                ) : detailQuery.isError &&
                  detailQuery.error instanceof Error ? (
                  <ErrorBlock message={detailQuery.error.message} />
                ) : detail ? (
                  <Card className="bg-[color:var(--surface-console)]">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="text-[12px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                          {t(msg`角色工作台`)}
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
                          {detail.characterName}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                          {detail.config.subjectName} ·{" "}
                          {SUBJECT_TYPE_LABELS[detail.config.subjectType]
                            ? t(SUBJECT_TYPE_LABELS[detail.config.subjectType])
                            : detail.config.subjectType}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                          {detail.isWorldNewsDesk
                            ? t(msg`界闻角色，今日播报进度：${formatBulletinSlots(
                                detail.todayBulletinSlots,
                                t,
                              )}。`)
                            : t(msg`今日采纳 ${selectedCharacterSummary.todayAcceptedSignalCount} 条信号，现实发圈 ${
                                detail.hasRealityLinkedMomentToday
                                  ? t(msg`已完成`)
                                  : t(msg`还未完成`)
                              }。`)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <StatusPill
                          tone={toneForApplyMode(detail.config.applyMode)}
                        >
                          {APPLY_MODE_LABELS[detail.config.applyMode]
                            ? t(APPLY_MODE_LABELS[detail.config.applyMode])
                            : detail.config.applyMode}
                        </StatusPill>
                        {detail.activeDigest ? (
                          <StatusPill tone="healthy">{t(msg`Digest 生效中`)}</StatusPill>
                        ) : (
                          <StatusPill tone="warning">{t(msg`Digest 未生效`)}</StatusPill>
                        )}
                        <Button
                          variant="secondary"
                          disabled={runMutation.isPending}
                          onClick={() => runMutation.mutate(detail.characterId)}
                        >
                          {runMutation.isPending &&
                          runMutation.variables === detail.characterId
                            ? t(msg`同步中...`)
                            : t(msg`立即同步`)}
                        </Button>
                        <Link
                          to="/characters/$characterId/factory"
                          params={{ characterId: detail.characterId }}
                        >
                          <Button variant="secondary">{t(msg`配置角色`)}</Button>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <AdminValueCard
                        label={t(msg`现实发圈策略`)}
                        value={
                          REALITY_MOMENT_POLICY_LABELS[
                            detail.config.realityMomentPolicy
                          ]
                            ? t(REALITY_MOMENT_POLICY_LABELS[detail.config.realityMomentPolicy])
                            : detail.config.realityMomentPolicy
                        }
                      />
                      <AdminValueCard
                        label={t(msg`最近同步`)}
                        value={
                          selectedCharacterSummary.latestRunAt
                            ? t(msg`${RUN_STATUS_LABELS[selectedCharacterSummary.latestRunStatus ?? "success"] ? t(RUN_STATUS_LABELS[selectedCharacterSummary.latestRunStatus ?? "success"]) : selectedCharacterSummary.latestRunStatus} · ${formatCompactTime(
                                selectedCharacterSummary.latestRunAt,
                              )}`)
                            : t(msg`暂无记录`)
                        }
                      />
                      <AdminValueCard
                        label={t(msg`查询模板`)}
                        value={detail.config.queryTemplate || t(msg`未配置`)}
                      />
                      <AdminValueCard
                        label={t(msg`今日状态`)}
                        value={
                          detail.isWorldNewsDesk
                            ? formatBulletinSlots(detail.todayBulletinSlots, t)
                            : detail.hasRealityLinkedMomentToday
                              ? t(msg`现实发圈已完成`)
                              : t(msg`现实发圈待生成`)
                        }
                      />
                    </div>

                    <div className="mt-6">
                      <AdminTabs
                        tabs={[
                          { key: "digest", label: t(msg`当前 Digest`) },
                          { key: "signals", label: t(msg`信号明细`) },
                          { key: "runs", label: t(msg`运行记录`) },
                        ]}
                        activeKey={detailTab}
                        onChange={(value) => setDetailTab(value as DetailTab)}
                      />
                    </div>

                    <div className="mt-6">
                      {detailTab === "digest" ? (
                        <div className="space-y-4">
                          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                            <AdminSubpanel title={t(msg`角色配置`)}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <AdminValueCard
                                  label={t(msg`主体名称`)}
                                  value={detail.config.subjectName}
                                />
                                <AdminValueCard
                                  label={t(msg`主体类型`)}
                                  value={
                                    SUBJECT_TYPE_LABELS[detail.config.subjectType]
                                      ? t(SUBJECT_TYPE_LABELS[detail.config.subjectType])
                                      : detail.config.subjectType
                                  }
                                />
                                <AdminValueCard
                                  label={t(msg`别名`)}
                                  value={
                                    detail.config.aliases.length > 0
                                      ? detail.config.aliases.join(" / ")
                                      : t(msg`未配置`)
                                  }
                                />
                                <AdminValueCard
                                  label={t(msg`手动 steering`)}
                                  value={
                                    detail.config.manualSteeringNotes ||
                                    t(msg`未配置`)
                                  }
                                />
                              </div>
                            </AdminSubpanel>

                            <AdminSubpanel title={t(msg`当前生效结果`)}>
                              {detail.activeDigest ? (
                                <div className="space-y-4">
                                  <AdminCallout
                                    title={t(msg`今日现实概况`)}
                                    tone="info"
                                    description={
                                      detail.activeDigest.dailySummary
                                    }
                                  />
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <AdminValueCard
                                      label={t(msg`Digest 状态`)}
                                      value={
                                        DIGEST_STATUS_LABELS[detail.activeDigest.status]
                                          ? t(DIGEST_STATUS_LABELS[detail.activeDigest.status])
                                          : detail.activeDigest.status
                                      }
                                    />
                                    <AdminValueCard
                                      label={t(msg`应用模式`)}
                                      value={
                                        detail.activeDigest.appliedMode
                                          ? (APPLY_MODE_LABELS[detail.activeDigest.appliedMode]
                                              ? t(APPLY_MODE_LABELS[detail.activeDigest.appliedMode])
                                              : detail.activeDigest.appliedMode)
                                          : t(msg`未记录`)
                                      }
                                    />
                                    <AdminValueCard
                                      label={t(msg`信号数`)}
                                      value={t(msg`${detail.activeDigest.signalIds.length} 条`)}
                                    />
                                    <AdminValueCard
                                      label={t(msg`更新时间`)}
                                      value={formatCompactTime(
                                        detail.activeDigest.updatedAt,
                                      )}
                                    />
                                  </div>
                                  {detail.activeDigest.behaviorSummary ? (
                                    <AdminSoftBox>
                                      {t(msg`行为摘要：`)}
                                      {detail.activeDigest.behaviorSummary}
                                    </AdminSoftBox>
                                  ) : null}
                                  {detail.activeDigest.stanceShiftSummary ? (
                                    <AdminSoftBox>
                                      {t(msg`立场变化：`)}
                                      {detail.activeDigest.stanceShiftSummary}
                                    </AdminSoftBox>
                                  ) : null}
                                  {detail.activeDigest.realityMomentBrief ? (
                                    <AdminCallout
                                      title={t(msg`现实发圈锚点`)}
                                      tone="success"
                                      description={
                                        detail.activeDigest.realityMomentBrief
                                      }
                                    />
                                  ) : null}
                                </div>
                              ) : (
                                <AdminEmptyState
                                  title={t(msg`当前还没有生效中的现实概况`)}
                                  description={t(msg`该角色还没跑出 live digest，或者当前处于 shadow / disabled 模式。`)}
                                />
                              )}
                            </AdminSubpanel>
                          </div>

                          {detail.isWorldNewsDesk ? (
                            <AdminCallout
                              title={t(msg`界闻三段更新`)}
                              tone="success"
                              description={t(msg`今天已完成：${formatBulletinSlots(
                                detail.todayBulletinSlots,
                                t,
                              )}。调度窗口为 07:30-09:30、11:30-13:30、18:30-21:00，同一时段当天只发一次。`)}
                              actions={
                                <>
                                  {BULLETIN_SLOT_ORDER.map((slot) => (
                                    <Button
                                      key={slot}
                                      variant="secondary"
                                      size="sm"
                                      disabled={
                                        publishBulletinMutation.isPending
                                      }
                                      onClick={() =>
                                        publishBulletinMutation.mutate(slot)
                                      }
                                    >
                                      {publishBulletinMutation.isPending &&
                                      publishBulletinMutation.variables === slot
                                        ? t(msg`补发${t(BULLETIN_SLOT_LABELS[slot])}中...`)
                                        : t(msg`补发${t(BULLETIN_SLOT_LABELS[slot])}`)}
                                    </Button>
                                  ))}
                                </>
                              }
                            />
                          ) : null}

                          {detail.activeDigest ? (
                            <>
                              <AdminSubpanel title="Scene Patch">
                                <ScenePatchPanel digest={detail.activeDigest} />
                              </AdminSubpanel>

                              {detail.activeDigest.globalOverlay ? (
                                <AdminSubpanel title="Global Overlay">
                                  <AdminCodeBlock
                                    value={detail.activeDigest.globalOverlay}
                                  />
                                </AdminSubpanel>
                              ) : null}
                            </>
                          ) : null}

                          <AdminSubpanel title={t(msg`最近 Digest 记录`)}>
                            {detail.recentDigests.length > 0 ? (
                              <div className="space-y-3">
                                {detail.recentDigests
                                  .slice(0, 4)
                                  .map((digest) => (
                                    <DigestRecordCard
                                      key={digest.id}
                                      digest={digest}
                                    />
                                  ))}
                              </div>
                            ) : (
                              <AdminEmptyState
                                title={t(msg`还没有历史 Digest`)}
                                description={t(msg`需要先有一次成功的 digest 生成，历史记录才会出现在这里。`)}
                              />
                            )}
                          </AdminSubpanel>
                        </div>
                      ) : null}

                      {detailTab === "signals" ? (
                        <div className="space-y-4">
                          <AdminCallout
                            title={t(msg`信号排查`)}
                            tone="info"
                            description={t(msg`这里保留最近采集到的现实信号、归一化摘要和抓取调试快照。先看状态与三项分数，再决定是调来源过滤、阈值还是 Prompt。`)}
                          />
                          {detail.recentSignals.length > 0 ? (
                            <div className="space-y-3">
                              {detail.recentSignals
                                .slice(0, 8)
                                .map((signal) => (
                                  <SignalRecordCard
                                    key={signal.id}
                                    signal={signal}
                                    defaultDebugOpen={
                                      latestDebugSignal?.id === signal.id
                                    }
                                  />
                                ))}
                            </div>
                          ) : (
                            <AdminEmptyState
                              title={t(msg`最近没有信号`)}
                              description={t(msg`先执行同步，或者检查该角色是否真的启用了现实联动。`)}
                            />
                          )}
                        </div>
                      ) : null}

                      {detailTab === "runs" ? (
                        <div className="space-y-4">
                          <AdminCallout
                            title={t(msg`运行回看`)}
                            tone="info"
                            description={t(msg`一轮运行会经历信号采集、digest 生成和人工重跑几种状态。异常时优先看查询词、采纳/过滤数量和错误信息。`)}
                          />
                          {detail.recentRuns.length > 0 ? (
                            <div className="space-y-3">
                              {detail.recentRuns.slice(0, 8).map((run) => (
                                <RunRecordCard key={run.id} run={run} />
                              ))}
                            </div>
                          ) : (
                            <AdminEmptyState
                              title={t(msg`还没有运行记录`)}
                              description={t(msg`当前角色还没有执行过现实联动。`)}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ) : null
              ) : (
                <AdminEmptyState
                  title={t(msg`还没有启用真实世界联动的角色`)}
                  description={t(msg`先去角色工厂打开"真实世界链接"，再回来观察每日现实概况和现实发圈。`)}
                  actions={
                    <Link to="/characters">
                      <Button variant="secondary">{t(msg`前往角色工厂`)}</Button>
                    </Link>
                  }
                />
              )}
            </div>
          ) : (
            <Card className="bg-[color:var(--surface-console)]">
              <AdminSectionHeader
                title={t(msg`全局规则`)}
                actions={
                  <div className="flex flex-wrap items-center gap-3">
                    <AdminDraftStatusPill ready dirty={isRulesDirty} />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!isRulesDirty}
                      onClick={() => setRulesDraft(overview.rules)}
                    >
                      {t(msg`重置草稿`)}
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!isRulesDirty || saveRulesMutation.isPending}
                      onClick={() => saveRulesMutation.mutate(rulesDraft)}
                    >
                      {saveRulesMutation.isPending
                        ? t(msg`保存中...`)
                        : t(msg`保存全局规则`)}
                    </Button>
                  </div>
                }
              />

              <div className="mt-4">
                <AdminTabs
                  tabs={[
                    { key: "strategy", label: t(msg`采集策略`) },
                    { key: "sources", label: t(msg`来源过滤`) },
                    { key: "prompts", label: t(msg`Prompt 模板`) },
                  ]}
                  activeKey={rulesTab}
                  onChange={(value) => setRulesTab(value as RulesTab)}
                />
              </div>

              {rulesTab === "strategy" ? (
                <div className="mt-5 space-y-4">
                  <AdminCallout
                    title={t(msg`默认 Provider 行为`)}
                    tone="info"
                    description={t(msg`当前默认 Provider 为 ${
                      PROVIDER_MODE_LABELS[rulesDraft.providerMode]
                        ? t(PROVIDER_MODE_LABELS[rulesDraft.providerMode])
                        : rulesDraft.providerMode
                    }。普通公众人物会先按这里采集；界闻角色仍固定优先走专用 RSS 聚合。`)}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminSelectField
                      label={t(msg`默认采集 Provider`)}
                      value={rulesDraft.providerMode}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                providerMode:
                                  value === "google_news_rss" ? value : "mock",
                              }
                            : current,
                        )
                      }
                      options={[
                        {
                          value: "google_news_rss",
                          label: t(PROVIDER_MODE_LABELS.google_news_rss),
                        },
                        {
                          value: "mock",
                          label: t(PROVIDER_MODE_LABELS.mock),
                        },
                      ]}
                    />
                    <AdminTextField
                      label={t(msg`默认语言区域`)}
                      value={rulesDraft.defaultLocale}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultLocale: value,
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`回溯小时`)}
                      value={rulesDraft.defaultRecencyHours}
                      type="number"
                      min={1}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultRecencyHours: parsePositiveNumber(
                                  value,
                                  current.defaultRecencyHours,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`每轮最多信号`)}
                      value={rulesDraft.defaultMaxSignalsPerRun}
                      type="number"
                      min={1}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultMaxSignalsPerRun: parsePositiveNumber(
                                  value,
                                  current.defaultMaxSignalsPerRun,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`最低可信阈值`)}
                      value={rulesDraft.defaultMinimumConfidence}
                      type="number"
                      min={0}
                      max={1}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultMinimumConfidence: parseConfidence(
                                  value,
                                  current.defaultMinimumConfidence,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`Google News 语言`)}
                      value={rulesDraft.googleNews.editionLanguage}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                googleNews: {
                                  ...current.googleNews,
                                  editionLanguage: value,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`Google News 地区`)}
                      value={rulesDraft.googleNews.editionRegion}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                googleNews: {
                                  ...current.googleNews,
                                  editionRegion: value,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`Google News CEID`)}
                      value={rulesDraft.googleNews.editionCeid}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                googleNews: {
                                  ...current.googleNews,
                                  editionCeid: value,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`Google News 拉取上限`)}
                      value={rulesDraft.googleNews.maxEntriesPerQuery}
                      type="number"
                      min={1}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                googleNews: {
                                  ...current.googleNews,
                                  maxEntriesPerQuery: parsePositiveNumber(
                                    value,
                                    current.googleNews.maxEntriesPerQuery,
                                  ),
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <AdminSelectField
                      label={t(msg`无结果时回退 Mock`)}
                      value={String(
                        rulesDraft.googleNews.fallbackToMockOnEmpty,
                      )}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                googleNews: {
                                  ...current.googleNews,
                                  fallbackToMockOnEmpty:
                                    parseBooleanSelect(value),
                                },
                              }
                            : current,
                        )
                      }
                      options={[
                        { value: "true", label: t(msg`开启回退`) },
                        { value: "false", label: t(msg`仅保留真实结果`) },
                      ]}
                    />
                  </div>
                </div>
              ) : null}

              {rulesTab === "sources" ? (
                <div className="mt-5 space-y-4">
                  <AdminCallout
                    title={t(msg`来源过滤建议`)}
                    tone="info"
                    description={t(msg`白名单用于保留可信媒体或官方源，黑名单用于提前拦截低质站点。多个来源使用逗号分隔。`)}
                  />
                  <div className="grid gap-4">
                    <AdminTextField
                      label={t(msg`默认白名单来源`)}
                      value={listToCsv(rulesDraft.defaultSourceAllowlist)}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultSourceAllowlist: csvToList(value),
                              }
                            : current,
                        )
                      }
                    />
                    <AdminTextField
                      label={t(msg`默认黑名单来源`)}
                      value={listToCsv(rulesDraft.defaultSourceBlocklist)}
                      onChange={(value) =>
                        setRulesDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultSourceBlocklist: csvToList(value),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              {rulesTab === "prompts" ? (
                <div className="mt-5 space-y-4">
                  <AdminCallout
                    title={t(msg`Prompt 调整原则`)}
                    tone="info"
                    description={t(msg`只有当同类问题跨角色重复出现时，再动这里的全局 Prompt；单角色异常优先回角色配置或具体抓取证据。`)}
                  />
                  <AdminTextArea
                    label={t(msg`信号归一化提示词`)}
                    value={rulesDraft.promptTemplates.signalNormalizationPrompt}
                    onChange={(value) =>
                      setRulesDraft((current) =>
                        current
                          ? {
                              ...current,
                              promptTemplates: {
                                ...current.promptTemplates,
                                signalNormalizationPrompt: value,
                              },
                            }
                          : current,
                      )
                    }
                  />
                  <AdminTextArea
                    label={t(msg`每日概况提示词`)}
                    value={rulesDraft.promptTemplates.dailyDigestPrompt}
                    onChange={(value) =>
                      setRulesDraft((current) =>
                        current
                          ? {
                              ...current,
                              promptTemplates: {
                                ...current.promptTemplates,
                                dailyDigestPrompt: value,
                              },
                            }
                          : current,
                      )
                    }
                  />
                  <AdminTextArea
                    label={t(msg`Scene Patch 提示词`)}
                    value={rulesDraft.promptTemplates.scenePatchPrompt}
                    onChange={(value) =>
                      setRulesDraft((current) =>
                        current
                          ? {
                              ...current,
                              promptTemplates: {
                                ...current.promptTemplates,
                                scenePatchPrompt: value,
                              },
                            }
                          : current,
                      )
                    }
                  />
                  <AdminTextArea
                    label={t(msg`现实发圈提示词`)}
                    value={rulesDraft.promptTemplates.realityMomentPrompt}
                    onChange={(value) =>
                      setRulesDraft((current) =>
                        current
                          ? {
                              ...current,
                              promptTemplates: {
                                ...current.promptTemplates,
                                realityMomentPrompt: value,
                              },
                            }
                          : current,
                      )
                    }
                  />
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[color:var(--border-faint)] pt-4">
                <Button
                  variant="ghost"
                  disabled={!isRulesDirty}
                  onClick={() => setRulesDraft(overview.rules)}
                >
                  {t(msg`重置草稿`)}
                </Button>
                <Button
                  variant="primary"
                  disabled={!isRulesDirty || saveRulesMutation.isPending}
                  onClick={() => saveRulesMutation.mutate(rulesDraft)}
                >
                  {saveRulesMutation.isPending ? t(msg`保存中...`) : t(msg`保存全局规则`)}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
