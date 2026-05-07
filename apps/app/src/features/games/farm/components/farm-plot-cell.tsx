import type { FarmPlot } from "@yinjie/contracts";
import { useFarmAdjustedNow } from "../farm-clock-context";
import { formatRemainingMs, getStageEmoji } from "../crop-presentation";

export interface FarmPlotCellProps {
  plot: FarmPlot;
  selected?: boolean;
  showOwnerActions?: boolean;
  onClick?: () => void;
}

export function FarmPlotCell({
  plot,
  selected,
  onClick,
}: FarmPlotCellProps) {
  const nowMs = useFarmAdjustedNow();
  const isRipe = plot.cropId != null && plot.maturedAt != null && nowMs >= plot.maturedAt;
  const isRotten =
    plot.cropId != null &&
    plot.plantedAt != null &&
    plot.maturedAt != null &&
    nowMs >= plot.maturedAt + 24 * 3600 * 1000;
  const remainingMs =
    plot.maturedAt != null && plot.cropId ? plot.maturedAt - nowMs : 0;

  const stage = plot.cropId
    ? isRotten
      ? "rotten"
      : isRipe
        ? "ripe"
        : plot.stage
    : "empty";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-center transition",
        selected
          ? "border-emerald-500 bg-emerald-50 shadow-md"
          : "border-stone-200 bg-stone-50 hover:border-emerald-300 hover:bg-emerald-50/40",
        isRipe && !isRotten ? "ring-2 ring-amber-300" : "",
        isRotten ? "opacity-60" : "",
      ].join(" ")}
    >
      <span className="text-2xl">{getStageEmoji(stage, plot.cropId)}</span>
      {plot.cropId && (
        <span className="text-[10px] text-stone-500">
          {isRotten ? "腐烂" : isRipe ? "成熟" : formatRemainingMs(remainingMs)}
        </span>
      )}
      {!plot.cropId && (
        <span className="text-[10px] text-stone-400">空地</span>
      )}
      <div className="absolute right-1 top-1 flex flex-col gap-0.5 text-[10px]">
        {plot.weeds > 0 && <span title="杂草">🌿</span>}
        {plot.bugs > 0 && <span title="害虫">🐛</span>}
        {plot.watered && !isRipe && <span title="已浇水">💧</span>}
        {(plot.stolenBy?.length ?? 0) > 0 && (
          <span title="被偷过" className="text-rose-500">⚠️</span>
        )}
      </div>
    </button>
  );
}
