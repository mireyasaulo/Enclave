import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, ErrorBlock, LoadingBlock, StatusPill } from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const charactersQ = useQuery({
    queryKey: ["wiki", "characters"],
    queryFn: () => wikiApi.listCharacters(),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold mb-2">
            隐界世界角色管理平台
          </h1>
          <p className="text-[var(--text-muted)] leading-relaxed">
            按维基百科模式管理世界角色。任何登录用户都能创建角色、编辑画像和运行逻辑、申请删除或恢复；高风险改动进入巡查队列，通过后才发布到角色运行时。
          </p>
        </div>
        {user && (
          <Button variant="primary" onClick={() => void navigate({ to: "/create" })}>
            创建角色
          </Button>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">所有角色词条</h2>
        {charactersQ.isLoading && <LoadingBlock />}
        {charactersQ.isError && (
          <ErrorBlock message={(charactersQ.error as Error).message} />
        )}
        {charactersQ.data && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {charactersQ.data.map((c) => (
              <li
                key={c.id}
                className="border border-[var(--border-subtle)] rounded p-3 hover:bg-[var(--bg-canvas)]"
              >
                <Link
                  to="/character/$characterId"
                  params={{ characterId: c.id }}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.lifecycleStatus !== "active" && (
                    <StatusPill>
                      {c.lifecycleStatus === "pending_create"
                        ? "待创建"
                        : c.lifecycleStatus}
                    </StatusPill>
                  )}
                  {c.protectionLevel !== "none" && (
                    <StatusPill>{c.protectionLevel}</StatusPill>
                  )}
                  {c.sourceType === "wiki_contributed" && (
                    <StatusPill>社区创建</StatusPill>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  {c.relationship} · {c.relationshipType}
                </div>
                <div className="text-sm mt-2 line-clamp-2">{c.bio}</div>
              </li>
            ))}
            {charactersQ.data.length === 0 && (
              <li className="text-sm text-[var(--text-muted)]">
                还没有任何角色词条。
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
