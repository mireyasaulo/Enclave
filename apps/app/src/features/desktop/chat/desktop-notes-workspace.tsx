import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage, useRuntimeTranslator } from "@yinjie/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  isNoteContentEmpty,
  mergeNoteAssets,
  normalizeEditorHtml,
  shouldDiscardEmptyDraftForApi,
  removeFavoriteNoteRecord,
  removeFavoriteNoteSummary,
  resolveNoteTitle,
  upsertFavoriteNoteRecord,
  upsertFavoriteNoteSummary,
  type NoteEditorState,
} from "../../favorites/note-editor-helpers";
import { Button, ErrorBlock, InlineNotice, LoadingBlock, cn } from "@yinjie/ui";
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
import { useNavigate } from "@tanstack/react-router";
import { isPersistedGroupConversation } from "../../../lib/conversation-route";
import { resolveDesktopWindowReturnTarget } from "../../../lib/desktop-window-return-target";
import { navigateBackOrFallback } from "../../../lib/history-back";
import { emitChatMessage, joinConversationRoom } from "../../../lib/socket";
import { useAppRuntimeConfig } from "../../../runtime/runtime-config-store";
import {
  closeCurrentDesktopWindow,
  focusMainDesktopWindow,
  focusStandaloneDesktopWindow,
} from "../../../runtime/desktop-windowing";
import {
  clearDesktopNoteDraft,
  createDesktopNoteDraft,
  readDesktopNoteDraft,
  readDesktopNoteDraftByNoteId,
  saveDesktopNoteDraft,
} from "./desktop-notes-storage";
import { DesktopChatConfirmDialog } from "./desktop-chat-confirm-dialog";
import {
  DesktopNoteSendDialog,
  type DesktopNoteSendDialogNote,
} from "./desktop-note-send-dialog";

type DesktopNotesWorkspaceProps = {
  selectedNoteId?: string;
  draftId?: string;
  standaloneWindow?: boolean;
  returnTo?: string;
  onSavedNote?: (noteId: string, draftId: string) => void;
};

type NoteNotice = {
  tone: "success" | "danger";
  message: string;
};

