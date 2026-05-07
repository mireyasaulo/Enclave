import { useState } from "react";
import { msg } from "@lingui/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { translateRuntimeMessage } from "@yinjie/i18n";
import {
  Button,
  Card,
  ErrorBlock,
  LoadingBlock,
  StatusPill,
  TextAreaField,
  TextField,
} from "@yinjie/ui";
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import {
  wikiApi,
  type WikiTalkPost,
  type WikiTalkThread,
} from "../lib/wiki-api";

export function TalkPanel({ characterId }: { characterId: string }) {
  const t = translateRuntimeMessage;
  const { user } = useAuth();
  const qc = useQueryClient();
  const threadsQ = useQuery({
    queryKey: ["wiki", "talk", characterId, "threads"],
    queryFn: () => wikiApi.listThreads(characterId),
  });
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "" });

  const newThreadMut = useMutation({
    mutationFn: () => wikiApi.createThread(characterId, draft.title, draft.body),
    onSuccess: (res) => {
      void qc.invalidateQueries({
        queryKey: ["wiki", "talk", characterId, "threads"],
      });
      setShowNew(false);
      setDraft({ title: "", body: "" });
      setOpenThreadId(res.thread.id);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-medium">
          <Trans>讨论页</Trans>
        </h2>
        {user && (
          <Button
            size="sm"
            variant="primary"
            className="ml-auto"
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? t(msg`取消`) : t(msg`新建话题`)}
          </Button>
        )}
      </div>

      {showNew && user && (
        <Card className="p-3 space-y-2">
          <label className="block text-sm">
            <span className="block mb-1">
              <Trans>标题</Trans>
            </span>
            <TextField
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={200}
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1">
              <Trans>正文</Trans>
            </span>
            <TextAreaField
              rows={4}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <Button
            variant="primary"
            disabled={
              !draft.title.trim() || !draft.body.trim() || newThreadMut.isPending
            }
            onClick={() => newThreadMut.mutate()}
          >
            {newThreadMut.isPending ? t(msg`发布中...`) : t(msg`发布`)}
          </Button>
          {newThreadMut.isError && (
            <ErrorBlock message={(newThreadMut.error as Error).message} />
          )}
        </Card>
      )}

      {threadsQ.isLoading && <LoadingBlock />}
      {threadsQ.isError && (
        <ErrorBlock message={(threadsQ.error as Error).message} />
      )}
      {threadsQ.data?.length === 0 && (
        <Card className="p-4 text-sm text-[var(--text-muted)]">
          <Trans>还没有任何讨论。</Trans>
        </Card>
      )}
      <ul className="space-y-2">
        {threadsQ.data?.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            isOpen={openThreadId === thread.id}
            onToggle={() =>
              setOpenThreadId(openThreadId === thread.id ? null : thread.id)
            }
          />
        ))}
      </ul>
    </div>
  );
}

function ThreadCard({
  thread,
  isOpen,
  onToggle,
}: {
  thread: WikiTalkThread;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="p-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="font-medium">{thread.title}</span>
        {thread.isLocked && (
          <StatusPill>
            <Trans>已锁定</Trans>
          </StatusPill>
        )}
        {thread.isResolved && (
          <StatusPill>
            <Trans>已解决</Trans>
          </StatusPill>
        )}
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          <Trans>
            {thread.postCount} 条 · 最近{" "}
            {thread.lastReplyAt
              ? new Date(thread.lastReplyAt).toLocaleString()
              : "—"}
          </Trans>
        </span>
      </button>
      {isOpen && <ThreadDetail threadId={thread.id} thread={thread} />}
    </Card>
  );
}

