import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppSection,
  Button,
  ErrorBlock,
  InlineNotice,
  LoadingBlock,
  PanelEmpty,
  StatusPill,
  TextField,
} from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiBlockRow } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";
import { FormRow } from "../components/form-row";

export function AdminBlocksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showRevoked, setShowRevoked] = useState(false);
  const blocksQ = useQuery({
    queryKey: ["wiki", "blocks", showRevoked],
    queryFn: () => wikiApi.listBlocks({ active: !showRevoked }),
  });
  const usersQ = useQuery({
    queryKey: ["wiki", "users"],
    queryFn: () => wikiApi.listUsers(),
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

  const usersById = new Map((usersQ.data ?? []).map((u) => [u.id, u.username]));
  const currentUserId = user?.id;

  return (
    <PageShell
      eyebrow="管理"
      title="封禁管理"
      description="对违规用户进行全站、单条目或讨论范围的封禁，可设置到期时间或永久。已撤销/到期的记录可勾选展示。"
    >
      <AppSection className="space-y-4">
        <h2 className="text-base font-semibold">新增封禁</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FormRow label="目标用户" required>
            <select
              className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm shadow-[var(--shadow-soft)] focus:border-[color:var(--brand-primary)] focus:outline-none"
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
          </FormRow>
          <FormRow label="范围" required>
            <select
              className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm shadow-[var(--shadow-soft)] focus:border-[color:var(--brand-primary)] focus:outline-none"
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
          </FormRow>
          {form.scope === "page" && (
            <FormRow label="条目 ID" required className="md:col-span-2">
              <TextField
                value={form.targetCharacterId}
                onChange={(e) =>
                  setForm({ ...form, targetCharacterId: e.target.value })
                }
                placeholder="例如：char-celebrity-andrej-karpathy"
              />
            </FormRow>
          )}
          <FormRow label="原因" required className="md:col-span-2">
            <TextField
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="说明为什么对此用户/范围执行封禁"
            />
          </FormRow>
          <FormRow
            label="到期时间"
            hint="可选 ISO 时间，留空 = 永久"
            className="md:col-span-2"
          >
            <TextField
              value={form.expiresAt}
              onChange={(e) =>
                setForm({ ...form, expiresAt: e.target.value })
              }
              placeholder="2026-06-01T00:00:00Z"
            />
          </FormRow>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
                  form.scope === "page"
                    ? form.targetCharacterId.trim()
                    : undefined,
                reason: form.reason.trim(),
                expiresAt: form.expiresAt.trim() || null,
              })
            }
          >
            {blockMut.isPending ? "提交中..." : "提交封禁"}
          </Button>
          {blockMut.isError && (
            <span className="text-sm text-[color:var(--state-danger-text)]">
              {(blockMut.error as Error).message}
            </span>
          )}
        </div>
      </AppSection>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold">封禁列表</h2>
        <label className="ml-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-1.5 text-sm shadow-[var(--shadow-soft)]">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(e) => setShowRevoked(e.target.checked)}
          />
          含已撤销 / 已到期
        </label>
      </div>
      {blocksQ.isLoading && <LoadingBlock />}
      {blocksQ.isError && (
        <ErrorBlock message={(blocksQ.error as Error).message} />
      )}
      {revokeMut.isError && (
        <InlineNotice tone="danger">
          {(revokeMut.error as Error).message}
        </InlineNotice>
      )}
      {blocksQ.data?.length === 0 && (
        <PanelEmpty message="没有相关封禁记录。" />
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
    </PageShell>
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
    <li className="flex items-start gap-3 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[color:var(--surface-card-hover)]">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[color:var(--text-primary)]">
            {username}
          </strong>
          <StatusPill>{block.scope}</StatusPill>
          {isActive ? (
            <StatusPill>生效中</StatusPill>
          ) : block.revokedAt ? (
            <StatusPill>已撤销</StatusPill>
          ) : (
            <StatusPill>已到期</StatusPill>
          )}
          {block.targetCharacterId && (
            <span className="text-xs text-[color:var(--text-muted)]">
              {block.targetCharacterId}
            </span>
          )}
        </div>
        <div>{block.reason}</div>
        <div className="text-xs text-[color:var(--text-muted)]">
          创建于 {new Date(block.createdAt).toLocaleString()}
          {block.expiresAt &&
            ` · 到期 ${new Date(block.expiresAt).toLocaleString()}`}
          {block.revokedAt &&
            ` · 撤销于 ${new Date(block.revokedAt).toLocaleString()}`}
        </div>
      </div>
      {isActive && (
        <Button
          size="sm"
          variant="secondary"
          disabled={revoking}
          onClick={onRevoke}
        >
          撤销
        </Button>
      )}
    </li>
  );
}
