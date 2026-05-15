import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { clearSession, getToken } from "./auth-store";
import type { CharacterBlueprintRecipe } from "@yinjie/contracts";

const API_BASE = "/api";

export class WikiApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      // 不在登录/注册流程上的页面，直接跳登录页避免假死。
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register")
      ) {
        const redirect = window.location.pathname + window.location.search;
        window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
      }
    }
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? translateRuntimeMessage(msg`请求失败 (${res.status})`);
    throw new WikiApiError(res.status, payload, message);
  }
  return payload as T;
}

export type AuthSession = {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    userType: string;
    avatar?: string;
  };
};

export type AuthProfile = {
  id: string;
  username: string;
  role: string;
  userType: string;
  avatar?: string;
  email: string | null;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
};

export type WikiContentSnapshot = {
  name: string;
  avatar: string;
  bio: string;
  personality?: string;
  expertDomains: string[];
  triggerScenes?: string[];
  relationship: string;
  relationshipType: string;
};

export type WikiPageView = {
  characterId: string;
  page: {
    characterId: string;
    title?: string | null;
    currentRevisionId: string | null;
    latestRevisionId: string | null;
    lifecycleStatus: string;
    reviewPolicy: string;
    protectionLevel: string;
    protectionExpiresAt: string | null;
    protectionReason: string | null;
    isPatrolled: boolean;
    watcherCount: number;
    editCount: number;
    isDeleted: boolean;
  };
  currentRevision: WikiRevisionSummary | null;
  stableRevision: WikiRevisionSummary | null;
  latestRevision: WikiRevisionSummary | null;
  content: WikiContentSnapshot;
  visibleContent: WikiContentSnapshot;
  recipe: CharacterBlueprintRecipe | null;
  pendingRevision: WikiRevisionSummary | null;
  pendingRevisions: WikiRevisionSummary[];
  viewMode: "stable" | "current";
  viewerCanSeeCurrent: boolean;
  drift: {
    hasDrift: boolean;
    contentDrift: string[];
    recipeDrift: string[];
    source: "admin_override" | "unknown" | "none";
  };
  exists: boolean;
};

export type WikiRevisionSummary = {
  id: string;
  characterId: string;
  version: number;
  parentRevisionId: string | null;
  baseRevisionId: string | null;
  contentSnapshot: WikiContentSnapshot;
  recipeSnapshot?: CharacterBlueprintRecipe | null;
  diffFromParent: { changed?: string[] } | null;
  editorUserId: string;
  editorRoleAtTime: string;
  editSummary: string;
  status: string;
  revisionKind: string;
  operation: string;
  riskLevel: string;
  changeSource: string;
  isMinor: boolean;
  isPatrolled: boolean;
  patrolledBy: string | null;
  patrolledAt: string | null;
  createdAt: string;
};

export type EditSubmission = {
  id: string;
  revisionId: string;
  characterId: string;
  submitterId: string;
  operation: string;
  riskLevel: string;
  decision: string | null;
  reviewerId: string | null;
  decidedAt: string | null;
  reviewerNote: string | null;
  priority: number;
  createdAt: string;
};

export type PendingReviewItem = {
  submission: EditSubmission;
  revision: WikiRevisionSummary;
};

export type WikiUserRow = {
  id: string;
  username: string;
  role: string;
  userType: string;
  createdAt: string;
  roleGrantedAt: string | null;
  profile: {
    editCount: number;
    approvedEditCount: number;
    revertedCount: number;
    patrolledCount: number;
    lastEditAt: string | null;
    autoconfirmedAt: string | null;
  } | null;
};

export type WikiBlockRow = {
  id: string;
  userId: string;
  scope: string;
  targetCharacterId: string | null;
  reason: string;
  createdBy: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdAt: string;
};

