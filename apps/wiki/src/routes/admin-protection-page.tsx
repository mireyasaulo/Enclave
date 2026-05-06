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
import { wikiApi } from "../lib/wiki-api";

export function AdminProtectionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [characterId, setCharacterId] = useState("");
  const charactersQ = useQuery({
    queryKey: ["wiki", "characters"],
    queryFn: () => wikiApi.listCharacters(),
    enabled: hasRole(user, "admin"),
  });
  const pageQ = useQuery({
    queryKey: ["wiki", "page", characterId],
    queryFn: () => wikiApi.getPage(characterId),
    enabled: !!characterId,
  });
  const logQ = useQuery({
    queryKey: ["wiki", "protection-log", characterId],
    queryFn: () => wikiApi.protectionLog(characterId),
    enabled: !!characterId,
  });

  const [form, setForm] = useState<{
    level: "none" | "semi" | "full";
    reviewPolicy: "open" | "pending_changes";
    expiresAt: string;
    reason: string;
  }>({ level: "none", reviewPolicy: "open", expiresAt: "", reason: "" });

  const setProtMut = useMutation({
    mutationFn: () =>
      wikiApi.setProtection(characterId, {
        level: form.level,
        reviewPolicy: form.reviewPolicy,
        expiresAt: form.expiresAt.trim() || null,
        reason: form.reason.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wiki", "page", characterId] });
      void qc.invalidateQueries({
        queryKey: ["wiki", "protection-log", characterId],
      });
    },
  });

  if (!hasRole(user, "admin")) {
    return (
      <Card className="p-6">
        <p>仅管理员可访问。</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">页面保护</h1>
      <Card className="p-4">
        <label className="block text-sm">
          <span className="block mb-1">选择条目</span>
          <select
            className="w-full border rounded px-2 py-2 bg-white"
            value={characterId}
            onChange={(e) => {
              setCharacterId(e.target.value);
              setForm({
                level: "none",
                reviewPolicy: "open",
                expiresAt: "",
                reason: "",
              });
            }}
          >
            <option value="">— 选择 —</option>
            {(charactersQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{c.id}）
              </option>
            ))}
          </select>
        </label>
      </Card>

      {characterId && (
        <>
          {pageQ.isLoading && <LoadingBlock />}
          {pageQ.data && (
            <Card className="p-4 space-y-3">
              <div className="text-sm">
                当前级别：
                <StatusPill>
                  {pageQ.data.page.protectionLevel === "none"
                    ? "无保护"
                    : pageQ.data.page.protectionLevel === "semi"
                    ? "半保护"
                    : "完全保护"}
                </StatusPill>
                <span className="ml-2">
                  审核策略：
                  <StatusPill>
                    {pageQ.data.page.reviewPolicy === "pending_changes"
                      ? "待审变更"
                      : "开放编辑"}
                  </StatusPill>
                </span>
                {pageQ.data.page.protectionLevel !== "none" &&
                  pageQ.data.page.protectionExpiresAt && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      到期：
                      {new Date(
                        pageQ.data.page.protectionExpiresAt,
                      ).toLocaleString()}
                    </span>
                  )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="block text-sm">
                  <span className="block mb-1">新级别</span>
                  <select
                    className="w-full border rounded px-2 py-2 bg-white"
                    value={form.level}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        level: e.target.value as typeof form.level,
                      })
                    }
                  >
                    <option value="none">无保护</option>
                    <option value="semi">半保护（仅自动确认+）</option>
                    <option value="full">完全保护（仅管理员）</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="block mb-1">审核策略</span>
                  <select
                    className="w-full border rounded px-2 py-2 bg-white"
                    value={form.reviewPolicy}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        reviewPolicy: e.target
                          .value as typeof form.reviewPolicy,
                      })
                    }
                  >
                    <option value="open">开放编辑</option>
                    <option value="pending_changes">待审变更</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="block mb-1">到期时间（可选 ISO）</span>
                  <TextField
                    value={form.expiresAt}
                    onChange={(e) =>
                      setForm({ ...form, expiresAt: e.target.value })
                    }
                    placeholder="留空 = 永久"
                  />
                </label>
                <label className="block text-sm">
                  <span className="block mb-1">原因</span>
                  <TextField
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
              </div>
              <Button
                variant="primary"
                disabled={setProtMut.isPending}
                onClick={() => setProtMut.mutate()}
              >
                {setProtMut.isPending ? "保存中..." : "应用保护级别"}
              </Button>
              {setProtMut.isError && (
                <ErrorBlock message={(setProtMut.error as Error).message} />
              )}
            </Card>
          )}

          <Card className="p-4">
            <h2 className="font-medium mb-2">变更历史</h2>
            {logQ.isLoading && <LoadingBlock />}
            {logQ.data?.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">暂无记录。</p>
            )}
            <ul className="space-y-2">
              {logQ.data?.map((row) => (
                <li
                  key={row.id}
                  className="text-sm border-b border-[var(--border-subtle)] pb-2 last:border-0"
                >
                  <div>
                    <code>{row.oldLevel}</code> → <code>{row.newLevel}</code>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {new Date(row.createdAt).toLocaleString()} · 由{" "}
                    {row.changedBy}
                    {row.expiresAt &&
                      ` · 到期 ${new Date(row.expiresAt).toLocaleString()}`}
                  </div>
                  {row.reason && (
                    <div className="text-xs mt-1">{row.reason}</div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