function ThreadDetail({
  threadId,
  thread,
}: {
  threadId: string;
  thread: WikiTalkThread;
}) {
  const t = translateRuntimeMessage;
  const { user } = useAuth();
  const qc = useQueryClient();
  const postsQ = useQuery({
    queryKey: ["wiki", "talk", "posts", threadId],
    queryFn: () => wikiApi.listPosts(threadId),
  });
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const replyMut = useMutation({
    mutationFn: () => wikiApi.createPost(threadId, reply, replyTo),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["wiki", "talk", "posts", threadId],
      });
      void qc.invalidateQueries({
        queryKey: ["wiki", "talk", thread.characterId, "threads"],
      });
      setReply("");
      setReplyTo(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (postId: string) => wikiApi.deletePost(postId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["wiki", "talk", "posts", threadId] }),
  });
  const flagsMut = useMutation({
    mutationFn: (flags: { isLocked?: boolean; isResolved?: boolean }) =>
      wikiApi.setThreadFlags(threadId, flags),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["wiki", "talk", thread.characterId, "threads"],
      }),
  });

  const isPatroller = hasRole(user, "patroller");

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
      {isPatroller && (
        <div className="flex gap-2 text-xs">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => flagsMut.mutate({ isLocked: !thread.isLocked })}
          >
            {thread.isLocked ? t(msg`解锁`) : t(msg`锁定`)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => flagsMut.mutate({ isResolved: !thread.isResolved })}
          >
            {thread.isResolved ? t(msg`标记未解决`) : t(msg`标记已解决`)}
          </Button>
        </div>
      )}
      {postsQ.isLoading && <LoadingBlock />}
      {postsQ.isError && (
        <ErrorBlock message={(postsQ.error as Error).message} />
      )}
      <PostTree
        posts={postsQ.data ?? []}
        onReply={(postId) => setReplyTo(postId)}
        onDelete={(postId) => {
          if (window.confirm(t(msg`确认删除这条回复？删除后会标记为「已删除」。`))) {
            deleteMut.mutate(postId);
          }
        }}
        canDelete={(post) =>
          (user?.id === post.authorId || isPatroller) && !post.deletedAt
        }
      />
      {user && !thread.isLocked && (
        <div className="space-y-2 pt-2">
          {replyTo && (
            <div className="text-xs text-[var(--text-muted)]">
              <Trans>回复楼中楼 · {replyTo.slice(0, 8)}…</Trans>{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setReplyTo(null)}
              >
                <Trans>取消引用</Trans>
              </button>
            </div>
          )}
          <TextAreaField
            rows={3}
            placeholder={t(msg`写下你的回复`)}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={!reply.trim() || replyMut.isPending}
            onClick={() => replyMut.mutate()}
          >
            {replyMut.isPending ? t(msg`回复中...`) : t(msg`回复`)}
          </Button>
          {replyMut.isError && (
            <ErrorBlock message={(replyMut.error as Error).message} />
          )}
        </div>
      )}
    </div>
  );
}

function PostTree({
  posts,
  onReply,
  onDelete,
  canDelete,
  parentId = null,
  depth = 0,
}: {
  posts: WikiTalkPost[];
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: (post: WikiTalkPost) => boolean;
  parentId?: string | null;
  depth?: number;
}) {
  const children = posts.filter((p) => (p.parentPostId ?? null) === parentId);
  if (children.length === 0) return null;
  return (
    <ul className="space-y-2">
      {children.map((post) => (
        <li
          key={post.id}
          className="text-sm border-l-2 border-[var(--border-subtle)] pl-3"
          style={{ marginLeft: depth * 16 }}
        >
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <strong className="text-[var(--text-primary)]">
              {post.authorId.slice(0, 8)}
            </strong>
            <span>{new Date(post.createdAt).toLocaleString()}</span>
            {post.deletedAt && (
              <StatusPill>
                <Trans>已删除</Trans>
              </StatusPill>
            )}
            {!post.deletedAt && (
              <>
                <button
                  type="button"
                  className="underline ml-auto hover:text-[var(--text-primary)]"
                  onClick={() => onReply(post.id)}
                >
                  <Trans>回复</Trans>
                </button>
                {canDelete(post) && (
                  <button
                    type="button"
                    className="underline hover:text-[var(--state-danger-text)]"
                    onClick={() => onDelete(post.id)}
                  >
                    <Trans>删除</Trans>
                  </button>
                )}
              </>
            )}
          </div>
          <div className="mt-1 whitespace-pre-wrap">{post.body}</div>
          <PostTree
            posts={posts}
            onReply={onReply}
            onDelete={onDelete}
            canDelete={canDelete}
            parentId={post.id}
            depth={depth + 1}
          />
        </li>
      ))}
    </ul>
  );
}
