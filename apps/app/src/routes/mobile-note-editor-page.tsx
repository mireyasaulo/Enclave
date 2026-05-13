import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bold,
  FolderUp,
  Italic,
  List,
  ListTodo,
  Save,
  Send,
  Tag,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import {
  createFavoriteNote,
  getConversations,
  getFavoriteNote,
  removeFavoriteNote,
  sendGroupMessage,
  updateFavoriteNote,
  uploadChatAttachment,
  type ConversationListItem,
  type FavoriteNoteAsset,
  type FavoriteNoteDocument,
  type FavoriteNoteSummary,
  type FavoriteRecord,
} from "@yinjie/contracts";
import { useRuntimeTranslator, translateRuntimeMessage } from "@yinjie/i18n";
import {
  AppPage,
  Button,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  cn,
} from "@yinjie/ui";

import { RouteRedirectState } from "../components/route-redirect-state";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import {
  EMPTY_NOTE_EDITOR_STATE,
  buildEditorStateFromDocument,
  buildEditorStateFromDraft,
  buildNoteCardAttachment,
  buildNoteMutationPayload,
  buildNoteSendDialogNote,
  buildNoteSendDialogNoteFromDocument,
  buildNoteSnapshot,
  escapeHtml,
  escapeHtmlAttribute,
  extractNoteTextFromHtml,
  filterAssetsByHtml,
  isFavoriteNoteMissingError,
  mergeNoteAssets,
  normalizeEditorHtml,
  shouldDiscardEmptyDraftForApi,
  removeFavoriteNoteRecord,
  removeFavoriteNoteSummary,
  resolveNoteTitle,
  upsertFavoriteNoteRecord,
  upsertFavoriteNoteSummary,
  type NoteEditorState,
  type NoteSendDialogNote,
} from "../features/favorites/note-editor-helpers";
import {
  clearDesktopNoteDraft,
  createDesktopNoteDraft,
  readDesktopNoteDraft,
  readDesktopNoteDraftByNoteId,
  saveDesktopNoteDraft,
} from "../features/favorites/note-drafts-storage";
import {
  buildMobileNoteEditorRouteHash,
  parseMobileNoteEditorRouteHash,
} from "../features/notes/mobile-note-editor-route-state";
import { MobileNoteSendSheet } from "../features/notes/mobile-note-send-sheet";
import { isPersistedGroupConversation } from "../lib/conversation-route";
import {
  isDesktopOnlyPath,
  navigateBackOrFallback,
} from "../lib/history-back";
import { emitChatMessage, joinConversationRoom } from "../lib/socket";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";

const DesktopNotesWorkspace = lazy(async () => {
  const mod = await import(
    "../features/desktop/chat/desktop-notes-workspace"
  );
  return { default: mod.DesktopNotesWorkspace };
});

type NoteNotice = {
  tone: "success" | "danger";
  message: string;
};

