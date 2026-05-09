import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type {
  FavoriteNoteAsset,
  FavoriteNoteDocument,
  FavoriteNoteSummary,
  FavoriteRecord,
  NoteCardAttachment,
} from "@yinjie/contracts";
import type { DesktopNoteDraftRecord } from "./note-drafts-storage";

export type NoteEditorState = {
  contentHtml: string;
  contentText: string;
  tags: string[];
  assets: FavoriteNoteAsset[];
};

export const EMPTY_NOTE_EDITOR_STATE: NoteEditorState = {
  contentHtml: "",
  contentText: "",
  tags: [],
  assets: [],
};

export type NoteSendDialogNote = {
  noteId: string;
  title: string;
  excerpt: string;
  tags: string[];
  assets: FavoriteNoteAsset[];
  updatedAt: string;
};

export function buildEditorStateFromDocument(
  note: FavoriteNoteDocument,
): NoteEditorState {
  return {
    contentHtml: note.contentHtml,
    contentText: note.contentText,
    tags: [...note.tags],
    assets: note.assets.map((asset) => ({ ...asset })),
  };
}

export function buildEditorStateFromDraft(
  draft: DesktopNoteDraftRecord,
): NoteEditorState {
  return {
    contentHtml: draft.contentHtml,
    contentText: draft.contentText,
    tags: [...draft.tags],
    assets: draft.assets.map((asset) => ({ ...asset })),
  };
}

export function buildNoteSnapshot(state: NoteEditorState) {
  return JSON.stringify({
    contentHtml: normalizeEditorHtml(state.contentHtml),
    contentText: state.contentText.trim(),
    tags: [...state.tags].sort(),
    assets: state.assets,
  });
}

export function buildNoteMutationPayload(state: NoteEditorState) {
  const contentHtml = normalizeEditorHtml(state.contentHtml);
  return {
    contentHtml,
    contentText: extractNoteTextFromHtml(contentHtml),
    tags: state.tags,
    assets: filterAssetsByHtml(contentHtml, state.assets),
  };
}

export function normalizeEditorHtml(value: string) {
  const normalized = value
    .replace(/\u200b/g, "")
    .replace(/<div><br><\/div>/gi, "")
    .replace(/<p><br><\/p>/gi, "")
    .trim();

  if (!normalized) {
    return "";
  }

  const text = extractNoteTextFromHtml(normalized);
  const hasAsset = /data-note-asset-id=/.test(normalized);
  return text || hasAsset ? normalized : "";
}

export function extractNoteTextFromHtml(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (typeof document === "undefined") {
    return value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const container = document.createElement("div");
  container.innerHTML = value;
  return container.innerText.replace(/\r\n/g, "\n").trim();
}

export function filterAssetsByHtml(html: string, assets: FavoriteNoteAsset[]) {
  const assetIds = [...html.matchAll(/data-note-asset-id="([^"]+)"/g)].map(
    (item) => item[1],
  );
  const assetIdSet = new Set(assetIds);
  return assets.filter((asset) => assetIdSet.has(asset.id));
}

export function mergeNoteAssets(
  current: FavoriteNoteAsset[],
  incoming: FavoriteNoteAsset[],
) {
  const currentById = new Map(current.map((asset) => [asset.id, asset]));
  for (const asset of incoming) {
    currentById.set(asset.id, asset);
  }

  return [...currentById.values()];
}

export function resolveNoteTitle(contentText: string) {
  const firstLine = contentText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine?.slice(0, 28) || translateRuntimeMessage(msg`无标题笔记`);
}

export function resolveNoteExcerpt(contentText: string, title: string) {
  const lines = contentText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const body = lines.join(" ").trim();
  if (!body) {
    return "";
  }

  if (body === title) {
    return "";
  }

  const withoutTitle = body.startsWith(title)
    ? body.slice(title.length).trim()
    : body;
  return withoutTitle.slice(0, 120);
}

export function buildNoteSendDialogNote(input: {
  noteId: string;
  state: NoteEditorState;
  updatedAt?: string;
}): NoteSendDialogNote {
  const title = resolveNoteTitle(input.state.contentText);
  return {
    noteId: input.noteId,
    title,
    excerpt: resolveNoteExcerpt(input.state.contentText, title),
    tags: [...input.state.tags],
    assets: filterAssetsByHtml(input.state.contentHtml, input.state.assets),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function buildNoteSendDialogNoteFromDocument(
  note: FavoriteNoteDocument,
): NoteSendDialogNote {
  return {
    noteId: note.id,
    title: note.title,
    excerpt: note.excerpt,
    tags: [...note.tags],
    assets: note.assets.map((asset) => ({ ...asset })),
    updatedAt: note.updatedAt,
  };
}

export function buildNoteCardAttachment(
  note: NoteSendDialogNote,
): NoteCardAttachment {
  return {
    kind: "note_card",
    noteId: note.noteId,
    title: note.title,
    excerpt: note.excerpt,
    tags: [...note.tags],
    assets: note.assets.map((asset) => ({ ...asset })),
    updatedAt: note.updatedAt,
  };
}

export function buildFavoriteNoteSummary(
  note: FavoriteNoteDocument,
): FavoriteNoteSummary {
  return {
    id: note.id,
    title: note.title,
    excerpt: note.excerpt,
    tags: [...note.tags],
    assets: note.assets.map((asset) => ({ ...asset })),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function buildFavoriteNoteSourceId(noteId: string) {
  return `favorite-note-${noteId}`;
}

export function buildFavoriteNoteRecord(note: FavoriteNoteDocument): FavoriteRecord {
  return {
    id: `favorite-${note.id}`,
    sourceId: buildFavoriteNoteSourceId(note.id),
    category: "notes",
    title: note.title,
    description: note.excerpt,
    meta: formatFavoriteTimestamp(note.updatedAt),
    to: `/tabs/favorites#draftId=${encodeURIComponent(note.id)}&noteId=${encodeURIComponent(note.id)}`,
    badge: translateRuntimeMessage(msg`笔记`),
    avatarName: note.title,
    collectedAt: note.updatedAt,
  };
}

export function upsertFavoriteNoteSummary(
  current: FavoriteNoteSummary[] | undefined,
  note: FavoriteNoteDocument,
) {
  const nextNote = buildFavoriteNoteSummary(note);
  return [
    nextNote,
    ...(current ?? []).filter((item) => item.id !== note.id),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function upsertFavoriteNoteRecord(
  current: FavoriteRecord[] | undefined,
  note: FavoriteNoteDocument,
) {
  const nextRecord = buildFavoriteNoteRecord(note);
  return [
    nextRecord,
    ...(current ?? []).filter((item) => item.sourceId !== nextRecord.sourceId),
  ].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt));
}

export function removeFavoriteNoteSummary(
  current: FavoriteNoteSummary[] | undefined,
  noteId: string,
) {
  return (current ?? []).filter((item) => item.id !== noteId);
}

export function removeFavoriteNoteRecord(
  current: FavoriteRecord[] | undefined,
  noteId: string,
) {
  const sourceId = buildFavoriteNoteSourceId(noteId);
  return (current ?? []).filter((item) => item.sourceId !== sourceId);
}

export function isFavoriteNoteMissingError(error: unknown) {
  return (
    error instanceof Error &&
    /favorite note .+ not found/i.test(error.message.trim())
  );
}

export function formatFavoriteTimestamp(iso: string) {
  const date = new Date(iso);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return translateRuntimeMessage(
    msg`${month}月${day}日 ${hours}:${minutes}`,
  );
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttribute(value: string) {
  return escapeHtml(value);
}
