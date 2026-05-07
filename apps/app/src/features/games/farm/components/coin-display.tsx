import type { FarmPlayerStateView } from "@yinjie/contracts";
import { FARM_LEVEL_EXPERIENCE_THRESHOLDS } from "@yinjie/contracts";

interface CoinDisplayProps {
  state: FarmPlayerStateView;
}

export function CoinDisplay({ state }: CoinDisplayProps) {
  const currentLevel = state.level;
  const currentLevelXp =
    FARM_LEVEL_EXPERIENCE_THRESHOLDS[currentLevel - 1] ?? 0;
  const nextLevelXp =
    FARM_LEVEL_EXPERIENCE_THRESHOLDS[currentLevel] ?? currentLevelXp + 100;
  const progress = Math.max(
    0,
    Math.min(
      1,
      (state.experience - currentLevelXp) /
        Math.max(1, nextLevelXp - currentLevelXp),
    ),
  );

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-base font-semibold text-amber-700">
          <span>🪙</span>
          {state.coins.toLocaleString()}
        </span>
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
          Lv.{currentLevel}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>
          经验 {state.experience - currentLevelXp} / {nextLevelXp - currentLevelXp}
        </span>
        <span>田块 {state.plotCount}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
