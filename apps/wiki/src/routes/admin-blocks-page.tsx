import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  ErrorBlock,
  LoadingBlock,
  StatusPill,
  TextField,
} from "@yinjie/ui";
import { hasRole } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiBlockRow } from "../lib/wiki-api";

export function AdminBlocksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showRevoked, setShowRevoked] = useState(false);
  const blocksQ = useQuery({
    queryKey: ["wiki", "blocks", showRevoked],
    queryFn: () => wikiApi.listBlocks({ active: !showRevoked }),
    enabled: hasRole(user, "admin"),
  });
  const usersQ = useQuery({
    queryKey: ["wiki", "users"],
    queryFn: () => wikiApi.listUsers(),
    enabled: hasRole(user, "admin"),
  });
  const blockMut = useMutation({
    mutationFn: wikiApi.blockUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki", "blocks"] }),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => wikiApi.revokeBlock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki", "blocks"] }),
  });

  const [form, setForm] = useState<{
    userId: string;
    scope: "global" | "page" | "talk";
    targetCharacterId: string;
    reason: string;
    expiresAt: string;
  }>({
    userId: "",
    scope: "global",
    targetCharacterId: "",
    reason: "",
    expiresAt: "",
  });

  if (!user || !hasRole(user, "admin")) {
    return (
      <Card className="p-6">
        <p>仅管理员可访问。</p>
      </Card>
    );
  }

  const usersById = new Map((usersQ.data ?? []).map((u) => [u.id, u.username]));
  const currentUserId = user.id;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">封禁管理</h1>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">新增封禁</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block mb-1">目标用户</span>
            <select
              className="w-full border rounded px-2 py-2 bg-white"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
            >
              <option value="">— 选择用户 —</option>
              {(usersQ.data ?? [])
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}（{u.role}）
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block mb-1">范围</span>
            <select
              className="w-full border rounded px-2 py-2 bg-white"
              value={form.scope}
              onChange={(e) =>
                setForm({
                  ...form,
                  scope: e.target.value as typeof form.scope,
                })
              }
            >
              <option value="global">全站</option>
              <option value="page">单条目</option>
              <option value="talk">讨论</option>
            </select>
          </label>
          {form.scope === "page" && (
            <label className="block text-sm md:col-span-2">
              <span className="block mb-1">条目 ID</span>
              <TextField
                value={form.targetCharacterId}
                onChange={(e) =>
                  setForm({ ...form, targetCharacterId: e.target.value })
                }
                placeholder="例如：char-celebrity-andrej-karpathy"
              />
            </label>
          )}
          <label className="block text-sm md:col-span-2">
            <span className="block mb-1">原因（必填）</span>
            <TextField
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1">到期时间（可选 ISO，如 2026-06-01T00:00:00Z）</span>
            <TextField
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              placeholder="留空 = 永久"
            />
          </label>
        </div>
        <Button
          variant="danger"
          disabled={
            !form.userId ||
            !form.reason.trim() ||
            (form.scope === "page" && !form.targetCharacterId.trim()) ||
            blockMut.isPending
          }
          onClick={() =>
            blockMut.mutate({
              userId: form.userId,
              scope: form.scope,
              targetCharacterId:
                form.scope === "page" ? form.targetCharacterId.trim() : undefined,
              reason: form.reason.trim(),
              expiresAt: form.expiresAt.trim() || null,
            })
          }
        >
          {blockMut.isPending ? "提交中..." : "封禁"}
        </Button>
        {blockMut.isError && (
          <ErrorBlock message={(blockMut.error as Error).message} />
        )}
      </Card>

      <div className="flex items-center gap-3">
        <h2 className="font-medium">封禁列表</h2>
        <label className="ml-auto text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(e) => setShowRevoked(e.target.checked)}
          />
          含已撤销
        </label>
      </div>
      {blocksQ.isLoading && <LoadingBlock />}
      {blocksQ.isError && (
        <ErrorBlock message={(blocksQ.error as Error).message} />
      )}
      {blocksQ.data?.length === 0 && (
        <Card className="p-4 text-sm text-[var(--text-muted)]">
          没有相关封禁记录。
        </Card>
      )}
      <ul className="space-y-2">
        {blocksQ.data?.map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            username={usersById.get(b.userId) ?? b.userId}
            onRevoke={() => revokeMut.mutate(b.id)}
            revoking={revokeMut.isPending}
          />
        ))}
      </ul>
    </div>
  );
}

function BlockRow({
  block,
  username,
  onRevoke,
  revoking,
}: {
  block: WikiBlockRow;
  username: string;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const isActive =
    !block.revokedAt &&
    (!block.expiresAt || new Date(block.expiresAt) > new Date());
  return (
    <Card className="p-3 flex items-start gap-3 text-sm">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <strong>{username}</strong>
          <StatusPill>{block.scope}</StatusPill>
          {isActive ? (
            <StatusPill>生效中</StatusPill>
          ) : block.revokedAt ? (
            <StatusPill>已撤销</StatusPill>
          ) : (
            <StatusPill>已到期</StatusPill>
          )}
          {block.targetCharacterId && (
            <span className="text-xs text-[var(--text-muted)]">
              {block.targetCharacterId}
            </span>
          )}
        </div>
        <div className="mt-1">{block.reason}</div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          创建于 {new Date(block.createdAt).toLocaleString()}
          {block.expiresAt &&
            ` · 到期 ${new Date(block.expiresAt).toLocaleString()}`}
          {block.revokedAt &&
            ` · 撤销于 ${new Date(block.revokedAt).toLocaleString()}`}
        </div>
      </div>
      {isActive && (
        <Button size="sm" disabled={revoking} onClick={onRevoke}>
          撤销
        </Button>
      )}
    </Card>
  );
}
