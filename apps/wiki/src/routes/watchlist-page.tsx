import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  ErrorBlock,
  LoadingBlock,
  PanelEmpty,
  StatusPill,
} from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function WatchlistPage() {
  const { user } = useAuth();
  const listQ = useQuery({
    queryKey: ["wiki", "watchlist"],
    queryFn: () => wikiApi.watchlist(),
    enabled: !!user,
  });
  const feedQ = useQuery({
    queryKey: ["wiki", "watchlist", "feed"],
    queryFn: () => wikiApi.watchlistFeed(),
    enabled: !!user,
  });

  if (!user) {
    return (
      <PageShell
        eyebrow="个人"
        title="我的观察列表"
        description="登录后即可关注词条并查看最新动态。"
      >
        <Card className="p-6 text-sm">请先登录。</Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="个人"
      title="我的观察列表"
      description="左侧是你正在观察的所有词条；右侧汇总它们的最新版本与讨论动态。在词条页右上角点击 ⭐ 关注/取消关注。"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            观察的词条
          </h2>
          {listQ.isLoading && <LoadingBlock />}
          {listQ.isError && (
            <ErrorBlock message={(listQ.error as Error).message} />
          )}
          {listQ.data?.length === 0 && (
            <PanelEmpty message="还没有观察任何词条。打开任意角色页，点击右上角的 ⭐ 关注按钮即可加入。" />
          )}
          <ul className="space-y-2">
            {listQ.data?.map((entry) => (
              <li
                key={entry.characterId}
                className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[color:var(--surface-card-hover)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/character/$characterId"
                    params={{ characterId: entry.characterId }}
                    className="font-medium text-[color:var(--text-primary)] hover:underline"
                  >
                    {entry.characterId}
                  </Link>
                  {entry.isDeleted && <StatusPill>已删除</StatusPill>}
                  {entry.protectionLevel !== "none" && (
                    <StatusPill>
                      {entry.protectionLevel === "semi"
                        ? "半保护"
                        : "完全保护"}
                    </StatusPill>
                  )}
                  <span className="ml-auto text-xs text-[color:var(--text-muted)]">
                    自 {new Date(entry.addedAt).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            最新动态
          </h2>
          {feedQ.isLoading && <LoadingBlock />}
          {feedQ.isError && (
            <ErrorBlock message={(feedQ.error as Error).message} />
          )}
          {feedQ.data?.length === 0 && (
            <PanelEmpty message="观察的词条暂无更新。" />
          )}
          <ul className="space-y-2">
            {feedQ.data?.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[color:var(--surface-card-hover)]"
              >
                {item.kind === "revision" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill>编辑</StatusPill>
                      <Link
                        to="/character/$characterId"
                        params={{ characterId: item.characterId }}
                        className="font-medium hover:underline"
                      >
                        {item.characterId}
                      </Link>
                      <span className="ml-auto text-xs text-[color:var(--text-muted)]">
                        v{item.revision.version} ·{" "}
                        {new Date(item.revision.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {item.revision.editSummary && (
                      <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {item.revision.editSummary}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill>讨论</StatusPill>
                      <Link
                        to="/character/$characterId"
                        params={{ characterId: item.characterId }}
                        className="font-medium hover:underline"
                      >
                        {item.characterId}
                      </Link>
                      <span className="ml-auto text-xs text-[color:var(--text-muted)]">
                        {item.thread.lastReplyAt
                          ? new Date(item.thread.lastReplyAt).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">{item.thread.title}</div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
