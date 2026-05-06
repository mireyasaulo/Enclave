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
    if (res.status === 401) clearSession();
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `请求失败 (${res.status})`;
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
  me() {
    return request<{
      id: string;
      username: string;
      role: string;
      userType: string;
    }>("/auth/me");
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
  softDeletePage(characterId: string, reason = "管理员直接删除词条") {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/delete`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  },
  restorePage(characterId: string, reason = "管理员直接恢复词条") {
    return request<unknown>(
      `/wiki/pages/${encodeURIComponent(characterId)}/restore`,
      { method: "POST", body: JSON.stringify({ reason }) },
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
};
