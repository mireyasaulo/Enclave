export type MobileNoteEditorRouteState = {
  draftId: string;
  noteId?: string;
  returnPath?: string;
  returnHash?: string;
};

export function buildMobileNoteEditorRouteHash(
  input: MobileNoteEditorRouteState,
) {
  const params = new URLSearchParams();
  const draftId = input.draftId.trim();
  if (!draftId) {
    return "";
  }

  params.set("draftId", draftId);

  if (input.noteId?.trim()) {
    params.set("noteId", input.noteId.trim());
  }

  if (input.returnPath?.trim()) {
    params.set("returnPath", input.returnPath.trim());
  }

  if (input.returnHash?.trim()) {
    params.set("returnHash", input.returnHash.trim());
  }

  return params.toString();
}

export function parseMobileNoteEditorRouteHash(
  hash: string,
): MobileNoteEditorRouteState | null {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalized) {
    return null;
  }

  const params = new URLSearchParams(normalized);
  const draftId = params.get("draftId")?.trim();
  if (!draftId) {
    return null;
  }

  return {
    draftId,
    noteId: params.get("noteId")?.trim() || undefined,
    returnPath: params.get("returnPath")?.trim() || undefined,
    returnHash: params.get("returnHash")?.trim() || undefined,
  };
}
