import { useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { FarmCropId, FarmPlayerStateView } from "@yinjie/contracts";
import { listCropPresentations } from "../crop-presentation";
import { useBuyFarmSeed } from "../use-farm-state";

const t = translateRuntimeMessage;

interface SeedShopSheetProps {
  state: FarmPlayerStateView;
  open: boolean;
  onClose: () => void;
}

export function SeedShopSheet({ state, open, onClose }: SeedShopSheetProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingCropId, setPendingCropId] = useState<FarmCropId | null>(null);
  const buyMutation = useBuyFarmSeed();
  const presentations = listCropPresentations();

  if (!open) return null;

  function handleBuy(cropId: FarmCropId, quantity: number) {
    setErrorMsg(null);
    setPendingCropId(cropId);
    buyMutation.mutate(
      { cropId, quantity },
      {
        onSettled: () => setPendingCropId(null),
        onError: (err) => setErrorMsg((err as Error).message),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/30 sm:items-center">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-base font-semibold">{t(msg`种子商店`)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
          >
            {t(msg`关闭`)}
          </button>
        </header>
        {errorMsg && (
          <div className="bg-rose-50 px-4 py-2 text-xs text-rose-600">
            {errorMsg}
          </div>
        )}
        <ul className="flex-1 overflow-y-auto px-4 py-2">
          {presentations.map((crop) => {
            const locked = state.level < crop.unlockLevel;
            const owned = state.seedBag[crop.id] ?? 0;
            const affordable = state.coins >= crop.seedCost;
            const isPending = pendingCropId === crop.id;
            return (
              <li
                key={crop.id}
                className="flex items-center gap-3 border-b border-stone-100 py-3 last:border-b-0"
              >
                <span className="text-2xl">{crop.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{crop.nameZh}</span>
                    <span className="text-xs text-stone-500">
                      {crop.growHours}{t(msg`h 成熟`)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>
                      🪙 {crop.seedCost} {t(msg`/ 包，售价`)} {crop.sellPrice} {t(msg`/ 个`)}
                    </span>
                    <span>{t(msg`已存`)} {owned}</span>
                  </div>
                  {locked && (
                    <div className="mt-1 text-[11px] text-amber-600">
                      Lv.{crop.unlockLevel} {t(msg`解锁`)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleBuy(crop.id, 1)}
                  disabled={locked || !affordable || isPending}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    locked || !affordable
                      ? "cursor-not-allowed bg-stone-100 text-stone-400"
                      : "bg-emerald-600 text-white hover:bg-emerald-700",
                  ].join(" ")}
                >
                  {isPending ? t(msg`购买中`) : locked ? t(msg`未解锁`) : !affordable ? t(msg`金币不足`) : t(msg`购买 1`)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