export function DesktopNotesWorkspace({
  selectedNoteId,
  draftId,
  standaloneWindow = false,
  returnTo,
  onSavedNote,
}: DesktopNotesWorkspaceProps) {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedSessionKeyRef = useRef("");
  // 用户点"保存"后接着点"返回"：保存这边 mutateAsync 还在飞，DesktopNotesWorkspace
  // 已经被 unmount（noteEditorRouteState 变 null，FavoritesPage 切回列表视图）。
  // saveMutation.onSuccess 仍然会在 mutateFn 收到响应时 fire，里面的
  // onSavedNote?.(savedNote.id, nextDraftId) 会让父组件 navigate({...replace:true})
  // 把 URL 写回 #draftId=...&noteId=... → 用户被"弹"回编辑器，体验是
  // "我明明点了返回，编辑器自己跳回来了"。
  // 标记 unmount 后跳过 onSavedNote 即可——setQueryData / 草稿落盘等本地副作用
  // 仍然执行，列表能正确反映新存的笔记，但不再强行把用户拽回编辑器。
  const unmountedRef = useRef(false);
  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );
  const [noteId, setNoteId] = useState(selectedNoteId);
  const [activeDraftId, setActiveDraftId] = useState(
    () => draftId?.trim() || selectedNoteId?.trim() || "",
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [attachmentPending, setAttachmentPending] = useState(false);
  const [sendDialogNote, setSendDialogNote] =
    useState<DesktopNoteSendDialogNote | null>(null);

  const noteQuery = useQuery({
    queryKey: ["favorite-note", baseUrl, selectedNoteId],
    queryFn: () => getFavoriteNote(selectedNoteId!, baseUrl),
    enabled: Boolean(selectedNoteId),
  });
  const recentConversationsQuery = useQuery({
    queryKey: ["desktop-note-send-conversations", baseUrl],
    queryFn: () => getConversations(baseUrl),
    enabled: Boolean(sendDialogNote),
  });

  const sessionKey = `${selectedNoteId ?? "new"}:${draftId ?? ""}`;
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
      const nextDraftId = activeDraftId || draftId?.trim() || savedNote.id;
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

      // 见 unmountedRef 注释：用户点保存后又点了返回时，别再 navigate 回编辑器。
      if (unmountedRef.current) {
        return;
      }
      onSavedNote?.(savedNote.id, nextDraftId);
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message:
          error instanceof Error ? error.message : t(msg`保存失败，请稍后再试。`),
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

      void handleClose();
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message:
          error instanceof Error ? error.message : t(msg`删除失败，请稍后再试。`),
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
      draftId,
      noteId: selectedNoteId,
    });
    setActiveDraftId(draft.draftId);
  }, [activeDraftId, draftId, selectedNoteId]);

  useEffect(() => {
    const nextDraftId =
      activeDraftId || draftId?.trim() || selectedNoteId?.trim() || "";
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
      // 草稿是空的且 API 还没回，等一下：API 一旦带回真实正文，
      // shouldDiscardEmptyDraftForApi 会把空草稿丢掉走 API 分支回填。
      // 否则现在用空 state 初始化 + initializedSessionKeyRef 锁住会让
      // 后续 noteQuery.data 落地时 effect 早退，原文永远不回填。
      if (
        localDraft &&
        isNoteContentEmpty(localDraft) &&
        !missingSelectedNote &&
        noteQuery.isLoading &&
        !noteQuery.data
      ) {
        return;
      }
      if (localDraft) {
        const treatLocalDraftAsNewNote = Boolean(missingSelectedNote);
        applyNoteSource({
          draftId: localDraft.draftId,
          noteId: treatLocalDraftAsNewNote ? undefined : selectedNoteId,
          state: buildEditorStateFromDraft(localDraft),
          savedSource: treatLocalDraftAsNewNote ? null : (noteQuery.data ?? null),
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
    draftId,
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
    }, 180);

    return () => window.clearTimeout(timer);
  }, [activeDraftId, editorState, noteId, sessionKey]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const title = isDirty
      ? t(msg`${noteTitle} · 未保存`)
      : noteTitle;
    document.title = title;
  }, [isDirty, noteTitle, t]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

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
          // 收藏笔记可能塞二三十张图，loading=lazy + decoding=async 避免重新打开
          // 这条笔记时一次性同步解码全部 img；编辑器内即时插入的图也走一遍
          // 异步解码，不阻塞 contentEditable 主循环。
          document.execCommand(
            "insertHTML",
            false,
            `<p><img data-note-image="true" data-note-asset-id="${assetId}" src="${escapeHtmlAttribute(
              attachment.url,
            )}" alt="${escapeHtmlAttribute(
              attachment.fileName,
            )}" loading="lazy" decoding="async" /></p><p><br></p>`,
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
    // 用户可能误打 ## 或 ###，把所有前导 # 都剥掉，否则只剥一个会留 "#"，
    // 显示成 "##xxx" 看着像 bug。
    const normalizedTag = tagInput.trim().replace(/^#+/, "");
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
    // 不挡空保存的话，用户点保存按钮 / Ctrl+S，后端就会落一条
    // title=无标题笔记 contentText="" 的废笔记。挡的标准跟下方 requestSend
    // 的 hasSendableContent 对齐——只看正文或附件，标签无法独立成笔记。
    const hasContent =
      Boolean(editorState.contentText.trim()) || editorState.assets.length > 0;
    if (!hasContent) {
      setNotice({
        tone: "danger",
        message: t(msg`先写点内容或加个附件再保存。`),
      });
      return null;
    }
    try {
      const savedNote = await saveMutation.mutateAsync();
      return savedNote;
    } catch {
      return null;
    }
  }, [editorState, saveMutation, t]);

  const handleClose = useCallback(async () => {
    const fallbackPath = returnTo || "/tabs/favorites";
    if (standaloneWindow) {
      const closed = await closeCurrentDesktopWindow();
      if (closed) {
        return;
      }

      closeCurrentWindow(() => {
        void focusReturnTargetWindow(fallbackPath);
      });
      return;
    }

    // 优先走浏览器 history.back，失败再 replace 到 fallbackPath。
    // 必须 replace，否则直接打开 /notes/new#... 的 URL（history.length=1）
    // 走 push 会把编辑器 URL 留在 history 里，浏览器 back → 又回到编辑器 → 再 push → 死循环。
    navigateBackOrFallback(
      () => {
        void navigate({ to: fallbackPath, replace: true });
      },
      fallbackPath,
    );
  }, [navigate, returnTo, standaloneWindow]);

  async function handleSaveAndClose() {
    const savedNote = await handleSave();
    if (!savedNote) {
      return;
    }

    setCloseDialogOpen(false);
    await handleClose();
  }

  async function handleDiscardAndClose() {
    if (activeDraftId) {
      clearDesktopNoteDraft(activeDraftId);
    }

    setCloseDialogOpen(false);
    await handleClose();
  }

  const requestClose = useCallback(() => {
    if (isDirty) {
      setCloseDialogOpen(true);
      return;
    }

    // 跟 mobile-note-editor-page 73367df0 对齐：点"新建笔记"进编辑器
    // openInlineNoteEditor 已经 createDesktopNoteDraft() 占了一份 draftId；
    // 用户没编辑就 ← 返回时这里清掉空草稿，否则 localStorage 一直攒。
    // 已保存（有 noteId）的草稿当缓存留下，下次还能恢复。
    if (!noteId && activeDraftId && isNoteContentEmpty(editorState)) {
      clearDesktopNoteDraft(activeDraftId);
    }

    void handleClose();
  }, [activeDraftId, editorState, handleClose, isDirty, noteId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const withCommand = event.metaKey || event.ctrlKey;
      if (withCommand && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      if (tagEditorOpen) {
        event.preventDefault();
        setTagEditorOpen(false);
        setTagInput("");
        return;
      }

      if (standaloneWindow && !deleteDialogOpen && !closeDialogOpen) {
        event.preventDefault();
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeDialogOpen,
    deleteDialogOpen,
    handleSave,
    requestClose,
    standaloneWindow,
    tagEditorOpen,
  ]);

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
      <div className="flex h-full items-center justify-center bg-[color:var(--bg-canvas)]">
        <LoadingBlock label={t(msg`正在读取笔记...`)} />
      </div>
    );
  }

  if (
    selectedNoteId &&
    noteQuery.isError &&
    !readDesktopNoteDraftByNoteId(selectedNoteId)
  ) {
    return (
      <div className="flex h-full items-center justify-center bg-[color:var(--bg-canvas)] p-6">
        <div className="w-full max-w-xl rounded-[20px] border border-[color:var(--border-faint)] bg-white p-6 shadow-[var(--shadow-card)]">
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
              onClick={() => void handleClose()}
              className="rounded-[10px] border-[color:var(--border-faint)] bg-white shadow-none"
            >
              {t(msg`回到来源`)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#f7f8f8_0%,#eef1f0_100%)]">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleAttachmentSelection(event.target.files)}
      />

      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[color:var(--border-faint)] bg-[rgba(255,255,255,0.9)] px-5 py-4 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {!standaloneWindow ? (
              <button
                type="button"
                onClick={requestClose}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[color:var(--text-secondary)] transition hover:bg-white hover:text-[color:var(--text-primary)]"
                aria-label={t(msg`返回收藏`)}
              >
                <ArrowLeft size={16} />
              </button>
            ) : null}
            <div className="truncate text-[16px] font-medium text-[color:var(--text-primary)]">
              {noteTitle}
            </div>
          </div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            {saveMutation.isPending
              ? t(msg`正在保存到收藏...`)
              : isDirty
                ? t(msg`存在未保存修改`)
                : noteId
                  ? t(msg`已保存到收藏`)
                  : t(msg`新建笔记`)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {noteId ? (
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[color:var(--border-faint)] bg-white px-3 text-[13px] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-console)] hover:text-[color:var(--state-danger-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={15} />
              {t(msg`删除`)}
            </button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => void requestSend()}
            disabled={saveMutation.isPending || sendMutation.isPending}
            className="h-9 rounded-[10px] border-[color:var(--border-faint)] bg-white px-4 shadow-none hover:bg-[color:var(--surface-console)]"
          >
            <Send size={15} />
            {sendMutation.isPending ? t(msg`发送中...`) : t(msg`发送`)}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={saveMutation.isPending}
            className="h-9 rounded-[10px] bg-[color:var(--brand-primary)] px-4 text-white hover:opacity-95"
          >
            <Save size={15} />
            {saveMutation.isPending ? t(msg`保存中...`) : t(msg`保存`)}
          </Button>
          {standaloneWindow ? (
            <button
              type="button"
              onClick={requestClose}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[color:var(--border-faint)] bg-white text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]"
              aria-label={t(msg`关闭笔记窗口`)}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[color:var(--border-faint)] bg-[rgba(255,255,255,0.78)] px-5 py-3 backdrop-blur-xl">
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
            {t(msg`正在上传附件...`)}
          </span>
        ) : null}
      </div>

      {tagEditorOpen || editorState.tags.length ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[color:var(--border-faint)] bg-[rgba(255,255,255,0.72)] px-5 py-3">
          {editorState.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[rgba(7,193,96,0.08)] px-3 py-1 text-[12px] text-[color:var(--brand-primary)]"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-[color:var(--brand-primary)] transition hover:bg-[rgba(7,193,96,0.12)]"
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
                className="h-9 w-[180px] rounded-[10px] border border-[color:var(--border-faint)] bg-white px-3 text-[13px] text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--brand-primary)]"
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

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        {notice ? (
          <div className="mx-auto mb-4 w-full max-w-[840px]">
            <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice>
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-[840px] flex-col rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white px-10 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-center gap-2 text-[11px] tracking-[0.12em] text-[color:var(--text-dim)]">
            <span className="rounded-full border border-[rgba(15,23,42,0.08)] px-2 py-1">
              {t(msg`收藏笔记`)}
            </span>
            <span>{noteId ? t(msg`已保存文稿`) : t(msg`未保存草稿`)}</span>
          </div>
          <div className="relative">
            {!editorState.contentText.trim() && !editorState.assets.length ? (
              // 之前只挡 contentText.trim() 为空，但 extractNoteTextFromHtml
              // 对"只有图片/附件"的 HTML 抽出来的文本就是 ""，结果用户插了图
              // 还没写字时，"写点什么。支持富文本…" 占位符仍旧浮在编辑器左上
              // 角，跟刚插的图叠在一起视觉很脏。补一刀 assets.length，凡是
              // 编辑器里已经有附件就别再显示空状态文案了。
              <div className="pointer-events-none absolute left-0 top-0 text-[15px] leading-8 text-[color:var(--text-dim)]">
                {noteQuery.isLoading
                  ? t(msg`加载笔记中…`)
                  : t(msg`写点什么。支持富文本、待办、图片和文件。`)}
              </div>
            ) : null}
            <div
              ref={editorRef}
              contentEditable={!noteQuery.isLoading}
              suppressContentEditableWarning
              onInput={syncEditorStateFromDom}
              onClick={handleEditorClick}
              className={cn(
                "min-h-[560px] outline-none",
                "text-[15px] leading-8 text-[color:var(--text-primary)]",
                "[&_a[data-note-file='true']]:inline-flex [&_a[data-note-file='true']]:items-center [&_a[data-note-file='true']]:rounded-[12px] [&_a[data-note-file='true']]:border [&_a[data-note-file='true']]:border-[rgba(15,23,42,0.08)] [&_a[data-note-file='true']]:bg-[rgba(243,244,246,0.82)] [&_a[data-note-file='true']]:px-3 [&_a[data-note-file='true']]:py-2 [&_a[data-note-file='true']]:text-[13px] [&_a[data-note-file='true']]:text-[color:var(--text-primary)] [&_a[data-note-file='true']]:no-underline",
                "[&_img[data-note-image='true']]:my-3 [&_img[data-note-image='true']]:max-h-[420px] [&_img[data-note-image='true']]:max-w-full [&_img[data-note-image='true']]:rounded-[18px] [&_img[data-note-image='true']]:border [&_img[data-note-image='true']]:border-[rgba(15,23,42,0.08)]",
                "[&_[data-note-checkbox='false']]:cursor-pointer [&_[data-note-checkbox='true']]:cursor-pointer [&_[data-note-checkbox='true']]:text-[color:var(--brand-primary)]",
              )}
            />
          </div>
        </div>
      </div>

      <DesktopChatConfirmDialog
        open={deleteDialogOpen}
        title={t(msg`删除笔记`)}
        description={t(msg`删除后，这条收藏笔记会从收藏列表中移除。`)}
        confirmLabel={t(msg`删除`)}
        pendingLabel={t(msg`正在删除...`)}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void deleteMutation.mutateAsync()}
      />

      <DesktopNoteUnsavedDialog
        open={closeDialogOpen}
        pending={saveMutation.isPending}
        onClose={() => setCloseDialogOpen(false)}
        onDiscard={() => void handleDiscardAndClose()}
        onSave={() => void handleSaveAndClose()}
      />

      <DesktopNoteSendDialog
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
    </div>
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
        "inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[13px] transition",
        active
          ? "border-[rgba(7,193,96,0.16)] bg-[rgba(7,193,96,0.08)] text-[color:var(--brand-primary)]"
          : "border-[color:var(--border-faint)] bg-white text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-console)] hover:text-[color:var(--text-primary)]",
      )}
      aria-label={label}
      title={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function DesktopNoteUnsavedDialog({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.28)] p-6 backdrop-blur-[3px]">
      <button
        type="button"
        aria-label={t(msg`关闭未保存提示`)}
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[20px] border border-[color:var(--border-faint)] bg-white/96 shadow-[var(--shadow-overlay)]">
        <div className="border-b border-[color:var(--border-faint)] px-6 py-5">
          <div className="text-[18px] font-medium text-[color:var(--text-primary)]">
            {t(msg`这条笔记还没有保存`)}
          </div>
          <div className="mt-2 text-[13px] leading-7 text-[color:var(--text-muted)]">
            {t(msg`保存后会进入收藏；如果直接关闭，当前草稿改动会被丢弃。`)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={pending}
            className="rounded-[10px] border-[color:var(--border-faint)] bg-white px-5 shadow-none"
          >
            {t(msg`取消`)}
          </Button>
          <Button
            variant="danger"
            onClick={onDiscard}
            disabled={pending}
            className="rounded-[10px] px-5"
          >
            {t(msg`不保存`)}
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={pending}
            className="rounded-[10px] bg-[color:var(--brand-primary)] px-5 text-white hover:opacity-95"
          >
            {pending ? t(msg`保存中...`) : t(msg`保存并关闭`)}
          </Button>
        </div>
      </div>
    </div>
  );
}


async function focusReturnTargetWindow(targetPath: string) {
  if (typeof window === "undefined") {
    return;
  }

  const resolvedTarget = resolveDesktopWindowReturnTarget(targetPath);
  if (resolvedTarget.standaloneWindowLabel) {
    const focusedStandalone = await focusStandaloneDesktopWindow(
      resolvedTarget.standaloneWindowLabel,
      targetPath,
    );
    if (focusedStandalone) {
      void closeCurrentDesktopWindow();
      return;
    }
  }

  const nextMainWindowPath = resolvedTarget.mainWindowPath || targetPath;

  void focusMainDesktopWindow(nextMainWindowPath).then((focused) => {
    if (focused) {
      void closeCurrentDesktopWindow();
      return;
    }

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.location.assign(nextMainWindowPath);
        window.opener.focus?.();
        closeCurrentWindow();
        return;
      }
    } catch {
      // Ignore opener access failures and fall back to local navigation.
    }

    window.location.assign(nextMainWindowPath);
  });
}

function closeCurrentWindow(onBlocked?: () => void) {
  window.close();

  if (!onBlocked) {
    return;
  }

  window.setTimeout(() => {
    if (!window.closed) {
      onBlocked();
    }
  }, 120);
}
