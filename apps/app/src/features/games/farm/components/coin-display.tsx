import { msg } from "@lingui/macro";
import type { FarmPlayerStateView } from "@yinjie/contracts";
import { FARM_LEVEL_EXPERIENCE_THRESHOLDS } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

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
    <div className="flex flex-col gap-2 rounded-2xl border border-white/60 bg-white/65 px-4 py-3 shadow-md backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-base font-semibold text-amber-700 drop-shadow-sm">
          <span className="text-lg">🪙</span>
          {state.coins.toLocaleString()}
        </span>
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
          Lv.{currentLevel}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-stone-600">
        <span>
          {t(
            msg`经验 ${state.experience - currentLevelXp} / ${nextLevelXp - currentLevelXp}`,
          )}
        </span>
        <span>{t(msg`田块 ${state.plotCount}`)}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-stone-200/80">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