export function MobileNoteEditorPage() {
  const t = useRuntimeTranslator();
  const isDesktopLayout = useDesktopLayout();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const routeState = useMemo(
    () => parseMobileNoteEditorRouteHash(hash),
    [hash],
  );

  if (isDesktopLayout) {
    return (
      <Suspense
        fallback={
          <RouteRedirectState
            title={t(msg`正在打开桌面笔记`)}
            description={t(msg`正在跳转到桌面笔记编辑器。`)}
            loadingLabel={t(msg`切换桌面笔记...`)}
          />
        }
      >
        <DesktopNotesWorkspace
          draftId={routeState?.draftId}
          selectedNoteId={routeState?.noteId}
          returnTo={
            routeState?.returnPath
              ? `${routeState.returnPath}${
                  routeState.returnHash ? `#${routeState.returnHash}` : ""
                }`
              : undefined
          }
        />
      </Suspense>
    );
  }

  return <MobileNoteEditor routeState={routeState} />;
}

function MobileNoteEditor({
  routeState,
}: {
  routeState: ReturnType<typeof parseMobileNoteEditorRouteHash>;
}) {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedSessionKeyRef = useRef("");

  const draftIdParam = routeState?.draftId;
  const selectedNoteId = routeState?.noteId;
  const returnPath = routeState?.returnPath;
  const returnHash = routeState?.returnHash;

  const safeReturnPath =
    returnPath && !isDesktopOnlyPath(returnPath) ? returnPath : undefined;
  const safeReturnHash = safeReturnPath ? returnHash : undefined;

  const [noteId, setNoteId] = useState(selectedNoteId);
  const [activeDraftId, setActiveDraftId] = useState(
    () => draftIdParam?.trim() || selectedNoteId?.trim() || "",
  );
  const [editorState, setEditorState] = useState<NoteEditorState>(
    EMPTY_NOTE_EDITOR_STATE,
  );
  const [savedSnapshot, setSavedSnapshot] = useState(
    buildNoteSnapshot(EMPTY_NOTE_EDITOR_STATE),
  );
  const [notice, setNotice] = useState<NoteNotice | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [attachmentPending, setAttachmentPending] = useState(false);
  const [sendDialogNote, setSendDialogNote] =
    useState<NoteSendDialogNote | null>(null);

  const noteQuery = useQuery({
    queryKey: ["favorite-note", baseUrl, selectedNoteId],
    queryFn: () => getFavoriteNote(selectedNoteId!, baseUrl),
    enabled: Boolean(selectedNoteId),
  });
  const recentConversationsQuery = useQuery({
    queryKey: ["mobile-note-send-conversations", baseUrl],
    queryFn: () => getConversations(baseUrl),
    enabled: Boolean(sendDialogNote),
  });

  const sessionKey = `${selectedNoteId ?? "new"}:${draftIdParam ?? ""}`;
  const missingSelectedNote =
    selectedNoteId && isFavoriteNoteMissingError(noteQuery.error);

  const currentSnapshot = useMemo(
    () => buildNoteSnapshot(editorState),
    [editorState],
  );
  const isDirty = currentSnapshot !== savedSnapshot;
  const noteTitle = useMemo(
    () => resolveNoteTitle(editorState.contentText),
    [editorState.contentText],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildNoteMutationPayload(editorState);
      return noteId
        ? updateFavoriteNote(noteId, payload, baseUrl)
        : createFavoriteNote(payload, baseUrl);
    },
    onSuccess: async (savedNote) => {
      const nextDraftId = activeDraftId || draftIdParam?.trim() || savedNote.id;
      const nextState = buildEditorStateFromDocument(savedNote);
      const nextSnapshot = buildNoteSnapshot(nextState);

      setNoteId(savedNote.id);
      setEditorState(nextState);
      setSavedSnapshot(nextSnapshot);
      if (editorRef.current) {
        editorRef.current.innerHTML = nextState.contentHtml;
      }
      setNotice({
        tone: "success",
        message: t(msg`笔记已保存到收藏。`),
      });

      saveDesktopNoteDraft({
        draftId: nextDraftId,
        noteId: savedNote.id,
        ...nextState,
        updatedAt: new Date().toISOString(),
      });

      queryClient.setQueryData<FavoriteNoteDocument>(
        ["favorite-note", baseUrl, savedNote.id],
        savedNote,
      );
      queryClient.setQueryData<FavoriteNoteSummary[]>(
        ["favorite-notes", baseUrl],
        (current) => upsertFavoriteNoteSummary(current, savedNote),
      );
      queryClient.setQueryData<FavoriteRecord[]>(
        ["app-favorites", baseUrl],
        (current) => upsertFavoriteNoteRecord(current, savedNote),
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["app-favorites", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["favorite-notes", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["favorite-note", baseUrl, savedNote.id],
        }),
      ]);

      if (typeof window !== "undefined") {
        const nextHash = buildMobileNoteEditorRouteHash({
          draftId: nextDraftId,
          noteId: savedNote.id,
          returnPath: safeReturnPath,
          returnHash: safeReturnHash,
        });
        if (nextHash && nextHash !== hashWithoutLeading(window.location.hash)) {
          void navigate({
            to: "/notes/new",
            hash: nextHash,
            replace: true,
          });
        }
      }
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : t(msg`保存失败，请稍后再试。`),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!noteId) {
        return { success: true as const };
      }
      return removeFavoriteNote(noteId, baseUrl);
    },
    onSuccess: async () => {
      if (activeDraftId) {
        clearDesktopNoteDraft(activeDraftId);
      }
      setSendDialogNote(null);

      if (noteId) {
        queryClient.setQueryData<FavoriteNoteSummary[]>(
          ["favorite-notes", baseUrl],
          (current) => removeFavoriteNoteSummary(current, noteId),
        );
        queryClient.setQueryData<FavoriteRecord[]>(
          ["app-favorites", baseUrl],
          (current) => removeFavoriteNoteRecord(current, noteId),
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["app-favorites", baseUrl],
        }),
        queryClient.invalidateQueries({
          queryKey: ["favorite-notes", baseUrl],
        }),
      ]);

      if (noteId) {
        await queryClient.removeQueries({
          queryKey: ["favorite-note", baseUrl, noteId],
        });
      }

      void leaveEditor();
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : t(msg`删除失败，请稍后再试。`),
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (conversation: ConversationListItem) => {
      const note = sendDialogNote;
      if (!note) {
        throw new Error("NOTE_SEND_EMPTY");
      }

      const attachment = buildNoteCardAttachment(note);
      const noteCardText = translateRuntimeMessage(
        msg`[笔记] ${attachment.title}`,
      );
      if (isPersistedGroupConversation(conversation)) {
        await sendGroupMessage(
          conversation.id,
          {
            type: "note_card",
            text: noteCardText,
            attachment,
          },
          baseUrl,
        );
      } else {
        const characterId = conversation.participants[0]?.trim();
        if (!characterId) {
          throw new Error("NOTE_SEND_NO_TARGET");
        }
        joinConversationRoom({ conversationId: conversation.id });
        emitChatMessage({
          conversationId: conversation.id,
          characterId,
          type: "note_card",
          text: noteCardText,
          attachment,
        });
      }

      return conversation.title;
    },
    onSuccess: async (conversationTitle) => {
      setSendDialogNote(null);
      setNotice({
        tone: "success",
        message: t(msg`笔记已发送到 ${conversationTitle}。`),
      });
      await queryClient.invalidateQueries({
        queryKey: ["app-conversations", baseUrl],
      });
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message === "NOTE_SEND_EMPTY"
              ? t(msg`当前没有可发送的笔记。`)
              : error.message === "NOTE_SEND_NO_TARGET"
                ? t(msg`当前会话没有可用的接收目标。`)
                : error.message
            : t(msg`发送失败，请稍后再试。`),
      });
    },
  });

  useEffect(() => {
    setNoteId(selectedNoteId);
  }, [selectedNoteId]);

  useEffect(() => {
    if (activeDraftId) {
      return;
    }
    const draft = createDesktopNoteDraft({
      draftId: draftIdParam,
      noteId: selectedNoteId,
    });
    setActiveDraftId(draft.draftId);
  }, [activeDraftId, draftIdParam, selectedNoteId]);

  useEffect(() => {
    const nextDraftId =
      activeDraftId || draftIdParam?.trim() || selectedNoteId?.trim() || "";
    if (!nextDraftId) {
      return;
    }

    if (initializedSessionKeyRef.current === sessionKey) {
      return;
    }

    if (selectedNoteId) {
      const localDraftRaw =
        readDesktopNoteDraftByNoteId(selectedNoteId) ??
        readDesktopNoteDraft(nextDraftId);
      const localDraft = shouldDiscardEmptyDraftForApi(
        localDraftRaw,
        noteQuery.data,
      )
        ? null
        : localDraftRaw;
      if (localDraft) {
        const treatLocalDraftAsNewNote = Boolean(missingSelectedNote);
        applyNoteSource({
          draftId: localDraft.draftId,
          noteId: treatLocalDraftAsNewNote ? undefined : selectedNoteId,
          state: buildEditorStateFromDraft(localDraft),
          savedSource: treatLocalDraftAsNewNote
            ? null
            : (noteQuery.data ?? null),
        });
        if (treatLocalDraftAsNewNote) {
          setNotice({
            tone: "danger",
            message: t(msg`原笔记已不存在，当前草稿会按新笔记保存。`),
          });
        }
        initializedSessionKeyRef.current = sessionKey;
        return;
      }

      if (noteQuery.isLoading && !noteQuery.data) {
        return;
      }

      if (noteQuery.data) {
        const ensuredDraft = createDesktopNoteDraft({
          draftId: nextDraftId,
          noteId: noteQuery.data.id,
          ...buildEditorStateFromDocument(noteQuery.data),
        });
        applyNoteSource({
          draftId: ensuredDraft.draftId,
          noteId: noteQuery.data.id,
          state: buildEditorStateFromDocument(noteQuery.data),
          savedSource: noteQuery.data,
        });
        initializedSessionKeyRef.current = sessionKey;
        return;
      }
    }

    const newDraft =
      readDesktopNoteDraft(nextDraftId) ??
      createDesktopNoteDraft({
        draftId: nextDraftId,
        noteId: selectedNoteId,
      });
    applyNoteSource({
      draftId: newDraft.draftId,
      noteId: selectedNoteId,
      state: buildEditorStateFromDraft(newDraft),
      savedSource: null,
    });
    initializedSessionKeyRef.current = sessionKey;
  }, [
    activeDraftId,
    draftIdParam,
    missingSelectedNote,
    noteQuery.data,
    noteQuery.isLoading,
    selectedNoteId,
    sessionKey,
    t,
  ]);

  useEffect(() => {
    if (!selectedNoteId || !noteQuery.data) {
      return;
    }
    setSavedSnapshot(
      buildNoteSnapshot(buildEditorStateFromDocument(noteQuery.data)),
    );
  }, [noteQuery.data, selectedNoteId]);

  useEffect(() => {
    if (!activeDraftId) {
      return;
    }
    // 初始化未完成前禁止自动保存，否则空 editorState 会覆盖掉 API 真实内容
    if (initializedSessionKeyRef.current !== sessionKey) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveDesktopNoteDraft({
        draftId: activeDraftId,
        noteId: noteId || undefined,
        ...editorState,
        updatedAt: new Date().toISOString(),
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [activeDraftId, editorState, noteId, sessionKey]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function applyNoteSource(input: {
    draftId: string;
    noteId?: string;
    state: NoteEditorState;
    savedSource: FavoriteNoteDocument | null;
  }) {
    setActiveDraftId(input.draftId);
    setNoteId(input.noteId);
    setEditorState(input.state);
    setSavedSnapshot(
      buildNoteSnapshot(
        input.savedSource
          ? buildEditorStateFromDocument(input.savedSource)
          : EMPTY_NOTE_EDITOR_STATE,
      ),
    );
    if (editorRef.current) {
      editorRef.current.innerHTML = input.state.contentHtml;
    }
  }

  function syncEditorStateFromDom() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const nextHtml = normalizeEditorHtml(editor.innerHTML);
    const nextAssets = filterAssetsByHtml(nextHtml, editorState.assets);
    setEditorState({
      contentHtml: nextHtml,
      contentText: extractNoteTextFromHtml(nextHtml),
      tags: editorState.tags,
      assets: nextAssets,
    });
  }

  function focusEditorAtEnd() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function applyDocumentCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorStateFromDom();
  }

  function insertTodoAtCursor() {
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<span data-note-checkbox="false">☐</span>&nbsp;`,
    );
    syncEditorStateFromDom();
  }

  async function handleAttachmentSelection(fileList: FileList | null) {
    const files = fileList ? [...fileList] : [];
    if (!files.length) {
      return;
    }

    setAttachmentPending(true);

    try {
      const createdAssets: FavoriteNoteAsset[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadChatAttachment(formData, baseUrl);
        const attachment = result.attachment;
        const assetId =
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${attachment.kind}-${Date.now()}`;

        if (attachment.kind === "image") {
          createdAssets.push({
            id: assetId,
            kind: "image",
            fileName: attachment.fileName,
            url: attachment.url,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
            width: attachment.width,
            height: attachment.height,
          });
          focusEditorAtEnd();
          document.execCommand(
            "insertHTML",
            false,
            `<p><img data-note-image="true" data-note-asset-id="${assetId}" src="${escapeHtmlAttribute(
              attachment.url,
            )}" alt="${escapeHtmlAttribute(attachment.fileName)}" /></p><p><br></p>`,
          );
          continue;
        }

        if (attachment.kind === "file") {
          createdAssets.push({
            id: assetId,
            kind: "file",
            fileName: attachment.fileName,
            url: attachment.url,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
          });
          focusEditorAtEnd();
          document.execCommand(
            "insertHTML",
            false,
            `<p><a data-note-file="true" data-note-asset-id="${assetId}" href="${escapeHtmlAttribute(
              attachment.url,
            )}" target="_blank" rel="noreferrer">📎 ${escapeHtml(
              attachment.fileName,
            )}</a></p><p><br></p>`,
          );
        }
      }

      const nextAssets = mergeNoteAssets(editorState.assets, createdAssets);
      const editor = editorRef.current;
      const nextHtml = normalizeEditorHtml(
        editor?.innerHTML ?? editorState.contentHtml,
      );
      setEditorState({
        contentHtml: nextHtml,
        contentText: extractNoteTextFromHtml(nextHtml),
        tags: editorState.tags,
        assets: filterAssetsByHtml(nextHtml, nextAssets),
      });
      setNotice({
        tone: "success",
        message: t(msg`附件已插入到笔记。`),
      });
    } catch (error) {
      setNotice({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : t(msg`附件上传失败，请稍后再试。`),
      });
    } finally {
      setAttachmentPending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleEditorClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const checkbox = target.closest("[data-note-checkbox]");
    if (!(checkbox instanceof HTMLElement)) {
      return;
    }
    const checked = checkbox.dataset.noteCheckbox === "true";
    checkbox.dataset.noteCheckbox = checked ? "false" : "true";
    checkbox.textContent = checked ? "☐" : "☑";
    syncEditorStateFromDom();
  }

  function handleTagCommit() {
    const normalizedTag = tagInput.trim().replace(/^#/, "");
    if (!normalizedTag) {
      setTagInput("");
      return;
    }
    if (editorState.tags.includes(normalizedTag)) {
      setTagInput("");
      return;
    }
    setEditorState((current) => ({
      ...current,
      tags: [...current.tags, normalizedTag].slice(0, 8),
    }));
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    setEditorState((current) => ({
      ...current,
      tags: current.tags.filter((item) => item !== tag),
    }));
  }

  const handleSave = useCallback(async () => {
    try {
      const savedNote = await saveMutation.mutateAsync();
      return savedNote;
    } catch {
      return null;
    }
  }, [saveMutation]);

  const leaveEditor = useCallback(async () => {
    navigateBackOrFallback(() => {
      if (safeReturnPath) {
        void navigate({
          to: safeReturnPath,
          ...(safeReturnHash ? { hash: safeReturnHash } : {}),
        });
        return;
      }
      void navigate({ to: "/tabs/chat" });
    });
  }, [navigate, safeReturnHash, safeReturnPath]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setCloseConfirmOpen(true);
      return;
    }
    void leaveEditor();
  }, [isDirty, leaveEditor]);

  async function handleSaveAndClose() {
    const savedNote = await handleSave();
    if (!savedNote) {
      return;
    }
    setCloseConfirmOpen(false);
    await leaveEditor();
  }

  async function handleDiscardAndClose() {
    if (activeDraftId) {
      clearDesktopNoteDraft(activeDraftId);
    }
    setCloseConfirmOpen(false);
    await leaveEditor();
  }

  async function requestSend() {
    const hasSendableContent =
      Boolean(editorState.contentText.trim()) || editorState.assets.length > 0;
    if (!hasSendableContent) {
      setNotice({
        tone: "danger",
        message: t(msg`先写一点内容，再把这条笔记发送出去。`),
      });
      return;
    }

    const savedNote =
      isDirty || !noteId
        ? await handleSave()
        : noteQuery.data && noteQuery.data.id === noteId
          ? noteQuery.data
          : null;

    const nextNote = savedNote
      ? buildNoteSendDialogNoteFromDocument(savedNote)
      : noteId
        ? buildNoteSendDialogNote({
            noteId,
            state: editorState,
            updatedAt: noteQuery.data?.updatedAt,
          })
        : null;

    if (!nextNote) {
      setNotice({
        tone: "danger",
        message: t(msg`笔记还没有保存成功，请稍后再试。`),
      });
      return;
    }

    setSendDialogNote(nextNote);
  }

  if (
    selectedNoteId &&
    noteQuery.isLoading &&
    !initializedSessionKeyRef.current
  ) {
    return (
      <AppPage className="flex h-full items-center justify-center bg-[color:var(--bg-app)] px-5">
        <LoadingBlock label={t(msg`正在读取笔记...`)} />
      </AppPage>
    );
  }

  if (
    selectedNoteId &&
    noteQuery.isError &&
    !readDesktopNoteDraftByNoteId(selectedNoteId)
  ) {
    return (
      <AppPage className="flex h-full items-center justify-center bg-[color:var(--bg-app)] px-5">
        <div className="w-full max-w-md rounded-[18px] border border-[color:var(--border-faint)] bg-white p-6 shadow-[var(--shadow-card)]">
          <ErrorBlock
            message={
              noteQuery.error instanceof Error
                ? noteQuery.error.message
                : t(msg`读取笔记失败，请稍后再试。`)
            }
          />
          <div className="mt-5 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => void leaveEditor()}
              className="rounded-[10px] border-[color:var(--border-faint)] bg-white shadow-none"
            >
              {t(msg`回到来源`)}
            </Button>
          </div>
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage className="space-y-0 bg-[#ededed] px-0 py-0">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) =>
          void handleAttachmentSelection(event.target.files)
        }
      />

      <TabPageTopBar
        title={noteTitle}
        titleAlign="center"
        className="mx-0 mb-0 mt-0 border-b border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.94)] px-4 pb-1.5 pt-1.5 text-[color:var(--text-primary)] shadow-none"
        titleClassName="text-[16px] font-medium tracking-normal"
        leftActions={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={requestClose}
            className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-primary)] shadow-none hover:bg-black/4 active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={18} />
          </Button>
        }
        rightActions={
          <div className="flex items-center gap-1">
            {noteId ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleteMutation.isPending}
                className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-secondary)] shadow-none hover:bg-black/4 active:bg-black/[0.05]"
                aria-label={t(msg`删除笔记`)}
              >
                <Trash2 size={16} />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void requestSend()}
              disabled={saveMutation.isPending || sendMutation.isPending}
              className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-secondary)] shadow-none hover:bg-black/4 active:bg-black/[0.05]"
              aria-label={t(msg`发送`)}
            >
              <Send size={16} />
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saveMutation.isPending}
              className="h-8 rounded-[10px] bg-[color:var(--brand-primary)] px-3 text-white hover:opacity-95"
            >
              <Save size={14} />
              <span className="ml-1 text-[12px]">
                {saveMutation.isPending ? t(msg`保存中`) : t(msg`保存`)}
              </span>
            </Button>
          </div>
        }
      >
        <div className="text-[11px] text-[color:var(--text-muted)]">
          {saveMutation.isPending
            ? t(msg`正在保存到收藏...`)
            : isDirty
              ? t(msg`存在未保存修改`)
              : noteId
                ? t(msg`已保存到收藏`)
                : t(msg`新建笔记`)}
        </div>
      </TabPageTopBar>

      {notice ? (
        <div className="px-4 pt-3">
          <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice>
        </div>
      ) : null}

      {tagEditorOpen || editorState.tags.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border-faint)] bg-white/85 px-4 py-3">
          {editorState.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[rgba(7,193,96,0.08)] px-3 py-1 text-[12px] text-[color:var(--brand-primary)]"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-[color:var(--brand-primary)] transition active:bg-[rgba(7,193,96,0.16)]"
                aria-label={t(msg`移除标签 ${tag}`)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {tagEditorOpen ? (
            <div className="flex items-center gap-2">
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }
                  event.preventDefault();
                  handleTagCommit();
                }}
                placeholder={t(msg`输入标签后回车`)}
                className="h-9 w-[160px] rounded-[10px] border border-[color:var(--border-faint)] bg-white px-3 text-[13px] text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--brand-primary)]"
              />
              <Button
                variant="secondary"
                onClick={handleTagCommit}
                className="h-9 rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 shadow-none"
              >
                {t(msg`添加`)}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-white px-4 py-4">
        <div className="relative">
          {!editorState.contentText.trim() ? (
            <div className="pointer-events-none absolute left-0 top-0 text-[15px] leading-7 text-[color:var(--text-dim)]">
              {t(msg`写点什么。支持富文本、待办、图片和文件。`)}
            </div>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncEditorStateFromDom}
            onClick={handleEditorClick}
            className={cn(
              "min-h-[60vh] outline-none",
              "text-[15px] leading-7 text-[color:var(--text-primary)]",
              "[&_a[data-note-file='true']]:inline-flex [&_a[data-note-file='true']]:items-center [&_a[data-note-file='true']]:rounded-[12px] [&_a[data-note-file='true']]:border [&_a[data-note-file='true']]:border-[rgba(15,23,42,0.08)] [&_a[data-note-file='true']]:bg-[rgba(243,244,246,0.82)] [&_a[data-note-file='true']]:px-3 [&_a[data-note-file='true']]:py-2 [&_a[data-note-file='true']]:text-[13px] [&_a[data-note-file='true']]:text-[color:var(--text-primary)] [&_a[data-note-file='true']]:no-underline",
              "[&_img[data-note-image='true']]:my-2 [&_img[data-note-image='true']]:max-h-[60vw] [&_img[data-note-image='true']]:max-w-full [&_img[data-note-image='true']]:rounded-[14px] [&_img[data-note-image='true']]:border [&_img[data-note-image='true']]:border-[rgba(15,23,42,0.08)]",
              "[&_[data-note-checkbox='false']]:cursor-pointer [&_[data-note-checkbox='true']]:cursor-pointer [&_[data-note-checkbox='true']]:text-[color:var(--brand-primary)]",
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          "sticky bottom-0 flex shrink-0 flex-wrap items-center gap-1.5 border-t border-[color:var(--border-faint)] bg-[rgba(247,247,247,0.96)] px-2.5 py-2 backdrop-blur-xl",
          "pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]",
        )}
      >
        <ToolbarButton
          label={t(msg`附件`)}
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderUp size={15} />
        </ToolbarButton>
        <ToolbarButton
          label={t(msg`粗体`)}
          onClick={() => applyDocumentCommand("bold")}
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          label={t(msg`斜体`)}
          onClick={() => applyDocumentCommand("italic")}
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          label={t(msg`下划线`)}
          onClick={() => applyDocumentCommand("underline")}
        >
          <Underline size={15} />
        </ToolbarButton>
        <ToolbarButton
          label={t(msg`列表`)}
          onClick={() => applyDocumentCommand("insertUnorderedList")}
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton label={t(msg`待办`)} onClick={insertTodoAtCursor}>
          <ListTodo size={15} />
        </ToolbarButton>
        <ToolbarButton
          label={t(msg`标签`)}
          active={tagEditorOpen}
          onClick={() => setTagEditorOpen((current) => !current)}
        >
          <Tag size={15} />
        </ToolbarButton>
        {attachmentPending ? (
          <span className="rounded-full bg-[rgba(7,193,96,0.08)] px-2.5 py-1 text-[11px] text-[color:var(--brand-primary)]">
            {t(msg`附件上传中...`)}
          </span>
        ) : null}
      </div>

      <ConfirmSheet
        open={deleteConfirmOpen}
        title={t(msg`删除这条笔记？`)}
        description={t(msg`删除后会从收藏的笔记列表中移除，无法恢复。`)}
        confirmLabel={t(msg`删除`)}
        pendingLabel={t(msg`删除中...`)}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />

      <UnsavedSheet
        open={closeConfirmOpen}
        pending={saveMutation.isPending}
        onClose={() => setCloseConfirmOpen(false)}
        onDiscard={() => void handleDiscardAndClose()}
        onSave={() => void handleSaveAndClose()}
      />

      <MobileNoteSendSheet
        open={Boolean(sendDialogNote)}
        note={sendDialogNote}
        conversations={recentConversationsQuery.data ?? []}
        loading={recentConversationsQuery.isLoading}
        pending={sendMutation.isPending}
        error={
          recentConversationsQuery.error instanceof Error
            ? recentConversationsQuery.error.message
            : null
        }
        onClose={() => {
          if (!sendMutation.isPending) {
            setSendDialogNote(null);
          }
        }}
        onSend={(conversation) => {
          void sendMutation.mutateAsync(conversation);
        }}
      />
    </AppPage>
  );
}

