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
import { wikiApi } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";
import { FormRow } from "../components/form-row";

export function AdminProtectionPage() {
  const qc = useQueryClient();
  const [characterId, setCharacterId] = useState("");
  const charactersQ = useQuery({
    queryKey: ["wiki", "characters"],
    queryFn: () => wikiApi.listCharacters(),
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

  return (
    <PageShell
      eyebrow="管理"
      title="页面保护"
      description="对单个角色词条设置编辑保护级别和审核策略：无保护 / 半保护（自动确认及以上）/ 完全保护（仅管理员）。"
    >
      <AppSection>
        <FormRow label="选择条目">
          <select
            className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm shadow-[var(--shadow-soft)] focus:border-[color:var(--brand-primary)] focus:outline-none"
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
        </FormRow>
      </AppSection>

      {characterId && (
        <>
          {pageQ.isLoading && <LoadingBlock />}
          {pageQ.isError && (
            <ErrorBlock message={(pageQ.error as Error).message} />
          )}
          {pageQ.data && (
            <AppSection className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[color:var(--text-muted)]">
                  当前级别
                </span>
                <StatusPill>
                  {pageQ.data.page.protectionLevel === "none"
                    ? "无保护"
                    : pageQ.data.page.protectionLevel === "semi"
                      ? "半保护"
                      : "完全保护"}
                </StatusPill>
                <span className="ml-3 text-[color:var(--text-muted)]">
                  审核策略
                </span>
                <StatusPill>
                  {pageQ.data.page.reviewPolicy === "pending_changes"
                    ? "待审变更"
                    : "开放编辑"}
                </StatusPill>
                {pageQ.data.page.protectionLevel !== "none" &&
                  pageQ.data.page.protectionExpiresAt && (
                    <span className="ml-3 text-xs text-[color:var(--text-muted)]">
                      到期：
                      {new Date(
                        pageQ.data.page.protectionExpiresAt,
                      ).toLocaleString()}
                    </span>
                  )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FormRow label="新级别">
                  <select
                    className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm shadow-[var(--shadow-soft)] focus:border-[color:var(--brand-primary)] focus:outline-none"
                    value={form.level}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        level: e.target.value as typeof form.level,
                      })
                    }
                  >
                    <option value="none">无保护</option>
                    <option value="semi">半保护（自动确认+）</option>
                    <option value="full">完全保护（仅管理员）</option>
                  </select>
                </FormRow>
                <FormRow label="审核策略">
                  <select
                    className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-white px-3 py-2 text-sm shadow-[var(--shadow-soft)] focus:border-[color:var(--brand-primary)] focus:outline-none"
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
                </FormRow>
                <FormRow label="到期时间" hint="可选 ISO，留空 = 永久">
                  <TextField
                    value={form.expiresAt}
                    onChange={(e) =>
                      setForm({ ...form, expiresAt: e.target.value })
                    }
                    placeholder="2026-06-01T00:00:00Z"
                  />
                </FormRow>
                <FormRow label="原因">
                  <TextField
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </FormRow>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  disabled={setProtMut.isPending}
                  onClick={() => setProtMut.mutate()}
                >
                  {setProtMut.isPending ? "保存中..." : "应用保护级别"}
                </Button>
                {setProtMut.isError && (
                  <InlineNotice tone="danger" className="flex-1">
                    {(setProtMut.error as Error).message}
                  </InlineNotice>
                )}
              </div>
            </AppSection>
          )}

          <AppSection>
            <h2 className="mb-3 text-base font-semibold">变更历史</h2>
            {logQ.isLoading && <LoadingBlock />}
            {logQ.data?.length === 0 && <PanelEmpty message="暂无记录。" />}
            <ul className="space-y-2">
              {logQ.data?.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-3 py-2 text-sm"
                >
                  <div>
                    <code>{row.oldLevel}</code> → <code>{row.newLevel}</code>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {new Date(row.createdAt).toLocaleString()} · 由{" "}
                    {row.changedBy}
                    {row.expiresAt &&
                      ` · 到期 ${new Date(row.expiresAt).toLocaleString()}`}
                  </div>
                  {row.reason && (
                    <div className="mt-1 text-xs">{row.reason}</div>
                  )}
                </li>
              ))}
            </ul>
          </AppSection>
        </>
      )}
    </PageShell>
  );
}