export type WikiProtectionLogRow = {
  id: string;
  characterId: string;
  oldLevel: string;
  newLevel: string;
  changedBy: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type WikiTalkThread = {
  id: string;
  characterId: string;
  title: string;
  authorId: string;
  isLocked: boolean;
  isResolved: boolean;
  postCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WikiTalkPost = {
  id: string;
  threadId: string;
  parentPostId: string | null;
  authorId: string;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
};

export type WatchlistEntry = {
  characterId: string;
  notifyOnEdit: boolean;
  notifyOnTalk: boolean;
  addedAt: string;
  isDeleted: boolean;
  currentRevisionId: string | null;
  protectionLevel: string;
};

export type WatchlistFeedItem =
  | { kind: "revision"; characterId: string; revision: WikiRevisionSummary }
  | { kind: "talk"; characterId: string; thread: WikiTalkThread };

export type ModerationReport = {
  id: string;
  ownerId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
};

export type CharacterListItem = {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  relationship: string;
  relationshipType: string;
  sourceType: string;
  lifecycleStatus: string;
  protectionLevel: string;
};

export const wikiApi = {
  register(username: string, password: string) {
    return request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      auth: false,
    });
  },
  login(username: string, password: string) {
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      auth: false,
    });
  },
  sendEmailCode(email: string) {
    return request<{
      email: string;
      expiresAt: string;
      debugCode?: string | null;
    }>("/auth/email/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    });
  },
  verifyEmailCode(email: string, code: string) {
    return request<AuthSession>("/auth/email/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
      auth: false,
    });
  },
  me() {
    return request<AuthProfile>("/auth/me");
  },
  sendChangePasswordCode() {
    return request<{
      email: string;
      expiresAt: string;
      debugCode?: string | null;
    }>("/auth/password/send-code", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  changePassword(code: string, newPassword: string) {
    return request<{ ok: true }>("/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ code, newPassword }),
    });
  },
  listCharacters() {
    return request<CharacterListItem[]>("/wiki/pages", { auth: false });
  },
  createPage(payload: {
    characterId?: string | null;
    contentSnapshot?: WikiContentSnapshot;
    recipeSnapshot?: CharacterBlueprintRecipe | null;
    editSummary?: string | null;
  }) {
    return request<{
      characterId: string;
      revisionId: string;
      status: string;
      isPatrolled: boolean;
      appliedToCharacter: boolean;
    }>("/wiki/pages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getPage(characterId: string, view?: "stable" | "current") {
    const qs = view ? `?view=${encodeURIComponent(view)}` : "";
    return request<WikiPageView>(
      `/wiki/pages/${encodeURIComponent(characterId)}${qs}`,
    );
  },
  getHistory(characterId: string, limit = 50) {
    return request<WikiRevisionSummary[]>(
      `/wiki/pages/${encodeURIComponent(characterId)}/history?limit=${limit}`,
      { auth: false },
    );
  },
  getDiff(characterId: string, fromRevisionId: string, toRevisionId: string) {
    const params = new URLSearchParams({
      from: fromRevisionId,
      to: toRevisionId,
    });
    return request<{
      from: WikiRevisionSummary;
      to: WikiRevisionSummary;
    }>(`/wiki/pages/${encodeURIComponent(characterId)}/diff?${params.toString()}`, {
      auth: false,
    });
  },
  submitEdit(
    characterId: string,
    payload: {
      contentSnapshot: WikiContentSnapshot;
      recipeSnapshot?: CharacterBlueprintRecipe | null;
      baseRevisionId?: string | null;
      editSummary?: string;
      isMinor?: boolean;
    },
  ) {
    return request<{
      revisionId: string;
      status: string;
      isPatrolled: boolean;
      appliedToCharacter: boolean;
    }>(`/wiki/pages/${encodeURIComponent(characterId)}/edits`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listPending(
    opts:
      | number
      | {
          limit?: number;
          operation?: string;
          riskLevel?: string;
          revisionKind?: string;
        } = 50,
  ) {
    const input = typeof opts === "number" ? { limit: opts } : opts;
    const params = new URLSearchParams();
    if (input.limit) params.set("limit", String(input.limit));
    if (input.operation) params.set("operation", input.operation);
    if (input.riskLevel) params.set("riskLevel", input.riskLevel);
    if (input.revisionKind) params.set("revisionKind", input.revisionKind);
    return request<PendingReviewItem[]>(
      `/wiki/pending-reviews?${params.toString()}`,
    );
  },
  decide(
    revisionId: string,
    decision: "approve" | "reject" | "request_changes",
    note?: string,
  ) {
    return request<{ status: string; pageId: string }>(
      `/wiki/edits/${encodeURIComponent(revisionId)}/review`,
      {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      },
    );
  },
  patrol(revisionId: string) {
    return request<{ revisionId: string; isPatrolled: true }>(
      `/wiki/edits/${encodeURIComponent(revisionId)}/patrol`,
      { method: "POST" },
    );
  },
  revert(characterId: string, toRevisionId: string, reason: string) {
    return request<{ revisionId: string; version: number }>(
      `/wiki/pages/${encodeURIComponent(characterId)}/revert`,
      {
        method: "POST",
        body: JSON.stringify({ toRevisionId, reason }),
      },
    );
  },
  recentChanges(opts: { limit?: number; onlyUnpatrolled?: boolean } = {}) {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.onlyUnpatrolled) params.set("onlyUnpatrolled", "1");
    const qs = params.toString();
    return request<WikiRevisionSummary[]>(
      `/wiki/recent-changes${qs ? `?${qs}` : ""}`,
      { auth: false },
    );
  },
  listUsers() {
    return request<WikiUserRow[]>("/wiki/users");
  },
  setUserRole(
    userId: string,
    role: "newcomer" | "autoconfirmed" | "patroller" | "admin",
    reason?: string,
  ) {
    return request<WikiUserRow>(
      `/wiki/users/${encodeURIComponent(userId)}/role`,
      {
        method: "POST",
        body: JSON.stringify({ role, reason }),
      },
    );
  },
  listBlocks(opts: { active?: boolean; userId?: string } = {}) {
    const params = new URLSearchParams();
    if (opts.active === false) params.set("active", "0");
    if (opts.userId) params.set("userId", opts.userId);
    const qs = params.toString();
    return request<WikiBlockRow[]>(`/wiki/blocks${qs ? `?${qs}` : ""}`);
  },
  blockUser(input: {
    userId: string;
    scope: "global" | "page" | "talk";
    targetCharacterId?: string;
    reason: string;
    expiresAt?: string | null;
  }) {
    return request<WikiBlockRow>(
      `/wiki/users/${encodeURIComponent(input.userId)}/block`,
      {
        method: "POST",
        body: JSON.stringify({
          scope: input.scope,
          targetCharacterId: input.targetCharacterId,
          reason: input.reason,
          expiresAt: input.expiresAt ?? null,
        }),
      },
    );
  },
  revokeBlock(blockId: string) {
    return request<{ success: true }>(
      `/wiki/blocks/${encodeURIComponent(blockId)}`,
      { method: "DELETE" },
    );
  },
  setProtection(
    characterId: string,
    input: {
      level: "none" | "semi" | "full";
      reviewPolicy?: "open" | "pending_changes";
      expiresAt?: string | null;
      reason?: string;
    },
  ) {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/protection`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },
  protectionLog(characterId: string) {
    return request<WikiProtectionLogRow[]>(
      `/wiki/pages/${encodeURIComponent(characterId)}/protection-log`,
      { auth: false },
    );
  },
  listThreads(characterId: string) {
    return request<WikiTalkThread[]>(
      `/wiki/talk/${encodeURIComponent(characterId)}/threads`,
      { auth: false },
    );
  },
  createThread(characterId: string, title: string, body: string) {
    return request<{ thread: WikiTalkThread; firstPost: WikiTalkPost }>(
      `/wiki/talk/${encodeURIComponent(characterId)}/threads`,
      {
        method: "POST",
        body: JSON.stringify({ title, body }),
      },
    );
  },
  listPosts(threadId: string) {
    return request<WikiTalkPost[]>(
      `/wiki/talk/threads/${encodeURIComponent(threadId)}/posts`,
      { auth: false },
    );
  },
  createPost(threadId: string, body: string, parentPostId?: string | null) {
    return request<WikiTalkPost>(
      `/wiki/talk/threads/${encodeURIComponent(threadId)}/posts`,
      {
        method: "POST",
        body: JSON.stringify({ body, parentPostId }),
      },
    );
  },
  setThreadFlags(
    threadId: string,
    flags: { isLocked?: boolean; isResolved?: boolean },
  ) {
    return request<WikiTalkThread>(
      `/wiki/talk/threads/${encodeURIComponent(threadId)}/flags`,
      {
        method: "PATCH",
        body: JSON.stringify(flags),
      },
    );
  },
  deletePost(postId: string) {
    return request<WikiTalkPost>(
      `/wiki/talk/posts/${encodeURIComponent(postId)}`,
      { method: "DELETE" },
    );
  },
  watchlist() {
    return request<WatchlistEntry[]>("/wiki/watchlist");
  },
  watchlistFeed(since?: string) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return request<WatchlistFeedItem[]>(`/wiki/watchlist/feed${qs}`);
  },
  isWatching(characterId: string) {
    return request<{ watching: boolean }>(
      `/wiki/watchlist/status/${encodeURIComponent(characterId)}`,
    );
  },
  watch(characterId: string) {
    return request<unknown>(
      `/wiki/watchlist/${encodeURIComponent(characterId)}`,
      { method: "POST", body: JSON.stringify({}) },
    );
  },
  unwatch(characterId: string) {
    return request<{ success: true }>(
      `/wiki/watchlist/${encodeURIComponent(characterId)}`,
      { method: "DELETE" },
    );
  },
  softDeletePage(characterId: string, reason?: string) {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/delete`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: reason ?? translateRuntimeMessage(msg`管理员直接删除词条`),
        }),
      },
    );
  },
  restorePage(characterId: string, reason?: string) {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/restore`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: reason ?? translateRuntimeMessage(msg`管理员直接恢复词条`),
        }),
      },
    );
  },
  requestDeletePage(characterId: string, reason: string) {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/delete-request`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  },
  requestRestorePage(characterId: string, reason: string) {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/restore-request`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  },
  search(q: string, limit = 20) {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return request<
      Array<{
        characterId: string;
        name: string;
        bio: string;
        relationship: string;
        score: number;
      }>
    >(`/wiki/search?${params.toString()}`, { auth: false });
  },
  reportTarget(input: {
    targetType: "wiki_revision" | "wiki_talk_post" | "wiki_page";
    targetId: string;
    reason: string;
    details?: string;
  }) {
    return request<ModerationReport>("/wiki/reports", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  listReports(status?: "open" | "resolved" | "dismissed") {
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    return request<ModerationReport[]>(
      `/wiki/reports${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
  },
  updateReportStatus(id: string, status: "open" | "resolved" | "dismissed") {
    return request<ModerationReport>(
      `/wiki/reports/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
  },
  previewPrompt(
    characterId: string,
    recipe: unknown,
    scene: string,
  ) {
    return request<{ prompt: string }>(
      `/wiki/pages/${encodeURIComponent(characterId)}/preview-prompt`,
      {
        method: "POST",
        body: JSON.stringify({ recipe, scene }),
        auth: false,
      },
    );
  },
  syncPageFromCharacter(characterId: string) {
    return request<{ revisionId: string; status: string }>(
      `/wiki/pages/${encodeURIComponent(characterId)}/sync-from-character`,
      { method: "POST" },
    );
  },
  listFieldProtection(characterId?: string) {
    const params = new URLSearchParams();
    if (characterId) params.set("characterId", characterId);
    return request<FieldProtection[]>(
      `/wiki/field-protection${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
  },
  effectiveFieldProtection(characterId: string) {
    return request<Array<{ fieldPath: string; minRoleToEdit: string }>>(
      `/wiki/field-protection/effective/${encodeURIComponent(characterId)}`,
    );
  },
  createFieldProtection(body: {
    characterId: string;
    fieldPath: string;
    minRoleToEdit: string;
    reason?: string | null;
  }) {
    return request<FieldProtection>("/wiki/field-protection", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateFieldProtection(
    id: string,
    patch: Partial<FieldProtection>,
  ) {
    return request<FieldProtection>(
      `/wiki/field-protection/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
  },
  deleteFieldProtection(id: string) {
    return request<void>(
      `/wiki/field-protection/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  wikiStatsDaily() {
    return request<{
      todayCreates: number;
      weekCreates: number;
      pendingQueueLength: number;
      todayApproved: number;
      todayRejected: number;
      abuseHitsToday: number;
      autoconfirmedThisWeek: number;
    }>("/wiki/admin/stats/daily");
  },
  wikiStatsTopReverted(limit = 20) {
    return request<
      Array<{
        userId: string;
        editCount: number;
        approvedEditCount: number;
        revertedCount: number;
        patrolledCount: number;
        lastEditAt: string | null;
      }>
    >(`/wiki/admin/stats/top-reverted-users?limit=${limit}`);
  },
  wikiStatsAbuseFilters() {
    return request<
      Array<{
        filter: AbuseFilter;
        recentHits: number;
      }>
    >("/wiki/admin/stats/abuse-filters");
  },
  listAbuseFilters() {
    return request<AbuseFilter[]>("/wiki/admin/abuse-filters");
  },
  getAbuseFilter(id: string) {
    return request<AbuseFilter>(
      `/wiki/admin/abuse-filters/${encodeURIComponent(id)}`,
    );
  },
  listAbuseFilterHits(opts: {
    filterId?: string;
    userId?: string;
    limit?: number;
  } = {}) {
    const params = new URLSearchParams();
    if (opts.filterId) params.set("filterId", opts.filterId);
    if (opts.userId) params.set("userId", opts.userId);
    if (opts.limit) params.set("limit", String(opts.limit));
    return request<AbuseFilterHit[]>(
      `/wiki/admin/abuse-filters/hits${params.size > 0 ? `?${params.toString()}` : ""}`,
    );
  },
  createAbuseFilter(body: {
    name: string;
    description?: string;
    enabled?: boolean;
    pattern: AbuseFilterPattern;
    scope?: AbuseFilterScope;
    action: AbuseFilterAction;
    severity?: "low" | "medium" | "high";
  }) {
    return request<AbuseFilter>("/wiki/admin/abuse-filters", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateAbuseFilter(id: string, patch: Partial<AbuseFilter>) {
    return request<AbuseFilter>(
      `/wiki/admin/abuse-filters/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
  },
  deleteAbuseFilter(id: string) {
    return request<void>(
      `/wiki/admin/abuse-filters/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  // ── 我的私有角色（不走审核流，登录用户隔离） ─────────────────────────────
  listMyCharacters() {
    return request<PrivateCharacterRecord[]>("/wiki/my-characters");
  },
  getMyCharacter(id: string) {
    return request<PrivateCharacterRecord>(
      `/wiki/my-characters/${encodeURIComponent(id)}`,
    );
  },
  createMyCharacter(dto: PrivateCharacterDto) {
    return request<PrivateCharacterRecord>("/wiki/my-characters", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  updateMyCharacter(id: string, dto: PrivateCharacterDto) {
    return request<PrivateCharacterRecord>(
      `/wiki/my-characters/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(dto),
      },
    );
  },
  deleteMyCharacter(id: string) {
    return request<{ success: true }>(
      `/wiki/my-characters/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  /**
   * AI 自动生成私有角色的字段。section 完全对齐 apps/admin 的 character-editor-page
   * TABS 数组（去掉 model_routing）+ reasoning Tab：
   * - 'basics' / 'core_logic' / 'chat' / 'scenes' / 'memory' / 'life' / 'reasoning'
   *   生成该 section 字段
   * - 'all'：一次性生成上述 6 个非 sacred section 全部字段（顶部"一键生成"按钮用）。
   *   需要 name + bio + relationship 三个 sacred 字段都已填好，否则后端返回 400。
   * 返回值是只包含**当前为空字段**建议的 partial DTO（后端 normalizeAiOutput 已经过一道
   * "用户已填的不返回"过滤；前端再过一道双保险）。
   */
  generateMyCharacterFields(input: {
    section: AiGenerateSection;
    currentDraft: PrivateCharacterDto;
    /**
     * 优化模式：true 时后端 normalizer 解锁"目标为空才填"，让 AI 覆盖整节
     * （sacred 字段 bio/personality/relationship 后端仍会兜底保留）。
     * 仅前端确认弹窗后才传 true；默认 false 维持旧"只填空"语义。
     */
    optimize?: boolean;
  }) {
    return request<AiGeneratedDraft>("/wiki/my-characters/ai-generate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  /** 触发浏览器下载 export bundle 文件。 */
  async exportMyCharacter(id: string, fallbackName: string): Promise<void> {
    const token = getToken();
    const res = await fetch(
      `${API_BASE}/wiki/my-characters/${encodeURIComponent(id)}/export`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!res.ok) {
      // 401 → 走和 request() 一致的清 session + 跳登录流程，避免用户停在
      // 一个看不懂的"导出失败 (401)"上。
      if (res.status === 401) {
        clearSession();
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register")
        ) {
          const redirect = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
        }
      }
      throw new WikiApiError(res.status, null, `导出失败 (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const safeName = (fallbackName || "character").replace(
      /[\\/:*?"<>|\r\n\t]+/g,
      "_",
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.character.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 不要同步 revoke：Safari / iOS 上 a.click() 异步派发下载，立即 revoke
    // 会让下载在真正开始前失效。延迟到下一帧已足够 Chrome / Firefox /
    // Safari 全平台稳定下载。
    setTimeout(() => URL.revokeObjectURL(url), 500);
  },
  /**
   * 上传一张图片作为头像。返回 `/api/wiki/avatars/<file>` 站内 URL，调用方再把
   * 这个 URL 写到 PrivateCharacterDto.avatar 上即可（isSafeAvatarValue 允许 `/` 开头）。
   */
  async uploadAvatar(file: File): Promise<{ url: string }> {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/wiki/avatars`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const text = await res.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!res.ok) {
      if (res.status === 401) {
        clearSession();
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/register")
        ) {
          const redirect = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
        }
      }
      const message =
        (payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message: unknown }).message)
          : null) ??
        translateRuntimeMessage(msg`头像上传失败 (${res.status})`);
      throw new WikiApiError(res.status, payload, message);
    }
    return payload as { url: string };
  },
  /** 上传一个 JSON 文件，按 name upsert 到当前用户的私有角色。 */
  async importMyCharacter(
    file: File,
  ): Promise<{ record: PrivateCharacterRecord; overwrote: boolean }> {
    // 防御性：bundle 实际只有几十 KB，超过 5 MB 几乎一定是选错文件。
    // 在 file.text() 之前 reject，避免把 GB 级内容读到浏览器内存把页面卡死。
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      throw new WikiApiError(
        400,
        null,
        `文件太大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限 5 MB。确认是 .character.json 文件后再试。`,
      );
    }
    const text = await file.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      throw new WikiApiError(
        400,
        null,
        `JSON 解析失败：${(err as Error).message}`,
      );
    }
    return request<{ record: PrivateCharacterRecord; overwrote: boolean }>(
      "/wiki/my-characters/import",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};

export type PrivateCharacterRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  avatar: string;
  bio: string;
  personality?: string | null;
  relationship: string;
  relationshipType: string;
  expertDomains: string[];
  triggerScenes?: string[] | null;
  recipe?: CharacterBlueprintRecipe | null;
  profile?: unknown | null;
  // —— 2026-05-15 起：和隐界后台 character editor 一一对应的字段 ——
  isOnline?: boolean;
  onlineMode?: string;
  activityMode?: string;
  currentActivity?: string | null;
  sourceType?: string;
  sourceKey?: string | null;
  deletionPolicy?: string;
  isTemplate?: boolean;
  socialOpenness?: string;
  proactiveBrowseChance?: number;
  intimacyLevel?: number;
  createdAt: string;
  updatedAt: string;
};

export type PrivateCharacterDto = {
  name: string;
  avatar?: string;
  bio?: string;
  personality?: string | null;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  recipe?: CharacterBlueprintRecipe | null;
  profile?: unknown | null;
  // —— admin 对齐字段（不含 isOnline / isTemplate / sourceType / sourceKey /
  // deletionPolicy / 生活策略整组 / aiRelationships —— 这些都是 admin-only，
  // wiki 不接受写入） ——
  socialOpenness?: string;
  proactiveBrowseChance?: number;
  intimacyLevel?: number;
};

/**
 * 6 个 AI 生成 section：5 个分 section + 1 个 'all' 一次性全部。
 * 命名严格对齐 apps/admin/src/routes/character-editor-page.tsx 的 TABS 数组
 * （basics / core_logic / chat / scenes / memory）。
 * 与后端 api/src/modules/wiki/services/wiki-private-character-ai.prompts.ts 的
 * SectionKey 同义。
 *
 * 注：social_params / life 不进 AI 生成范围 ——
 * - social_params：admin 也是手填
 * - life：已于 2026-05-15 验收时被整组从 wiki UI 移除
 * reasoning 同样早已移除（admin TABS 没有 reasoning tab）。
 */
export type AiGenerateSection =
  | "basics"
  | "core_logic"
  | "chat"
  | "scenes"
  | "memory"
  | "all";

/** AI 生成返回的 partial draft；只包含**当前为空**字段的建议。 */
export type AiGeneratedDraft = {
  bio?: string;
  personality?: string;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  triggerScenes?: string[];
  recipe?: {
    identity?: Partial<CharacterBlueprintRecipe["identity"]>;
    expertise?: Partial<CharacterBlueprintRecipe["expertise"]>;
    tone?: Partial<CharacterBlueprintRecipe["tone"]>;
    prompting?: Partial<CharacterBlueprintRecipe["prompting"]>;
    memorySeed?: Partial<CharacterBlueprintRecipe["memorySeed"]>;
    lifeStrategy?: Partial<CharacterBlueprintRecipe["lifeStrategy"]>;
  };
};

export type FieldProtection = {
  id: string;
  characterId: string;
  fieldPath: string;
  minRoleToEdit: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type AbuseFilterAction = "log" | "warn" | "block" | "tag_high_risk";
export type AbuseFilterScope = "content" | "recipe" | "all";

export type AbuseFilterPattern =
  | { type: "regex"; regex: string; flags?: string; fields?: string[] }
  | { type: "shrink"; field: string; threshold: number }
  | { type: "frequency"; windowSec: number; maxEdits: number }
  | { type: "link_flood"; threshold: number }
  | { type: "keyword_list"; keywords: string[]; caseSensitive?: boolean };

export type AbuseFilter = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  pattern: AbuseFilterPattern;
  scope: AbuseFilterScope;
  action: AbuseFilterAction;
  severity: "low" | "medium" | "high";
  createdBy: string | null;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AbuseFilterHit = {
  id: string;
  filterId: string;
  userId: string;
  characterId: string | null;
  revisionId: string | null;
  matchedText: string;
  actionTaken: AbuseFilterAction;
  operation: string;
  createdAt: string;
};
