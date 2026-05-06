import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";
import {
  Button,
  Card,
  ErrorBlock,
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
import { WikiApiError } from "../lib/wiki-api";

type Tab = "read" | "edit" | "history" | "talk";

export function CharacterPage() {
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
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-2">
        <TabButton active={tab === "read"} onClick={() => setTab("read")}>
          阅读
        </TabButton>
        <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
          编辑
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          历史
        </TabButton>
        <TabButton active={tab === "talk"} onClick={() => setTab("talk")}>
          讨论
        </TabButton>
        <div className="ml-auto flex items-center gap-2">
          {pageQ.data && (
            <ProtectionInfo level={pageQ.data.page.protectionLevel} />
          )}
          {isDeleted && <StatusPill>已删除</StatusPill>}
          {isPendingCreate && <StatusPill>待创建</StatusPill>}
          {pageQ.data?.pendingRevision && <StatusPill>有待审版本</StatusPill>}
          {viewerCanSeeCurrent && pageQ.data?.latestRevision?.id !== pageQ.data?.stableRevision?.id && (
            <div className="flex items-center border border-[var(--border-subtle)] rounded overflow-hidden text-xs">
              <button
                type="button"
                className={`px-2 py-1 ${
                  viewMode === "stable"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white text-[var(--text-muted)]"
                }`}
                onClick={() => setViewMode("stable")}
              >
                稳定版
              </button>
              <button
                type="button"
                className={`px-2 py-1 ${
                  viewMode === "current"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white text-[var(--text-muted)]"
                }`}
                onClick={() => setViewMode("current")}
              >
                最新版
              </button>
            </div>
          )}
          <WatchToggle characterId={characterId} />
          {user && pageQ.data && (
            <Button
              size="sm"
              variant={isDeleted ? "primary" : "danger"}
              disabled={softDeleteMut.isPending}
              onClick={() => setShowLifecycleForm((value) => !value)}
            >
              {isDeleted ? "申请恢复" : "申请删除"}
            </Button>
          )}
        </div>
      </div>

      {showLifecycleForm && (
        <Card className="p-4 space-y-3">
          <label className="block">
            <span className="text-sm mb-1 block">
              {isDeleted ? "恢复理由" : "删除理由"}
            </span>
            <TextAreaField
              rows={3}
              value={lifecycleReason}
              onChange={(event) => setLifecycleReason(event.target.value)}
              placeholder={
                isDeleted
                  ? "说明为什么这个角色词条应恢复"
                  : "说明为什么这个角色词条应归档为红链"
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
                ? "提交中..."
                : isDeleted
                  ? "提交恢复申请"
                  : "提交删除申请"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowLifecycleForm(false)}
            >
              取消
            </Button>
          </div>
        </Card>
      )}

      {isDeleted && (
        <Card className="p-4 border-[var(--border-danger)] bg-[rgba(255,245,245,0.7)]">
          <div className="text-sm">
            <strong className="text-[var(--state-danger-text)]">
              此词条已被软删除（红链）
            </strong>
            。恢复也按编辑审核流提交，底层角色数据保留以保持运行时引用一致。
          </div>
        </Card>
      )}

      {isPendingCreate && (
        <Card className="p-4 border-[var(--border-subtle)] bg-[rgba(255,251,235,0.7)]">
          <div className="text-sm">
            此角色仍在待创建队列中。巡查员通过创建版本后，才会写入运行时角色注册表。
          </div>
        </Card>
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
      className={`px-3 py-2 text-sm rounded-t border-b-2 ${
        active
          ? "border-[var(--brand-primary)] text-[var(--text-primary)] font-medium"
          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function ProtectionInfo({ level }: { level: string }) {
  if (level === "none") return null;
  return (
    <StatusPill className="ml-auto">
      {level === "semi" ? "半保护" : "完全保护"}
    </StatusPill>
  );
}

function ReadView({ view }: { view: WikiPageView }) {
  const c = view.content;
  const recipe = view.recipe;
  return (
    <Card className="p-6 space-y-4">
      <header className="flex items-start gap-4">
        {c.avatar && (
          <img
            src={c.avatar}
            alt={c.name}
            className="w-20 h-20 rounded-full object-cover bg-gray-100"
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            {c.relationship} · {c.relationshipType}
          </div>
        </div>
      </header>
      <Section label="简介">{c.bio || "—"}</Section>
      {c.personality && <Section label="性格">{c.personality}</Section>}
      {c.expertDomains.length > 0 && (
        <Section label="专长领域">
          <div className="flex flex-wrap gap-2">
            {c.expertDomains.map((d) => (
              <TagBadge key={d}>{d}</TagBadge>
            ))}
          </div>
        </Section>
      )}
      {c.triggerScenes && c.triggerScenes.length > 0 && (
        <Section label="触发场景">
          <div className="flex flex-wrap gap-2">
            {c.triggerScenes.map((s) => (
              <TagBadge key={s}>{s}</TagBadge>
            ))}
          </div>
        </Section>
      )}
      {recipe && (
        <>
          <Section label="核心逻辑">
            {recipe.prompting.coreLogic || "—"}
          </Section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section label="聊天 Prompt">
              {recipe.prompting.scenePrompts.chat || "—"}
            </Section>
            <Section label="主动触达 Prompt">
              {recipe.prompting.scenePrompts.proactive || "—"}
            </Section>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Section label="发圈频率">
              {recipe.lifeStrategy.momentsFrequency}
            </Section>
            <Section label="广场频率">
              {recipe.lifeStrategy.feedFrequency}
            </Section>
            <Section label="活跃时段">
              {recipe.lifeStrategy.activeHoursStart ?? "—"}-
              {recipe.lifeStrategy.activeHoursEnd ?? "—"}
            </Section>
          </div>
        </>
      )}
      {view.pendingRevision && (
        <div className="text-sm rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
          有 {view.pendingRevisions.length} 个待审版本，最新为：
          <strong className="mx-1">v{view.pendingRevision.version}</strong>
          {view.pendingRevision.operation} / {view.pendingRevision.riskLevel}
        </div>
      )}
      <footer className="text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
        {view.viewMode === "current" ? "最新版" : "稳定版"}：
        {view.currentRevision
          ? `v${view.currentRevision.version} · 由 ${view.currentRevision.editorUserId} 提交于 ${new Date(view.currentRevision.createdAt).toLocaleString()}`
          : "尚未有 wiki 版本（显示后台原始数据）"}
        {view.stableRevision &&
          view.latestRevision &&
          view.stableRevision.id !== view.latestRevision.id &&
          ` · 稳定版 v${view.stableRevision.version} / 最新版 v${view.latestRevision.version}`}
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

  useEffect(() => setDraft(initial), [initial]);
  useEffect(() => setRecipeDraft(initialRecipe), [initialRecipe]);

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
      setInfo(
        res.appliedToCharacter
          ? "修改已直接生效（自动确认/巡查员/管理员）"
          : "修改已提交，等待巡查员审核",
      );
      setTimeout(onSubmitted, 800);
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
          setError("角色逻辑存在并发修改，请刷新页面后基于最新版本重新编辑。");
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
        <p>请先登录后再编辑。</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        当前你的权限是<strong className="mx-1">{user.role}</strong>
        。内容字段和角色逻辑都走同一套版本、冲突检测和巡查审核。
      </p>
      {view.pendingRevision && (
        <div className="text-sm rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3">
          当前已有待审版本 v{view.pendingRevision.version}，继续提交可能触发编辑冲突。
        </div>
      )}
      <FormRow label="名称">
        <TextField
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </FormRow>
      <FormRow label="头像 URL">
        <TextField
          value={draft.avatar}
          onChange={(e) => setDraft({ ...draft, avatar: e.target.value })}
        />
      </FormRow>
      <FormRow label="关系描述">
        <TextField
          value={draft.relationship}
          onChange={(e) =>
            setDraft({ ...draft, relationship: e.target.value })
          }
        />
      </FormRow>
      <FormRow label="关系类型">
        <TextField
          value={draft.relationshipType}
          onChange={(e) =>
            setDraft({ ...draft, relationshipType: e.target.value })
          }
        />
      </FormRow>
      <FormRow label="角色简介（bio）">
        <TextAreaField
          rows={4}
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
        />
      </FormRow>
      <FormRow label="性格 ⚠ 影响 AI 行为">
        <TextAreaField
          rows={3}
          value={draft.personality ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, personality: e.target.value })
          }
        />
      </FormRow>
      <FormRow label="专长领域（逗号分隔） ⚠ 影响 AI 行为">
        <TextField
          value={draft.expertDomains.join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              expertDomains: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </FormRow>
      <FormRow label="触发场景（逗号分隔） ⚠ 影响 AI 行为">
        <TextField
          value={(draft.triggerScenes ?? []).join(", ")}
          onChange={(e) =>
            setDraft({
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
          onChange={(next) => setRecipeDraft(next)}
        />
      )}
      <FormRow
        label="修改摘要"
        hint="高风险字段（人格/记忆/逻辑等）、创建词条、生命周期变更要求 ≥10 字"
      >
        <TextField
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="例如：补充了职业信息"
          maxLength={500}
        />
      </FormRow>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isMinor}
          onChange={(e) => setIsMinor(e.target.checked)}
        />
        小修改（错别字、格式调整等）
      </label>
      {error && <ErrorBlock message={error} />}
      {info && (
        <div className="text-sm text-[var(--state-success-text,#0a7d4f)]">
          {info}
        </div>
      )}
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
      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={submitMut.isPending || !!conflict}
          onClick={() => submitMut.mutate(undefined)}
        >
          {submitMut.isPending ? "提交中..." : "提交编辑"}
        </Button>
      </div>
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
}: {
  recipe: CharacterBlueprintRecipe;
  onChange: (next: CharacterBlueprintRecipe) => void;
}) {
  const [realityLinkText, setRealityLinkText] = useState(() =>
    JSON.stringify(recipe.realityLink ?? null, null, 2),
  );
  const [realityLinkError, setRealityLinkError] = useState<string | null>(null);

  useEffect(() => {
    setRealityLinkText(JSON.stringify(recipe.realityLink ?? null, null, 2));
    setRealityLinkError(null);
  }, [recipe.realityLink]);

  return (
    <div className="rounded border border-[var(--border-subtle)] p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold">角色信息与逻辑</h3>
        <p className="text-sm text-[var(--text-muted)]">
          这些字段会进入角色工厂发布流，属于影响运行时行为的高风险编辑。
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormRow label="职业 / 身份">
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
        <FormRow label="活动频率">
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
      <FormRow label="背景">
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
        <FormRow label="动机">
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
        <FormRow label="世界观">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormRow label="专长说明">
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
        <FormRow label="知识边界">
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
        <FormRow label="拒答风格">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormRow label="说话模式（逗号分隔）">
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
        <FormRow label="兴趣主题（逗号分隔）">
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
        <FormRow label="回复长度">
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
            <option value="short">短</option>
            <option value="medium">中</option>
            <option value="long">长</option>
          </select>
        </FormRow>
        <FormRow label="Emoji 使用">
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
            <option value="none">不使用</option>
            <option value="occasional">偶尔</option>
            <option value="frequent">频繁</option>
          </select>
        </FormRow>
        <FormRow label="工作风格">
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
        <FormRow label="社交风格">
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
      <FormRow label="核心指令">
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
      <FormRow label="Base Prompt">
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
      <FormRow label="System Prompt">
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
      <FormRow label="核心逻辑">
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
          label="聊天 Prompt"
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
          label="问候 Prompt"
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
          label="主动触达 Prompt"
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
          label="朋友圈 Prompt"
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
          label="朋友圈评论 Prompt"
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
          label="广场发帖 Prompt"
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
          label="视频号内容 Prompt"
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
          label="广场评论 Prompt"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormRow label="记忆摘要">
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
        <FormRow label="核心记忆">
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
        <FormRow label="近期摘要种子">
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
        <FormRow label="遗忘曲线">
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
        <FormRow label="近期摘要 Prompt">
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
        <FormRow label="核心记忆 Prompt">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormRow label="发圈频率">
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
        <FormRow label="广场频率">
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
        <FormRow label="活跃开始小时">
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
        <FormRow label="活跃结束小时">
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
          启用 CoT
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
          启用反思
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
          启用路由
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormRow label="口头禅（逗号分隔）">
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
        <FormRow label="禁忌（逗号分隔）">
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
        <FormRow label="小癖好（逗号分隔）">
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
      <div className="rounded border border-[var(--border-subtle)] p-3 space-y-3">
        <h4 className="text-sm font-medium">发布映射</h4>
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
            模板角色
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
            初始在线
          </label>
          <FormRow label="初始活动">
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
          <FormRow label="在线模式默认值">
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
              <option value="auto">自动</option>
              <option value="manual">手动</option>
            </select>
          </FormRow>
          <FormRow label="活动模式默认值">
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
              <option value="auto">自动</option>
              <option value="manual">手动</option>
            </select>
          </FormRow>
        </div>
      </div>
      <FormRow label="现实联动配置 JSON">
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
              setRealityLinkError("JSON 格式无效，修正后才会写入草稿。");
            }
          }}
        />
        {realityLinkError && (
          <div className="mt-1 text-xs text-[var(--state-danger-text)]">
            {realityLinkError}
          </div>
        )}
      </FormRow>
    </div>
  );
}

function ScenePromptField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormRow label={label}>
      <TextAreaField
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormRow>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm mb-1 block">
        {label}
        {hint && (
          <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
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
            还没有任何编辑记录。
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
          {rev.riskLevel === "high" && <StatusPill>高风险</StatusPill>}
          {rev.changeSource !== "edit" && (
            <StatusPill>{rev.changeSource}</StatusPill>
          )}
          {isCurrent && <StatusPill>当前版本</StatusPill>}
          {!rev.isPatrolled && rev.status === "approved" && (
            <span className="text-xs px-2 py-0.5 rounded bg-[rgba(254,243,199,0.6)] text-[#92400e]">
              待巡查
            </span>
          )}
        </div>
        {rev.editSummary && <div className="mt-1">{rev.editSummary}</div>}
        <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-3">
          {rev.diffFromParent?.changed && (
            <span>字段：{rev.diffFromParent.changed.join(", ")}</span>
          )}
          <button
            type="button"
            className="underline hover:text-[var(--text-primary)]"
            onClick={() => setShowDiff((v) => !v)}
          >
            {showDiff ? "收起对比" : "查看对比"}
          </button>
          {previous && (
            <Link
              to="/character/$characterId/diff"
              params={{ characterId: rev.characterId }}
              search={{ from: previous.id, to: rev.id }}
              className="underline hover:text-[var(--text-primary)]"
            >
              独立对比
            </Link>
          )}
          {canRevert && !isCurrent && rev.status === "approved" && (
            <button
              type="button"
              className="underline hover:text-[var(--text-primary)]"
              onClick={() => setShowRevert((v) => !v)}
            >
              回滚到此版本
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
                  查看角色逻辑快照
                </summary>
                <pre className="mt-2 p-3 bg-[var(--bg-canvas)] rounded overflow-x-auto">
                  {JSON.stringify(rev.recipeSnapshot, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
        {showRevert && (
          <div className="mt-3 rounded border border-[var(--border-subtle)] p-3 space-y-2">
            <label className="block text-sm">
              <span className="block mb-1">回滚原因（必填）</span>
              <TextField
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例如：v3 涉及破坏性内容"
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
                {reverting ? "回滚中..." : "确认回滚"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevert(false)}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
