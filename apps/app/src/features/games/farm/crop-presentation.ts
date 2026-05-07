import type {
  FarmCropDefinition,
  FarmCropId,
  FarmPlotStage,
} from "@yinjie/contracts";
import { FARM_CROP_CATALOG } from "@yinjie/contracts";

export interface CropPresentation extends FarmCropDefinition {
  stageEmoji: Record<FarmPlotStage, string>;
}

const STAGE_EMOJI: Record<FarmPlotStage, string> = {
  empty: "🟫",
  seed: "🌱",
  sprout: "🌿",
  growing: "🌾",
  ripe: "✨",
  rotten: "🥀",
};

export function getCropPresentation(cropId: FarmCropId): CropPresentation {
  const def = FARM_CROP_CATALOG[cropId];
  return {
    ...def,
    stageEmoji: { ...STAGE_EMOJI, ripe: def.emoji },
  };
}

export function getStageEmoji(
  stage: FarmPlotStage,
  cropId?: FarmCropId | null,
): string {
  if (stage === "ripe" && cropId) {
    return FARM_CROP_CATALOG[cropId]?.emoji ?? STAGE_EMOJI.ripe;
  }
  return STAGE_EMOJI[stage];
}

export function listCropPresentations(): CropPresentation[] {
  return (Object.keys(FARM_CROP_CATALOG) as FarmCropId[]).map(
    getCropPresentation,
  );
}

export function formatRemainingMs(ms: number): string {
  if (ms <= 0) return "已成熟";
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    const sec = totalSeconds % 60;
    return sec > 0 ? `${minutes}分${sec}秒` : `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const min = minutes % 60;
    return min > 0 ? `${hours}小时${min}分` : `${hours}小时`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days}天${restHours}小时` : `${days}天`;
}
