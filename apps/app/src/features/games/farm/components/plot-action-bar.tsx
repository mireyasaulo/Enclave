import { useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { FarmCropId, FarmPlayerStateView, FarmPlot } from "@yinjie/contracts";

const t = translateRuntimeMessage;
import { FARM_CROP_CATALOG } from "@yinjie/contracts";
import { useFarmAdjustedNow } from "../farm-clock-context";
import { formatRemainingMs } from "../crop-presentation";
import {
  useDebugFarmPlot,
  useHarvestFarmPlot,
  usePlantFarmCrop,
  useWaterFarmPlot,
  useWeedFarmPlot,
} from "../use-farm-state";

export type PlotPulseKind = "plant" | "water" | "weed" | "debug" | "harvest";

interface PlotActionBarProps {
  state: FarmPlayerStateView;
  plotIndex: number | null;
  onHarvested?: (info: {
    cropId: FarmCropId;
    amount: number;
    coinsGained: number;
    leveledUp: boolean;
  }) => void;
  onPulse?: (plotIndex: number, kind: PlotPulseKind) => void;
}

export function PlotActionBar({ state, plotIndex, onHarvested, onPulse }: PlotActionBarProps) {
  const nowMs = useFarmAdjustedNow();
  const plantMutation = usePlantFarmCrop();
  const waterMutation = useWaterFarmPlot();
  const weedMutation = useWeedFarmPlot();
  const debugMutation = useDebugFarmPlot();
  const harvestMutation = useHarvestFarmPlot();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const plot: FarmPlot | null = useMemo(() => {
    if (plotIndex == null) return null;
    return state.plots[plotIndex] ?? null;
  }, [plotIndex, state.plots]);

  if (plotIndex == null || !plot) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/55 p-3 text-center text-xs text-stone-500 shadow-sm backdrop-blur-md">
        {t(msg`点一块田看看能干啥`)}
      </div>
    );
  }

  const isRipe =
    plot.cropId != null && plot.maturedAt != null && nowMs >= plot.maturedAt;
  const isPending =
    plantMutation.isPending ||
    waterMutation.isPending ||
    weedMutation.isPending ||
    debugMutation.isPending ||
    harvestMutation.isPending;

  function handleError(err: unknown) {
    setErrorMsg(err instanceof Error ? err.message : String(err));
  }

  function clearError() {
    setErrorMsg(null);
  }

  function handleHarvest() {
    clearError();
    const targetPlot = plotIndex!;
    harvestMutation.mutate(
      { plotIndex: targetPlot },
      {
        onSuccess: (result) => {
          onPulse?.(targetPlot, "harvest");
          onHarvested?.({
            cropId: result.harvested.cropId,
            amount: result.harvested.amount,
            coinsGained: result.harvested.coinsGained,
            leveledUp: result.harvested.leveledUp,
          });
        },
        onError: handleError,
      },
    );
  }

  function handlePlant(cropId: FarmCropId) {
    clearError();
    const targetPlot = plotIndex!;
    plantMutation.mutate(
      { plotIndex: targetPlot, cropId },
      {
        onSuccess: () => onPulse?.(targetPlot, "plant"),
        onError: handleError,
      },
    );
  }

  if (!plot.cropId || plot.stage === "empty" || plot.stage === "rotten") {
    const eligibleCrops = (Object.keys(FARM_CROP_CATALOG) as FarmCropId[]).filter(
      (id) =>
        FARM_CROP_CATALOG[id].unlockLevel <= state.level &&
        ((state.seedBag[id] ?? 0) > 0 ||
          state.coins >= FARM_CROP_CATALOG[id].seedCost),
    );
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/85 p-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-xs text-emerald-900">
          <span>{t(msg`第`)} {plotIndex + 1} {t(msg`块田 · 选个种子下地`)}</span>
          {plot.stage === "rotten" && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-600">
              {t(msg`上一茬已腐烂`)}
            </span>
          )}
        </div>
        {errorMsg && (
          <div className="rounded-md bg-rose-100 px-2 py-1 text-xs text-rose-600">
            {errorMsg}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {eligibleCrops.length === 0 && (
            <span className="text-xs text-stone-500">
              {t(msg`金币和种子都不够，先去仓库卖点东西`)}
            </span>
          )}
          {eligibleCrops.map((cropId) => {
            const def = FARM_CROP_CATALOG[cropId];
            const owned = state.seedBag[cropId] ?? 0;
            return (
              <button
                key={cropId}
                type="button"
                onClick={() => handlePlant(cropId)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs shadow-sm hover:bg-emerald-100 disabled:opacity-60"
              >
                <span>{def.emoji}</span>
                <span>{def.nameZh}</span>
                <span className="text-stone-400">
                  {owned > 0 ? `×${owned}` : `🪙${def.seedCost}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const def = FARM_CROP_CATALOG[plot.cropId];
  const remainingMs =
    plot.maturedAt != null ? plot.maturedAt - nowMs : 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/85 p-3 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between text-xs text-emerald-900">
        <span className="flex items-center gap-1">
          <span>{def.emoji}</span>
          {t(msg`第`)} {plotIndex + 1} {t(msg`块田 ·`)} {def.nameZh}
        </span>
        <span className="text-stone-500">
          {isRipe ? t(msg`已成熟`) : `${t(msg`还差`)} ${formatRemainingMs(remainingMs)}`}
        </span>
      </div>
      {errorMsg && (
        <div className="rounded-md bg-rose-100 px-2 py-1 text-xs text-rose-600">
          {errorMsg}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {isRipe ? (
          <button
            type="button"
            onClick={handleHarvest}
            disabled={isPending}
            className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:opacity-60"
          >
            🪙 {t(msg`收获`)}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                clearError();
                const targetPlot = plotIndex!;
                waterMutation.mutate(
                  { plotIndex: targetPlot },
                  {
                    onSuccess: () => onPulse?.(targetPlot, "water"),
                    onError: handleError,
                  },
                );
              }}
              disabled={isPending || plot.watered}
              className="rounded-full bg-sky-500 px-3 py-1 text-xs text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
            >
              💧 {t(msg`浇水`)}
            </button>
            <button
              type="button"
              onClick={() => {
                clearError();
                const targetPlot = plotIndex!;
                weedMutation.mutate(
                  { plotIndex: targetPlot },
                  {
                    onSuccess: () => onPulse?.(targetPlot, "weed"),
                    onError: handleError,
                  },
                );
              }}
              disabled={isPending || plot.weeds <= 0}
              className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              🌿 {t(msg`除草`)}
            </button>
            <button
              type="button"
              onClick={() => {
                clearError();
                const targetPlot = plotIndex!;
                debugMutation.mutate(
                  { plotIndex: targetPlot },
                  {
                    onSuccess: () => onPulse?.(targetPlot, "debug"),
                    onError: handleError,
                  },
                );
              }}
              disabled={isPending || plot.bugs <= 0}
              className="rounded-full bg-rose-500 px-3 py-1 text-xs text-white shadow-sm hover:bg-rose-600 disabled:opacity-60"
            >
              🐛 {t(msg`除虫`)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
