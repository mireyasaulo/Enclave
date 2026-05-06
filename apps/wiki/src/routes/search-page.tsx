import { Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorBlock, LoadingBlock, PanelEmpty } from "@yinjie/ui";
import { wikiApi } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";

export function SearchPage() {
  const { q } = useSearch({ from: "/search" }) as { q?: string };
  const query = (q ?? "").trim();
  const resultsQ = useQuery({
    queryKey: ["wiki", "search", query],
    queryFn: () => wikiApi.search(query),
    enabled: query.length > 0,
  });

  return (
    <PageShell
      eyebrow="搜索"
      title={query ? `搜索“${query}”` : "搜索词条"}
      description={
        query
          ? `命中 ${resultsQ.data?.length ?? 0} 条相关词条`
          : "在顶栏的搜索框输入关键字，按回车进行搜索。系统会按词条名、关系、简介与画像字段全文检索。"
      }
    >
      {!query && (
        <PanelEmpty message="请在顶栏输入关键字开始搜索。" />
      )}
      {resultsQ.isLoading && <LoadingBlock />}
      {resultsQ.isError && (
        <ErrorBlock message={(resultsQ.error as Error).message} />
      )}
      {query && resultsQ.data?.length === 0 && (
        <PanelEmpty message="没有匹配的词条。换个关键字试试，或检查是否有拼写错误。" />
      )}
      {resultsQ.data && resultsQ.data.length > 0 && (
        <ul className="space-y-2">
          {resultsQ.data.map((r) => (
            <li
              key={r.characterId}
              className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--surface-card)] px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition-colors hover:bg-[color:var(--surface-card-hover)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/character/$characterId"
                  params={{ characterId: r.characterId }}
                  className="font-medium text-[color:var(--text-primary)] hover:underline"
                >
                  {r.name || r.characterId}
                </Link>
                <span className="text-xs text-[color:var(--text-muted)]">
                  {r.relationship}
                </span>
                <span className="ml-auto text-xs text-[color:var(--text-muted)]">
                  相关度 {r.score}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-[color:var(--text-secondary)]">
                {r.bio}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
