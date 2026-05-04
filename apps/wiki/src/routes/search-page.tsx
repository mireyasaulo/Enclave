import { Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, ErrorBlock, LoadingBlock } from "@yinjie/ui";
import { wikiApi } from "../lib/wiki-api";

export function SearchPage() {
  const { q } = useSearch({ from: "/search" }) as { q?: string };
  const query = (q ?? "").trim();
  const resultsQ = useQuery({
    queryKey: ["wiki", "search", query],
    queryFn: () => wikiApi.search(query),
    enabled: query.length > 0,
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">
        搜索：<span className="font-mono text-base">{query || "—"}</span>
      </h1>
      {!query && (
        <Card className="p-4 text-sm text-[var(--text-muted)]">
          在顶栏输入关键字进行搜索。
        </Card>
      )}
      {resultsQ.isLoading && <LoadingBlock />}
      {resultsQ.isError && (
        <ErrorBlock message={(resultsQ.error as Error).message} />
      )}
      {resultsQ.data?.length === 0 && (
        <Card className="p-4 text-sm text-[var(--text-muted)]">
          没有匹配的词条。
        </Card>
      )}
      <ul className="space-y-2">
        {resultsQ.data?.map((r) => (
          <Card key={r.characterId} className="p-3 text-sm">
            <Link
              to="/character/$characterId"
              params={{ characterId: r.characterId }}
              className="font-medium hover:underline"
            >
              {r.name || r.characterId}
            </Link>
            <span className="ml-2 text-xs text-[var(--text-muted)]">
              {r.relationship} · 相关度 {r.score}
            </span>
            <div className="mt-1 text-[var(--text-muted)] line-clamp-2">
              {r.bio}
            </div>
          </Card>
        ))}
      </ul>
    </div>
  );
}
