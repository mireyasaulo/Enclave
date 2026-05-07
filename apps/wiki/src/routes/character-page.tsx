import { useEffect, useMemo, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { Trans } from "@lingui/react/macro";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  AppSection,
  Button,
  Card,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  StatusPill,
  TagBadge,
  TextAreaField,
  TextField,
} from "@yinjie/ui";
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import {
  wikiApi,
  type WikiContentSnapshot,
  type WikiPageView,
  type WikiRevisionSummary,
} from "../lib/wiki-api";
import { SnapshotDiff } from "../components/snapshot-diff";
import { TalkPanel } from "../components/talk-panel";
import { WatchToggle } from "../components/watch-toggle";
import { ConflictResolver } from "../components/conflict-resolver";
import { RiskBadge } from "../components/risk-badge";
import { ScenePromptPreview } from "../components/scene-prompt-preview";
import { WikiApiError } from "../lib/wiki-api";
import { FormRow } from "../components/form-row";

type Tab = "read" | "edit" | "history" | "talk";

export function CharacterPage() {
  const t = translateRuntimeMessage;
  const { characterId } = useParams({ from: "/character/$characterId" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("read");
  const [viewMode, setViewMode] = useState<"stable" | "current">("stable");
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [showLifecycleForm, setShowLifecycleForm] = useState(false);
  const pageQ = useQuery({
    queryKey: ["wiki", "page", characterId, viewMode],
    queryFn: () => wikiApi.getPage(characterId, viewMode),
  });
  const viewerCanSeeCurrent = pageQ.data?.viewerCanSeeCurrent ?? false;
  useEffect(() => {
    if (!viewerCanSeeCurrent && viewMode === "current") setViewMode("stable");
  }, [viewerCanSeeCurrent, viewMode]);
  const softDeleteMut = useMutation({
    mutationFn: (reason: string) =>
      pageQ.data?.page.isDeleted ||
      pageQ.data?.page.lifecycleStatus === "deleted"
        ? wikiApi.requestRestorePage(characterId, reason)
        : wikiApi.requestDeletePage(characterId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wiki", "page", characterId] });
      void qc.invalidateQueries({ queryKey: ["wiki", "characters"] });
      void qc.invalidateQueries({ queryKey: ["wiki", "pending-reviews"] });
      setLifecycleReason("");
      setShowLifecycleForm(false);
    },
  });
  const lifecycleStatus = pageQ.data?.page.lifecycleStatus ?? "active";
  const isDeleted =
    pageQ.data?.page.isDeleted === true || lifecycleStatus === "deleted";
  const isPendingCreate = lifecycleStatus === "pending_create";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-1 shadow-[var(--shadow-soft)]">
          <TabButton active={tab === "read"} onClick={() => setTab("read")}>
            <Trans>阅读</Trans>
          </TabButton>
          <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
            <Trans>编辑</Trans>
          </TabButton>
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
          >
            <Trans>历史</Trans>
          </TabButton>
          <TabButton active={tab === "talk"} onClick={() => setTab("talk")}>
            <Trans>讨论</Trans>
          </TabButton>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <WatchToggle characterId={characterId} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pageQ.data && (
          <ProtectionInfo level={pageQ.data.page.protectionLevel} />
        )}
        {isDeleted && (
          <StatusPill>
            <Trans>已删除</Trans>
          </StatusPill>
        )}
        {isPendingCreate && (
          <StatusPill>
            <Trans>待创建</Trans>
          </StatusPill>
        )}
        {pageQ.data?.pendingRevision && (
          <StatusPill>
            <Trans>有待审版本</Trans>
          </StatusPill>
        )}
        {viewerCanSeeCurrent &&
          pageQ.data?.latestRevision?.id !==
            pageQ.data?.stableRevision?.id && (
            <div className="inline-flex overflow-hidden rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-xs shadow-[var(--shadow-soft)]">
              <button
                type="button"
                className={`px-3 py-1.5 ${
                  viewMode === "stable"
                    ? "bg-[image:var(--brand-gradient)] text-[color:var(--text-on-brand)]"
                    : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                }`}
                onClick={() => setViewMode("stable")}
              >
                <Trans>稳定版</Trans>
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 ${
                  viewMode === "current"
                    ? "bg-[image:var(--brand-gradient)] text-[color:var(--text-on-brand)]"
                    : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                }`}
                onClick={() => setViewMode("current")}
              >
                <Trans>最新版</Trans>
              </button>
            </div>
          )}
        {user && pageQ.data && (
          <Button
            size="sm"
            variant={isDeleted ? "primary" : "danger"}
            className="ml-auto"
            disabled={softDeleteMut.isPending}
            onClick={() => setShowLifecycleForm((value) => !value)}
          >
            {isDeleted ? t(msg`申请恢复`) : t(msg`申请删除`)}
          </Button>
        )}
      </div>

      {showLifecycleForm && (
        <Card className="p-4 space-y-3">
          <label className="block">
            <span className="text-sm mb-1 block">
              {isDeleted ? t(msg`恢复理由`) : t(msg`删除理由`)}
            </span>
            <TextAreaField
              rows={3}
              value={lifecycleReason}
              onChange={(event) => setLifecycleReason(event.target.value)}
              placeholder={
                isDeleted
                  ? t(msg`说明为什么这个角色词条应恢复`)
                  : t(msg`说明为什么这个角色词条应归档为红链`)
              }
            />
          </label>
          {softDeleteMut.isError && (
            <ErrorBlock message={(softDeleteMut.error as Error).message} />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={isDeleted ? "primary" : "danger"}
              disabled={
                softDeleteMut.isPending || lifecycleReason.trim().length === 0
              }
              onClick={() => softDeleteMut.mutate(lifecycleReason.trim())}
            >
              {softDeleteMut.isPending
                ? t(msg`提交中...`)
                : isDeleted
                  ? t(msg`提交恢复申请`)
                  : t(msg`提交删除申请`)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowLifecycleForm(false)}
            >
              <Trans>取消</Trans>
            </Button>
          </div>
        </Card>
      )}

      {isDeleted && (
        <InlineNotice tone="danger">
          <strong>
            <Trans>此词条已被软删除（红链）。</Trans>
          </strong>
          <Trans>
            恢复也按编辑审核流提交，底层角色数据保留以保持运行时引用一致。
          </Trans>
        </InlineNotice>
      )}

      {isPendingCreate && (
        <InlineNotice tone="warning">
          <Trans>
            此角色仍在待创建队列中。巡查员通过创建版本后，才会写入运行时角色注册表。
          </Trans>
        </InlineNotice>
      )}

      {pageQ.data?.drift?.hasDrift && hasRole(user, "patroller") && (
        <DriftBanner
          characterId={characterId}
          drift={pageQ.data.drift}
          onSynced={() =>
            qc.invalidateQueries({ queryKey: ["wiki", "page", characterId] })
          }
        />
      )}

      {pageQ.isLoading && <LoadingBlock />}
      {pageQ.isError && <ErrorBlock message={(pageQ.error as Error).message} />}
      {pageQ.data && tab === "read" && <ReadView view={pageQ.data} />}
      {pageQ.data && tab === "edit" && (
        <EditView
          characterId={characterId}
          view={pageQ.data}
          onSubmitted={() => {
            void pageQ.refetch();
            setTab("read");
          }}
        />
      )}
      {pageQ.data && tab === "history" && (
        <HistoryView
          characterId={characterId}
          currentRevisionId={pageQ.data.page.currentRevisionId}
          onChanged={() => void pageQ.refetch()}
        />
      )}
      {tab === "talk" && <TalkPanel characterId={characterId} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`min-w-[68px] rounded-full px-4 py-1.5 text-sm transition-colors ${
        active
          ? "bg-[image:var(--brand-gradient)] text-[color:var(--text-on-brand)] shadow-[var(--shadow-soft)]"
          : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card-hover)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function ProtectionInfo({ level }: { level: string }) {
  const t = translateRuntimeMessage;
  if (level === "none") return null;
  return (
    <StatusPill>
      {level === "semi" ? t(msg`半保护`) : t(msg`完全保护`)}
    </StatusPill>
  );
}

function ReadView({ view }: { view: WikiPageView }) {
  const t = translateRuntimeMessage;
  const c = view.content;
  const recipe = view.recipe;
  return (
    <Card className="p-6 space-y-4">
      <header className="flex items-start gap-4">
        {c.avatar && (
          <img
            src={c.avatar}
            alt={c.name}
            className="w-20 h-20 rounded-full object-cover bg-[color:var(--surface-soft)]"
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            {c.relationship} · {c.relationshipType}
          </div>
        </div>
      </header>
      <Section label={t(msg`简介`)}>{c.bio || "—"}</Section>
      {c.personality && (
        <Section label={t(msg`性格`)}>{c.personality}</Section>
      )}
      {c.expertDomains.length > 0 && (
        <Section label={t(msg`专长领域`)}>
          <div className="flex flex-wrap gap-2">
            {c.expertDomains.map((d) => (
              <TagBadge key={d}>{d}</TagBadge>
            ))}
          </div>
        </Section>
      )}
      {c.triggerScenes && c.triggerScenes.length > 0 && (
        <Section label={t(msg`触发场景`)}>
          <div className="flex flex-wrap gap-2">
            {c.triggerScenes.map((s) => (
              <TagBadge key={s}>{s}</TagBadge>
            ))}
          </div>
        </Section>
      )}
      {recipe && (
        <>
          <Section label={t(msg`核心逻辑`)}>
            {recipe.prompting.coreLogic || "—"}
          </Section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section label={t(msg`聊天 Prompt`)}>
              {recipe.prompting.scenePrompts.chat || "—"}
            </Section>
            <Section label={t(msg`主动触达 Prompt`)}>
              {recipe.prompting.scenePrompts.proactive || "—"}
            </Section>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Section label={t(msg`发圈频率`)}>
              {recipe.lifeStrategy.momentsFrequency}
            </Section>
            <Section label={t(msg`广场频率`)}>
              {recipe.lifeStrategy.feedFrequency}
            </Section>
            <Section label={t(msg`活跃时段`)}>
              {recipe.lifeStrategy.activeHoursStart ?? "—"}-
              {recipe.lifeStrategy.activeHoursEnd ?? "—"}
            </Section>
          </div>
        </>
      )}
      {view.pendingRevision && (
        <InlineNotice tone="info">
          <Trans>
            有 {view.pendingRevisions.length} 个待审版本，最新为：
          </Trans>
          <strong className="mx-1">v{view.pendingRevision.version}</strong>
          {view.pendingRevision.operation} / {view.pendingRevision.riskLevel}
        </InlineNotice>
      )}
      <footer className="text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
        {view.viewMode === "current" ? t(msg`最新版`) : t(msg`稳定版`)}：
        {view.currentRevision
          ? t(
              msg`v${view.currentRevision.version} · 由 ${view.currentRevision.editorUserId} 提交于 ${new Date(view.currentRevision.createdAt).toLocaleString()}`,
            )
          : t(msg`尚未有 wiki 版本（显示后台原始数据）`)}
        {view.stableRevision &&
          view.latestRevision &&
          view.stableRevision.id !== view.latestRevision.id &&
          ` · ${t(msg`稳定版 v${view.stableRevision.version} / 最新版 v${view.latestRevision.version}`)}`}
      </footer>
    </Card>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-1">
        {label}
      </h3>
      <div className="text-sm leading-7">{children}</div>
    </section>
  );
}

function EditView({
  characterId,
  view,
  onSubmitted,
}: {
  characterId: string;
  view: WikiPageView;
  onSubmitted: () => void;
}) {
  const t = translateRuntimeMessage;
  const { user } = useAuth();
  const initial = useMemo<WikiContentSnapshot>(
    () => ({
      ...view.content,
      personality: view.content.personality ?? "",
      triggerScenes: view.content.triggerScenes ?? [],
    }),
    [view.content],
  );
  const initialRecipe = useMemo(
    () => (view.recipe ? cloneRecipe(view.recipe) : null),
    [view.recipe],
  );
  const [draft, setDraft] = useState<WikiContentSnapshot>(initial);
  const [recipeDraft, setRecipeDraft] =
    useState<CharacterBlueprintRecipe | null>(initialRecipe);
  const [summary, setSummary] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    fields: string[];
    serverCurrent: WikiContentSnapshot;
    newBaseRevisionId: string;
  } | null>(null);
  // Track whether the user has touched the form. Without this, a background
  // refetch (e.g. after a sibling mutation invalidates the page query) wipes
  // their in-progress edits.
  const dirtyRef = useRef(false);
  const submitTimerRef = useRef<number | null>(null);
  // 保留上次见到的服务器值序列化，用于区分"react-query 给了新引用但内容相同"
  // 与"内容真的变了"两种情况，避免在前者下误弹"服务器有新版本"。
  const lastInitialSigRef = useRef<string>(JSON.stringify(initial));
  const lastInitialRecipeSigRef = useRef<string>(
    JSON.stringify(initialRecipe),
  );
  const [serverChangedWhileEditing, setServerChangedWhileEditing] =
    useState(false);

  useEffect(
    () => () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const sig = JSON.stringify(initial);
    const changed = sig !== lastInitialSigRef.current;
    lastInitialSigRef.current = sig;
    if (!dirtyRef.current) {
      setDraft(initial);
    } else if (changed) {
      setServerChangedWhileEditing(true);
    }
  }, [initial]);
  useEffect(() => {
    const sig = JSON.stringify(initialRecipe);
    const changed = sig !== lastInitialRecipeSigRef.current;
    lastInitialRecipeSigRef.current = sig;
    if (!dirtyRef.current) {
      setRecipeDraft(initialRecipe);
    } else if (changed) {
      setServerChangedWhileEditing(true);
    }
  }, [initialRecipe]);

  const setDraftDirty = (next: WikiContentSnapshot) => {
    dirtyRef.current = true;
    setDraft(next);
  };
  const setRecipeDraftDirty = (next: CharacterBlueprintRecipe) => {
    dirtyRef.current = true;
    setRecipeDraft(next);
  };

  function loadLatestFromServer() {
    setDraft(initial);
    setRecipeDraft(initialRecipe);
    lastInitialSigRef.current = JSON.stringify(initial);
    lastInitialRecipeSigRef.current = JSON.stringify(initialRecipe);
    dirtyRef.current = false;
    setServerChangedWhileEditing(false);
  }

  const submitMut = useMutation({
    mutationFn: (override?: {
      snapshot: WikiContentSnapshot;
      baseRevisionId: string;
    }) =>
      wikiApi.submitEdit(characterId, {
        contentSnapshot: override?.snapshot ?? draft,
        recipeSnapshot: recipeDraft
          ? mergeContentIntoRecipe(recipeDraft, override?.snapshot ?? draft)
          : undefined,
        baseRevisionId:
          override?.baseRevisionId ?? view.page.currentRevisionId,
        editSummary: summary,
        isMinor,
      }),
    onSuccess: (res) => {
      setError(null);
      setConflict(null);
      dirtyRef.current = false;
      setServerChangedWhileEditing(false);
      setInfo(
        res.appliedToCharacter
          ? t(msg`修改已直接生效（自动确认/巡查员/管理员）`)
          : t(msg`修改已提交，等待巡查员审核`),
      );
      const handle = window.setTimeout(onSubmitted, 800);
      submitTimerRef.current = handle;
    },
    onError: (err: Error) => {
      setInfo(null);
      if (err instanceof WikiApiError && err.status === 409) {
        const payload = err.payload as
          | {
              conflictingFields?: string[];
              currentSnapshot?: WikiContentSnapshot;
              currentRecipeSnapshot?: CharacterBlueprintRecipe;
              currentRevisionId?: string;
            }
          | null;
        if (payload?.currentRecipeSnapshot) {
          setError(
            t(msg`角色逻辑存在并发修改，请刷新页面后基于最新版本重新编辑。`),
          );
          return;
        }
        if (
          payload?.conflictingFields &&
          payload?.currentSnapshot &&
          payload?.currentRevisionId
        ) {
          setConflict({
            fields: payload.conflictingFields,
            serverCurrent: payload.currentSnapshot,
            newBaseRevisionId: payload.currentRevisionId,
          });
          setError(null);
          return;
        }
      }
      setError(err.message);
    },
  });

  if (!user) {
    return (
      <Card className="p-6">
        <p>
          <Trans>请先登录后再编辑。</Trans>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        <Trans>
          当前你的权限是<strong className="mx-1">{user.role}</strong>
          。内容字段和角色逻辑都走同一套版本、冲突检测和巡查审核。
        </Trans>
      </p>
      {view.pendingRevision && (
        <InlineNotice tone="warning">
          <Trans>
            ⚠ 当前已有待审版本 v{view.pendingRevision.version}，继续提交可能触发编辑冲突。
          </Trans>
        </InlineNotice>
      )}
      {serverChangedWhileEditing && (
        <InlineNotice tone="info">
          <Trans>
            服务器上的版本已经发生变化，但你正在编辑的草稿已保留。
          </Trans>{" "}
          <button
            type="button"
            className="ml-1 underline"
            onClick={loadLatestFromServer}
          >
            <Trans>加载最新覆盖草稿</Trans>
          </button>
        </InlineNotice>
      )}
      <FormRow label={t(msg`名称`)}>
        <TextField
          value={draft.name}
          onChange={(e) => setDraftDirty({ ...draft, name: e.target.value })}
        />
      </FormRow>
      <FormRow label={t(msg`头像 URL`)}>
        <TextField
          value={draft.avatar}
          onChange={(e) =>
            setDraftDirty({ ...draft, avatar: e.target.value })
          }
        />
      </FormRow>
      <FormRow label={t(msg`关系描述`)}>
        <TextField
          value={draft.relationship}
          onChange={(e) =>
            setDraftDirty({ ...draft, relationship: e.target.value })
          }
        />
      </FormRow>
      <FormRow label={t(msg`关系类型`)}>
        <TextField
          value={draft.relationshipType}
          onChange={(e) =>
            setDraftDirty({ ...draft, relationshipType: e.target.value })
          }
        />
      </FormRow>
      <FormRow label={t(msg`角色简介（bio）`)}>
        <TextAreaField
          rows={4}
          value={draft.bio}
          onChange={(e) => setDraftDirty({ ...draft, bio: e.target.value })}
        />
      </FormRow>
      <FormRow label={t(msg`性格 ⚠ 影响 AI 行为`)}>
        <TextAreaField
          rows={3}
          value={draft.personality ?? ""}
          onChange={(e) =>
            setDraftDirty({ ...draft, personality: e.target.value })
          }
        />
      </FormRow>
      <FormRow label={t(msg`专长领域（逗号分隔） ⚠ 影响 AI 行为`)}>
        <TextField
          value={draft.expertDomains.join(", ")}
          onChange={(e) =>
            setDraftDirty({
              ...draft,
              expertDomains: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </FormRow>
      <FormRow label={t(msg`触发场景（逗号分隔） ⚠ 影响 AI 行为`)}>
        <TextField
          value={(draft.triggerScenes ?? []).join(", ")}
          onChange={(e) =>
            setDraftDirty({
              ...draft,
              triggerScenes: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </FormRow>
      {recipeDraft && (
        <LogicEditor
          recipe={recipeDraft}
          onChange={(next) => setRecipeDraftDirty(next)}
          characterId={characterId}
          currentRole={user?.role}
          baselineRecipe={view.recipe}
        />
      )}
      <FormRow
        label={t(msg`修改摘要`)}
        hint={t(
          msg`高风险字段（人格/记忆/逻辑等）、创建词条、生命周期变更要求 ≥10 字`,
        )}
      >
        <TextField
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t(msg`例如：补充了职业信息`)}
          maxLength={500}
        />
        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
          {summary.trim().length}/500
        </div>
      </FormRow>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isMinor}
          onChange={(e) => setIsMinor(e.target.checked)}
        />
        <Trans>小修改（错别字、格式调整等）</Trans>
      </label>
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {info && <InlineNotice tone="success">{info}</InlineNotice>}
      {conflict && (
        <ConflictResolver
          base={initial}
          serverCurrent={conflict.serverCurrent}
          mine={draft}
          conflictingFields={conflict.fields}
          onResolve={(merged) => {
            setDraft(merged);
            submitMut.mutate({
              snapshot: merged,
              baseRevisionId: conflict.newBaseRevisionId,
            });
          }}
          onCancel={() => setConflict(null)}
        />
      )}
      {(() => {
        const personalityChanged =
          (draft.personality ?? "") !== (initial.personality ?? "");
        const recipeChanged = recipeDraft
          ? JSON.stringify(recipeDraft) !== JSON.stringify(initialRecipe)
          : false;
        const requiresLongSummary = personalityChanged || recipeChanged;
        const summaryTooShort =
          requiresLongSummary && summary.trim().length < 10;
        return (
          <div className="flex flex-col gap-2">
            {summaryTooShort && (
              <div className="text-xs text-[color:var(--state-warning-text)]">
                <Trans>
                  你修改了高风险字段（人格 / 角色逻辑），修改摘要至少 10 字。
                </Trans>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="primary"
                disabled={
                  submitMut.isPending || !!conflict || summaryTooShort
                }
                onClick={() => submitMut.mutate(undefined)}
              >
                {submitMut.isPending ? t(msg`提交中...`) : t(msg`提交编辑`)}
              </Button>
            </div>
          </div>
        );
      })()}
    </Card>
  );
}

function cloneRecipe(recipe: CharacterBlueprintRecipe): CharacterBlueprintRecipe {
  return JSON.parse(JSON.stringify(recipe)) as CharacterBlueprintRecipe;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function parseHour(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed), 0), 23);
}

export function mergeContentIntoRecipe(
  recipe: CharacterBlueprintRecipe,
  content: WikiContentSnapshot,
): CharacterBlueprintRecipe {
  return {
    ...recipe,
    identity: {
      ...recipe.identity,
      name: content.name,
      avatar: content.avatar,
      bio: content.bio,
      relationship: content.relationship,
      relationshipType: content.relationshipType,
    },
    expertise: {
      ...recipe.expertise,
      expertDomains: [...content.expertDomains],
    },
    tone: {
      ...recipe.tone,
      emotionalTone: content.personality ?? "",
    },
    lifeStrategy: {
      ...recipe.lifeStrategy,
      triggerScenes: [...(content.triggerScenes ?? [])],
    },
  };
}

export function LogicEditor({
  recipe,
  onChange,
  characterId,
  currentRole,
  baselineRecipe,
}: {
  recipe: CharacterBlueprintRecipe;
  onChange: (next: CharacterBlueprintRecipe) => void;
  characterId?: string;
  currentRole?: string;
  baselineRecipe?: CharacterBlueprintRecipe | null;
}) {
  const t = translateRuntimeMessage;
  const [realityLinkText, setRealityLinkText] = useState(() =>
    JSON.stringify(recipe.realityLink ?? null, null, 2),
  );
  const [realityLinkError, setRealityLinkError] = useState<string | null>(null);

  useEffect(() => {
    setRealityLinkText(JSON.stringify(recipe.realityLink ?? null, null, 2));
    setRealityLinkError(null);
  }, [recipe.realityLink]);

  return (
    <div className="space-y-4">
      <InlineNotice tone="warning">
        <Trans>
          ⚠ 以下字段会进入角色工厂发布流，属于影响运行时行为的高风险编辑。修改后请仔细核对。
        </Trans>
      </InlineNotice>
      <LogicSection
        title={t(msg`身份`)}
        description={t(msg`角色的基础信息：职业、背景、动机、世界观。`)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label={t(msg`职业 / 身份`)}>
            <TextField
              value={recipe.identity.occupation}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  identity: {
                    ...recipe.identity,
                    occupation: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`活动频率`)}>
            <TextField
              value={recipe.lifeStrategy.activityFrequency}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  lifeStrategy: {
                    ...recipe.lifeStrategy,
                    activityFrequency: event.target.value,
                  },
                })
              }
            />
          </FormRow>
        </div>
        <FormRow label={t(msg`背景`)}>
          <TextAreaField
            rows={3}
            value={recipe.identity.background}
            onChange={(event) =>
              onChange({
                ...recipe,
                identity: { ...recipe.identity, background: event.target.value },
              })
            }
          />
        </FormRow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label={t(msg`动机`)}>
            <TextAreaField
              rows={3}
              value={recipe.identity.motivation}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  identity: {
                    ...recipe.identity,
                    motivation: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`世界观`)}>
            <TextAreaField
              rows={3}
              value={recipe.identity.worldview}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  identity: {
                    ...recipe.identity,
                    worldview: event.target.value,
                  },
                })
              }
            />
          </FormRow>
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`专长`)}
        description={t(msg`角色的知识范围、知识边界、拒答风格。`)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormRow label={t(msg`专长说明`)}>
            <TextAreaField
              rows={4}
              value={recipe.expertise.expertiseDescription}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  expertise: {
                    ...recipe.expertise,
                    expertiseDescription: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`知识边界`)}>
            <TextAreaField
              rows={4}
              value={recipe.expertise.knowledgeLimits}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  expertise: {
                    ...recipe.expertise,
                    knowledgeLimits: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`拒答风格`)}>
            <TextAreaField
              rows={4}
              value={recipe.expertise.refusalStyle}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  expertise: {
                    ...recipe.expertise,
                    refusalStyle: event.target.value,
                  },
                })
              }
            />
          </FormRow>
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`语气与人设`)}
        description={t(
          msg`决定 AI 说话风格、表达密度，以及 base / system prompt 的核心字段。`,
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label={t(msg`说话模式（逗号分隔）`)}>
            <TextField
              value={recipe.tone.speechPatterns.join(", ")}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    speechPatterns: splitList(event.target.value),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`兴趣主题（逗号分隔）`)}>
            <TextField
              value={recipe.tone.topicsOfInterest.join(", ")}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    topicsOfInterest: splitList(event.target.value),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`回复长度`)}>
            <select
              className="w-full border rounded px-2 py-2 bg-white"
              value={recipe.tone.responseLength}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    responseLength: event.target
                      .value as CharacterBlueprintRecipe["tone"]["responseLength"],
                  },
                })
              }
            >
              <option value="short">{t(msg`短`)}</option>
              <option value="medium">{t(msg`中`)}</option>
              <option value="long">{t(msg`长`)}</option>
            </select>
          </FormRow>
          <FormRow label={t(msg`Emoji 使用`)}>
            <select
              className="w-full border rounded px-2 py-2 bg-white"
              value={recipe.tone.emojiUsage}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    emojiUsage: event.target
                      .value as CharacterBlueprintRecipe["tone"]["emojiUsage"],
                  },
                })
              }
            >
              <option value="none">{t(msg`不使用`)}</option>
              <option value="occasional">{t(msg`偶尔`)}</option>
              <option value="frequent">{t(msg`频繁`)}</option>
            </select>
          </FormRow>
          <FormRow label={t(msg`工作风格`)}>
            <TextAreaField
              rows={3}
              value={recipe.tone.workStyle}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: { ...recipe.tone, workStyle: event.target.value },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`社交风格`)}>
            <TextAreaField
              rows={3}
              value={recipe.tone.socialStyle}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: { ...recipe.tone, socialStyle: event.target.value },
                })
              }
            />
          </FormRow>
        </div>
        <FormRow label={t(msg`核心指令`)}>
          <TextAreaField
            rows={4}
            value={recipe.tone.coreDirective}
            onChange={(event) =>
              onChange({
                ...recipe,
                tone: { ...recipe.tone, coreDirective: event.target.value },
              })
            }
          />
        </FormRow>
        <FormRow label={t(msg`Base Prompt`)}>
          <TextAreaField
            rows={5}
            value={recipe.tone.basePrompt}
            onChange={(event) =>
              onChange({
                ...recipe,
                tone: { ...recipe.tone, basePrompt: event.target.value },
              })
            }
          />
        </FormRow>
        <FormRow label={t(msg`System Prompt`)}>
          <TextAreaField
            rows={5}
            value={recipe.tone.systemPrompt}
            onChange={(event) =>
              onChange({
                ...recipe,
                tone: { ...recipe.tone, systemPrompt: event.target.value },
              })
            }
          />
        </FormRow>
      </LogicSection>
      <LogicSection
        title={t(msg`提示词`)}
        description={t(msg`核心逻辑、各场景 prompt、ScenePrompt 预览。`)}
      >
        {characterId && (
          <ScenePromptPreview
            characterId={characterId}
            recipe={recipe}
            baselineRecipe={baselineRecipe ?? null}
          />
        )}
        <FormRow
          label={t(msg`核心逻辑`)}
          badge={
            characterId ? (
              <RiskBadge
                characterId={characterId}
                path="prompting.coreLogic"
                currentRole={currentRole}
              />
            ) : undefined
          }
        >
          <TextAreaField
            rows={5}
            value={recipe.prompting.coreLogic}
            onChange={(event) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  coreLogic: event.target.value,
                },
              })
            }
          />
        </FormRow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScenePromptField
            label={t(msg`聊天 Prompt`)}
            scene="chat"
            characterId={characterId}
            currentRole={currentRole}
            value={recipe.prompting.scenePrompts.chat}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    chat: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`问候 Prompt`)}
            scene="greeting"
            characterId={characterId}
            currentRole={currentRole}
            value={recipe.prompting.scenePrompts.greeting}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    greeting: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`主动触达 Prompt`)}
            scene="proactive"
            characterId={characterId}
            currentRole={currentRole}
            value={recipe.prompting.scenePrompts.proactive}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    proactive: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`朋友圈 Prompt`)}
            value={recipe.prompting.scenePrompts.moments_post}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    moments_post: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`朋友圈评论 Prompt`)}
            value={recipe.prompting.scenePrompts.moments_comment}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    moments_comment: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`广场发帖 Prompt`)}
            value={recipe.prompting.scenePrompts.feed_post}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    feed_post: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`视频号内容 Prompt`)}
            value={recipe.prompting.scenePrompts.channel_post}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    channel_post: value,
                  },
                },
              })
            }
          />
          <ScenePromptField
            label={t(msg`广场评论 Prompt`)}
            value={recipe.prompting.scenePrompts.feed_comment}
            onChange={(value) =>
              onChange({
                ...recipe,
                prompting: {
                  ...recipe.prompting,
                  scenePrompts: {
                    ...recipe.prompting.scenePrompts,
                    feed_comment: value,
                  },
                },
              })
            }
          />
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`记忆`)}
        description={t(msg`记忆摘要、核心记忆、近期摘要 prompt 与遗忘曲线。`)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label={t(msg`记忆摘要`)}>
            <TextAreaField
              rows={4}
              value={recipe.memorySeed.memorySummary}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  memorySeed: {
                    ...recipe.memorySeed,
                    memorySummary: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow
            label={t(msg`核心记忆`)}
            badge={
              characterId ? (
                <RiskBadge
                  characterId={characterId}
                  path="memorySeed.coreMemory"
                  currentRole={currentRole}
                />
              ) : undefined
            }
          >
            <TextAreaField
              rows={4}
              value={recipe.memorySeed.coreMemory}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  memorySeed: {
                    ...recipe.memorySeed,
                    coreMemory: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`近期摘要种子`)}>
            <TextAreaField
              rows={4}
              value={recipe.memorySeed.recentSummarySeed}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  memorySeed: {
                    ...recipe.memorySeed,
                    recentSummarySeed: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`遗忘曲线`)}>
            <TextField
              type="number"
              min={0}
              max={100}
              value={recipe.memorySeed.forgettingCurve}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  memorySeed: {
                    ...recipe.memorySeed,
                    forgettingCurve: Math.min(
                      Math.max(
                        parseNonNegativeInt(
                          event.target.value,
                          recipe.memorySeed.forgettingCurve,
                        ),
                        0,
                      ),
                      100,
                    ),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`近期摘要 Prompt`)}>
            <TextAreaField
              rows={4}
              value={recipe.memorySeed.recentSummaryPrompt}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  memorySeed: {
                    ...recipe.memorySeed,
                    recentSummaryPrompt: event.target.value,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`核心记忆 Prompt`)}>
            <TextAreaField
              rows={4}
              value={recipe.memorySeed.coreMemoryPrompt}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  memorySeed: {
                    ...recipe.memorySeed,
                    coreMemoryPrompt: event.target.value,
                  },
                })
              }
            />
          </FormRow>
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`生活策略与推理`)}
        description={t(
          msg`发圈/广场频率、活跃时段，以及 CoT / 反思 / 路由开关。`,
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormRow label={t(msg`发圈频率`)}>
            <TextField
              type="number"
              min={0}
              value={recipe.lifeStrategy.momentsFrequency}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  lifeStrategy: {
                    ...recipe.lifeStrategy,
                    momentsFrequency: parseNonNegativeInt(
                      event.target.value,
                      recipe.lifeStrategy.momentsFrequency,
                    ),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`广场频率`)}>
            <TextField
              type="number"
              min={0}
              value={recipe.lifeStrategy.feedFrequency}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  lifeStrategy: {
                    ...recipe.lifeStrategy,
                    feedFrequency: parseNonNegativeInt(
                      event.target.value,
                      recipe.lifeStrategy.feedFrequency,
                    ),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`活跃开始小时`)}>
            <TextField
              type="number"
              min={0}
              max={23}
              value={recipe.lifeStrategy.activeHoursStart ?? ""}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  lifeStrategy: {
                    ...recipe.lifeStrategy,
                    activeHoursStart: parseHour(event.target.value),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`活跃结束小时`)}>
            <TextField
              type="number"
              min={0}
              max={23}
              value={recipe.lifeStrategy.activeHoursEnd ?? ""}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  lifeStrategy: {
                    ...recipe.lifeStrategy,
                    activeHoursEnd: parseHour(event.target.value),
                  },
                })
              }
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recipe.reasoning.enableCoT}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  reasoning: {
                    ...recipe.reasoning,
                    enableCoT: event.target.checked,
                  },
                })
              }
            />
            <Trans>启用 CoT</Trans>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recipe.reasoning.enableReflection}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  reasoning: {
                    ...recipe.reasoning,
                    enableReflection: event.target.checked,
                  },
                })
              }
            />
            <Trans>启用反思</Trans>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recipe.reasoning.enableRouting}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  reasoning: {
                    ...recipe.reasoning,
                    enableRouting: event.target.checked,
                  },
                })
              }
            />
            <Trans>启用路由</Trans>
          </label>
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`个性细节`)}
        description={t(
          msg`口头禅、禁忌、小癖好——通常是低风险但能让角色更立体的字段。`,
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRow label={t(msg`口头禅（逗号分隔）`)}>
            <TextField
              value={recipe.tone.catchphrases.join(", ")}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    catchphrases: splitList(event.target.value),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`禁忌（逗号分隔）`)}>
            <TextField
              value={recipe.tone.taboos.join(", ")}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    taboos: splitList(event.target.value),
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`小癖好（逗号分隔）`)}>
            <TextField
              value={recipe.tone.quirks.join(", ")}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  tone: {
                    ...recipe.tone,
                    quirks: splitList(event.target.value),
                  },
                })
              }
            />
          </FormRow>
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`发布映射`)}
        description={t(
          msg`角色发布到运行时后的初始状态：模板、上线、活动模式默认值。`,
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recipe.publishMapping.isTemplate}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  publishMapping: {
                    ...recipe.publishMapping,
                    isTemplate: event.target.checked,
                  },
                })
              }
            />
            <Trans>模板角色</Trans>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recipe.publishMapping.initialOnline}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  publishMapping: {
                    ...recipe.publishMapping,
                    initialOnline: event.target.checked,
                  },
                })
              }
            />
            <Trans>初始在线</Trans>
          </label>
          <FormRow label={t(msg`初始活动`)}>
            <TextField
              value={recipe.publishMapping.initialActivity ?? ""}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  publishMapping: {
                    ...recipe.publishMapping,
                    initialActivity: event.target.value.trim() || null,
                  },
                })
              }
            />
          </FormRow>
          <FormRow label={t(msg`在线模式默认值`)}>
            <select
              className="w-full border rounded px-2 py-2 bg-white"
              value={recipe.publishMapping.onlineModeDefault}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  publishMapping: {
                    ...recipe.publishMapping,
                    onlineModeDefault: event.target
                      .value as CharacterBlueprintRecipe["publishMapping"]["onlineModeDefault"],
                  },
                })
              }
            >
              <option value="auto">{t(msg`自动`)}</option>
              <option value="manual">{t(msg`手动`)}</option>
            </select>
          </FormRow>
          <FormRow label={t(msg`活动模式默认值`)}>
            <select
              className="w-full border rounded px-2 py-2 bg-white"
              value={recipe.publishMapping.activityModeDefault}
              onChange={(event) =>
                onChange({
                  ...recipe,
                  publishMapping: {
                    ...recipe.publishMapping,
                    activityModeDefault: event.target
                      .value as CharacterBlueprintRecipe["publishMapping"]["activityModeDefault"],
                  },
                })
              }
            >
              <option value="auto">{t(msg`自动`)}</option>
              <option value="manual">{t(msg`手动`)}</option>
            </select>
          </FormRow>
        </div>
      </LogicSection>
      <LogicSection
        title={t(msg`现实联动`)}
        description={t(
          msg`可选 JSON：从外部数据源（社交账号、自媒体、API 等）读取动态信号注入提示词。`,
        )}
      >
        <FormRow
          label={t(msg`现实联动配置 JSON`)}
          badge={
            characterId ? (
              <RiskBadge
                characterId={characterId}
                path="realityLink"
                currentRole={currentRole}
              />
            ) : undefined
          }
        >
          <TextAreaField
            rows={8}
            value={realityLinkText}
            onChange={(event) => {
              const nextText = event.target.value;
              setRealityLinkText(nextText);
              try {
                const parsed = JSON.parse(nextText) as
                  | CharacterBlueprintRecipe["realityLink"]
                  | null;
                onChange({ ...recipe, realityLink: parsed });
                setRealityLinkError(null);
              } catch {
                setRealityLinkError(t(msg`JSON 格式无效，修正后才会写入草稿。`));
              }
            }}
          />
          {realityLinkError && (
            <div className="mt-1 text-xs text-[var(--state-danger-text)]">
              {realityLinkError}
            </div>
          )}
        </FormRow>
      </LogicSection>
    </div>
  );
}

function LogicSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <AppSection className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
      {children}
    </AppSection>
  );
}

function ScenePromptField({
  label,
  value,
  onChange,
  characterId,
  currentRole,
  scene,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  characterId?: string;
  currentRole?: string;
  scene?: string;
}) {
  return (
    <FormRow
      label={label}
      badge={
        characterId && scene ? (
          <RiskBadge
            characterId={characterId}
            path={`prompting.scenePrompts.${scene}`}
            currentRole={currentRole}
          />
        ) : undefined
      }
    >
      <TextAreaField
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormRow>
  );
}

function HistoryView({
  characterId,
  currentRevisionId,
  onChanged,
}: {
  characterId: string;
  currentRevisionId: string | null;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const historyQ = useQuery({
    queryKey: ["wiki", "history", characterId],
    queryFn: () => wikiApi.getHistory(characterId, 100),
  });

  const revertMut = useMutation({
    mutationFn: (input: { toRevisionId: string; reason: string }) =>
      wikiApi.revert(characterId, input.toRevisionId, input.reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wiki", "history", characterId] });
      void qc.invalidateQueries({ queryKey: ["wiki", "page", characterId] });
      onChanged();
    },
  });

  const revisions = historyQ.data ?? [];
  const previousById = useMemo(() => {
    const sorted = [...revisions].sort((a, b) => a.version - b.version);
    const map = new Map<string, WikiRevisionSummary | null>();
    let prev: WikiRevisionSummary | null = null;
    for (const r of sorted) {
      map.set(r.id, prev);
      if (r.status === "approved") prev = r;
    }
    return map;
  }, [revisions]);

  if (historyQ.isLoading) return <LoadingBlock />;
  if (historyQ.isError)
    return <ErrorBlock message={(historyQ.error as Error).message} />;

  const canRevert = hasRole(user, "patroller");
  return (
    <div className="space-y-3">
      {revisions.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-[var(--text-muted)]">
            <Trans>还没有任何编辑记录。</Trans>
          </p>
        </Card>
      )}
      {revisions.map((rev) => (
        <RevisionCard
          key={rev.id}
          rev={rev}
          previous={previousById.get(rev.id) ?? null}
          isCurrent={rev.id === currentRevisionId}
          canRevert={canRevert}
          onRevert={(reason) =>
            revertMut.mutate({ toRevisionId: rev.id, reason })
          }
          reverting={revertMut.isPending}
        />
      ))}
      {revertMut.isError && (
        <ErrorBlock message={(revertMut.error as Error).message} />
      )}
    </div>
  );
}

