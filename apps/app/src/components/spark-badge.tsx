import { cn } from "@yinjie/ui";

export function getSparkTier(days: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!days || days < 3) return 0;
  if (days < 7) return 1;
  if (days < 30) return 2;
  if (days < 100) return 3;
  if (days < 365) return 4;
  return 5;
}

const TIER_TEXT_COLOR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "text-[#ff7a30]",
  2: "text-[#e8423d]",
  3: "text-[#3578e5]",
  4: "text-[#c81d39]",
  5: "text-[#d97706]",
};

const SIZE_PRESETS = {
  sm: { gap: "gap-0.5", icon: "h-3 w-3", text: "text-[10px]" },
  md: { gap: "gap-1", icon: "h-4 w-4", text: "text-[12px]" },
  lg: { gap: "gap-1.5", icon: "h-5 w-5", text: "text-[14px]" },
} as const;

export function SparkBadge({
  streak,
  size = "sm",
  className,
}: {
  streak?: number | null;
  size?: keyof typeof SIZE_PRESETS;
  className?: string;
}) {
  const days = streak ?? 0;
  const tier = getSparkTier(days);
  if (tier === 0) return null;
  const preset = SIZE_PRESETS[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center font-semibold leading-none tabular-nums",
        preset.gap,
        preset.text,
        TIER_TEXT_COLOR[tier],
        className,
      )}
      aria-label={`已连续 ${days} 天`}
    >
      <img
        src={`/spark/tier-${tier}.svg`}
        alt=""
        className={cn("shrink-0", preset.icon)}
      />
      <span>{days}</span>
    </span>
  );
}
