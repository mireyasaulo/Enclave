import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  ErrorBlock,
  LoadingBlock,
  PanelEmpty,
  StatusPill,
} from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const charactersQ = useQuery({
    queryKey: ["wiki", "characters"],
    queryFn: () => wikiApi.listCharacters(),
  });

  const total = charactersQ.data?.length ?? 0;

  return (
    <PageShell
      eyebrow="角色目录"
      title="所有角色词条"
      description="按维基百科模式管理世界角色：任何登录用户都能创建角色、编辑画像和运行逻辑、申请删除或恢复；高风险改动进入巡查队列，通过后才发布到角色运行时。"
      actions={
        user ? (
          <Button
            variant="primary"
            onClick={() => void navigate({ to: "/create" })}
          >
            ✨ 创建角色
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void navigate({ to: "/login" })}
          >
            登录后参与编辑
          </Button>
        )
      }
    >
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
        <span>共 {total} 个词条</span>
        <span className="opacity-50">·</span>
        <span>点击进入查看 / 编辑 / 历史 / 讨论</span>
      </div>

      {charactersQ.isLoading && <LoadingBlock />}
      {charactersQ.isError && (
        <ErrorBlock message={(charactersQ.error as Error).message} />
      )}
      {charactersQ.data && charactersQ.data.length === 0 && (
        <PanelEmpty message="还没有任何角色词条。登录后点右上方“创建角色”开始第一个。" />
      )}
      {charactersQ.data && charactersQ.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {charactersQ.data.map((c) => (
            <li key={c.id}>
              <Link
                to="/character/$characterId"
                params={{ characterId: c.id }}
                className="group flex h-full flex-col gap-2 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] p-4 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} url={c.avatar ?? undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-[color:var(--text-primary)] group-hover:underline">
                      {c.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">
                      {c.relationship} · {c.relationshipType}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.lifecycleStatus !== "active" && (
                    <StatusPill>
                      {c.lifecycleStatus === "pending_create"
                        ? "待创建"
                        : c.lifecycleStatus === "deleted"
                          ? "已删除"
                          : c.lifecycleStatus}
                    </StatusPill>
                  )}
                  {c.protectionLevel !== "none" && (
                    <StatusPill>
                      {c.protectionLevel === "semi" ? "半保护" : "完全保护"}
                    </StatusPill>
                  )}
                  {c.sourceType === "wiki_contributed" && (
                    <StatusPill>社区创建</StatusPill>
                  )}
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                  {c.bio || "（暂无简介）"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
      />
    );
  }
  const initial = name?.[0] ?? "?";
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[image:var(--brand-gradient)] text-base font-semibold text-[color:var(--text-on-brand)]">
      {initial}
    </div>
  );
}