function RevisionCard({
  rev,
  previous,
  isCurrent,
  canRevert,
  onRevert,
  reverting,
}: {
  rev: WikiRevisionSummary;
  previous: WikiRevisionSummary | null;
  isCurrent: boolean;
  canRevert: boolean;
  onRevert: (reason: string) => void;
  reverting: boolean;
}) {
  const t = translateRuntimeMessage;
  const [showDiff, setShowDiff] = useState(false);
  const [showRevert, setShowRevert] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Card className="p-3 flex items-start gap-3 text-sm">
      <div className="w-12 font-mono text-[var(--text-muted)] pt-0.5">
        v{rev.version}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <strong>{rev.editorUserId}</strong>
          <span className="text-xs text-[var(--text-muted)]">
            {rev.editorRoleAtTime}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(rev.createdAt).toLocaleString()}
          </span>
          <StatusPill>{rev.status}</StatusPill>
          <StatusPill>{rev.operation}</StatusPill>
          {rev.revisionKind !== "content" && (
            <StatusPill>{rev.revisionKind}</StatusPill>
          )}
          {rev.riskLevel === "high" && (
            <StatusPill>
              <Trans>高风险</Trans>
            </StatusPill>
          )}
          {rev.changeSource !== "edit" && (
            <StatusPill>{rev.changeSource}</StatusPill>
          )}
          {isCurrent && (
            <StatusPill>
              <Trans>当前版本</Trans>
            </StatusPill>
          )}
          {!rev.isPatrolled && rev.status === "approved" && (
            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(254,243,199,0.6)] text-[#92400e]">
              <Trans>待巡查</Trans>
            </span>
          )}
        </div>
        {rev.editSummary && <div className="mt-1">{rev.editSummary}</div>}
        <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-3">
          {rev.diffFromParent?.changed && (
            <span>
              <Trans>字段：{rev.diffFromParent.changed.join(", ")}</Trans>
            </span>
          )}
          <button
            type="button"
            className="underline hover:text-[var(--text-primary)]"
            onClick={() => setShowDiff((v) => !v)}
          >
            {showDiff ? t(msg`收起对比`) : t(msg`查看对比`)}
          </button>
          {previous && (
            <Link
              to="/character/$characterId/diff"
              params={{ characterId: rev.characterId }}
              search={{ from: previous.id, to: rev.id }}
              className="underline hover:text-[var(--text-primary)]"
            >
              <Trans>独立对比</Trans>
            </Link>
          )}
          {canRevert && !isCurrent && rev.status === "approved" && (
            <button
              type="button"
              className="underline hover:text-[var(--text-primary)]"
              onClick={() => setShowRevert((v) => !v)}
            >
              <Trans>回滚到此版本</Trans>
            </button>
          )}
        </div>
        {showDiff && (
          <div className="mt-3 rounded border border-[var(--border-subtle)] p-3">
            <SnapshotDiff
              before={previous?.contentSnapshot ?? null}
              after={rev.contentSnapshot}
              changedFields={rev.diffFromParent?.changed}
            />
            {rev.recipeSnapshot && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-[var(--text-muted)]">
                  <Trans>查看角色逻辑快照</Trans>
                </summary>
                <pre className="mt-2 p-3 bg-[var(--bg-canvas)] rounded overflow-auto max-h-[60vh]">
                  {JSON.stringify(rev.recipeSnapshot, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
        {showRevert && (
          <div className="mt-3 rounded border border-[var(--border-subtle)] p-3 space-y-2">
            <label className="block text-sm">
              <span className="block mb-1">
                <Trans>回滚原因（必填）</Trans>
              </span>
              <TextField
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(msg`例如：v3 涉及破坏性内容`)}
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={reverting || reason.trim().length === 0}
                onClick={() => {
                  onRevert(reason.trim());
                  setShowRevert(false);
                  setReason("");
                }}
              >
                {reverting ? t(msg`回滚中...`) : t(msg`确认回滚`)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevert(false)}
              >
                <Trans>取消</Trans>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function DriftBanner({
  characterId,
  drift,
  onSynced,
}: {
  characterId: string;
  drift: {
    hasDrift: boolean;
    contentDrift: string[];
    recipeDrift: string[];
    source: string;
  };
  onSynced: () => void;
}) {
  const t = translateRuntimeMessage;
  const syncMut = useMutation({
    mutationFn: () => wikiApi.syncPageFromCharacter(characterId),
    onSuccess: () => onSynced(),
  });
  const totalDrift = drift.contentDrift.length + drift.recipeDrift.length;
  return (
    <Card className="border-[color:var(--state-warning-bg)] bg-[rgba(255,247,205,0.6)] p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 text-sm">
          <strong>
            <Trans>⚠ 角色已被管理员后台直接修改</Trans>
          </strong>
          <p className="mt-1 text-[var(--text-muted)]">
            <Trans>
              wiki 当前版本与运行时实际角色数据存在 {totalDrift} 处差异
              （source: {drift.source}）。点击右侧按钮可把当前实际值作为新版本写入 wiki 历史。
            </Trans>
          </p>
          {drift.contentDrift.length > 0 && (
            <p className="mt-1 text-xs">
              <Trans>内容字段：</Trans>
              <span className="font-mono">{drift.contentDrift.join(", ")}</span>
            </p>
          )}
          {drift.recipeDrift.length > 0 && (
            <p className="mt-1 text-xs">
              <Trans>逻辑字段：</Trans>
              <span className="font-mono">
                {drift.recipeDrift.slice(0, 8).join(", ")}
                {drift.recipeDrift.length > 8
                  ? ` ${t(msg`… (+${drift.recipeDrift.length - 8})`)}`
                  : ""}
              </span>
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="primary"
          disabled={syncMut.isPending}
          onClick={() => syncMut.mutate()}
        >
          {syncMut.isPending ? t(msg`同步中...`) : t(msg`纳入 wiki 历史`)}
        </Button>
      </div>
      {syncMut.isError && (
        <p className="mt-2 text-xs text-[var(--state-danger-text)]">
          {(syncMut.error as Error).message}
        </p>
      )}
    </Card>
  );
}
