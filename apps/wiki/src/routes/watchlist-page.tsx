import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  ErrorBlock,
  LoadingBlock,
  StatusPill,
} from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";

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
      <Card className="p-6">
        <p>请先登录。</p>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">我观察的词条</h1>
        {listQ.isLoading && <LoadingBlock />}
        {listQ.isError && <ErrorBlock message={(listQ.error as Error).message} />}
        {listQ.data?.length === 0 && (
          <Card className="p-4 text-sm text-[var(--text-muted)]">
            还没有观察任何词条。
          </Card>
        )}
        <ul className="space-y-2">
          {listQ.data?.map((entry) => (
            <Card key={entry.characterId} className="p-3 text-sm">
              <Link
                to="/character/$characterId"
                params={{ characterId: entry.characterId }}
                className="font-medium hover:underline"
              >
                {entry.characterId}
              </Link>
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                自 {new Date(entry.addedAt).toLocaleDateString()}
              </span>
              {entry.isDeleted && <StatusPill>已删除</StatusPill>}
              {entry.protectionLevel !== "none" && (
                <StatusPill>{entry.protectionLevel}</StatusPill>
              )}
            </Card>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">动态</h1>
        {feedQ.isLoading && <LoadingBlock />}
        {feedQ.isError && <ErrorBlock message={(feedQ.error as Error).message} />}
        {feedQ.data?.length === 0 && (
          <Card className="p-4 text-sm text-[var(--text-muted)]">
            观察的词条暂无更新。
          </Card>
        )}
        <ul className="space-y-2">
          {feedQ.data?.map((item, i) => (
            <Card key={i} className="p-3 text-sm">
              {item.kind === "revision" ? (
                <>
                  <div className="flex items-center gap-2">
                    <StatusPill>编辑</StatusPill>
                    <Link
                      to="/character/$characterId"
                      params={{ characterId: item.characterId }}
                      className="font-medium hover:underline"
                    >
                      {item.characterId}
                    </Link>
                    <span className="text-xs text-[var(--text-muted)] ml-auto">
                      v{item.revision.version} ·{" "}
                      {new Date(item.revision.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {item.revision.editSummary && (
                    <div className="text-xs mt-1">
                      {item.revision.editSummary}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <StatusPill>讨论</StatusPill>
                    <Link
                      to="/character/$characterId"
                      params={{ characterId: item.characterId }}
                      className="font-medium hover:underline"
                    >
                      {item.characterId}
                    </Link>
                    <span className="text-xs text-[var(--text-muted)] ml-auto">
                      {item.thread.lastReplyAt
                        ? new Date(item.thread.lastReplyAt).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  <div className="mt-1">{item.thread.title}</div>
                </>
              )}
            </Card>
          ))}
        </ul>
      </div>
    </div>
  );
}
