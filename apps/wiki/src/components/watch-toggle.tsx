import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { Button } from "@yinjie/ui";
import { useAuth } from "../lib/use-auth";
import { wikiApi } from "../lib/wiki-api";

export function WatchToggle({ characterId }: { characterId: string }) {
  const t = translateRuntimeMessage;
  const { user } = useAuth();
  const qc = useQueryClient();
  const statusQ = useQuery({
    queryKey: ["wiki", "watchlist", "status", characterId],
    queryFn: () => wikiApi.isWatching(characterId),
    enabled: !!user,
  });
  const statusKey = ["wiki", "watchlist", "status", characterId];
  const watchMut = useMutation({
    mutationFn: () =>
      statusQ.data?.watching
        ? wikiApi.unwatch(characterId)
        : wikiApi.watch(characterId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: statusKey });
      const prev = qc.getQueryData<{ watching: boolean }>(statusKey);
      qc.setQueryData<{ watching: boolean }>(statusKey, {
        watching: !(prev?.watching ?? false),
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(statusKey, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: statusKey });
      void qc.invalidateQueries({ queryKey: ["wiki", "watchlist"] });
    },
  });
  if (!user) return null;
  const watching = statusQ.data?.watching;
  return (
    <Button
      size="sm"
      variant={watching ? "secondary" : "ghost"}
      disabled={watchMut.isPending || statusQ.isLoading}
      onClick={() => watchMut.mutate()}
    >
      {watching ? t(msg`★ 已观察`) : t(msg`☆ 观察`)}
    </Button>
  );
}