function ToolbarButton({
  active = false,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12px] transition",
        active
          ? "border-[rgba(7,193,96,0.16)] bg-[rgba(7,193,96,0.08)] text-[color:var(--brand-primary)]"
          : "border-transparent bg-white text-[color:var(--text-secondary)] active:bg-black/5",
      )}
      aria-label={label}
      title={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  danger = false,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useRuntimeTranslator();
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(17,24,39,0.42)]">
      <button
        type="button"
        aria-label={t(msg`关闭确认弹层`)}
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative rounded-t-[22px] bg-white pb-[calc(env(safe-area-inset-bottom,0px))] shadow-[0_-12px_32px_rgba(15,23,42,0.16)]">
        <div className="px-5 pb-5 pt-6">
          <div className="text-[16px] font-medium text-[color:var(--text-primary)]">
            {title}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-[color:var(--text-muted)]">
            {description}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[color:var(--border-faint)] px-5 py-4">
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
            className="h-11 rounded-[12px] text-[15px]"
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={pending}
            className="h-11 rounded-[12px] border-[color:var(--border-faint)] bg-white text-[15px] shadow-none"
          >
            {t(msg`取消`)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnsavedSheet({
  open,
  pending,
  onClose,
  onDiscard,
  onSave,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useRuntimeTranslator();
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(17,24,39,0.42)]">
      <button
        type="button"
        aria-label={t(msg`关闭未保存提示`)}
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative rounded-t-[22px] bg-white pb-[calc(env(safe-area-inset-bottom,0px))] shadow-[0_-12px_32px_rgba(15,23,42,0.16)]">
        <div className="px-5 pb-5 pt-6">
          <div className="text-[16px] font-medium text-[color:var(--text-primary)]">
            {t(msg`这条笔记还没有保存`)}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-[color:var(--text-muted)]">
            {t(msg`保存后会进入收藏；如果直接关闭，当前草稿改动会被丢弃。`)}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[color:var(--border-faint)] px-5 py-4">
          <Button
            variant="primary"
            onClick={onSave}
            disabled={pending}
            className="h-11 rounded-[12px] bg-[color:var(--brand-primary)] text-[15px] text-white hover:opacity-95"
          >
            {pending ? t(msg`保存中...`) : t(msg`保存并关闭`)}
          </Button>
          <Button
            variant="danger"
            onClick={onDiscard}
            disabled={pending}
            className="h-11 rounded-[12px] text-[15px]"
          >
            {t(msg`不保存`)}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={pending}
            className="h-11 rounded-[12px] border-[color:var(--border-faint)] bg-white text-[15px] shadow-none"
          >
            {t(msg`继续编辑`)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function hashWithoutLeading(value: string) {
  return value.startsWith("#") ? value.slice(1) : value;
}
