import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { Track } from "./sky-rally-types";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const t = translateRuntimeMessage;

export const ROUND_DURATION_MS = 2 * 60 * 1000;
export const LOG_LIMIT = 24;
export const TRACK_LENGTH = 100;
export const PERFECT_WINDOW_PROGRESS = 1.6; // ±1.6% 视为 perfect
export const GOOD_WINDOW_PROGRESS = 4.0; // ±4% 视为 good
export const TAP_OPEN_PROGRESS = 6.0; // ±6% 内允许点击（外部点击算 missed）
export const BOOST_DURATION_MS = 850;
export const BOOST_MULTIPLIER = 1.6;
export const PERFECT_BONUS_MULTIPLIER = 1.9;
export const PENALTY_DURATION_MS = 600;
export const PENALTY_MULTIPLIER = 0.55;

export const TRACKS: Track[] = [
  {
    id: "sunrise-bay",
    name: t(msg`晨光海湾`),
    blurb: t(msg`平直海岸线，最适合先把节奏找到。`),
    totalGates: 8,
    baseSpeed: 1.05,
    unlockShards: 0,
    badgeColor: "ocean",
  },
  {
    id: "aurora-strait",
    name: t(msg`极光赛道`),
    blurb: t(msg`两段加速门连续触发，限时开放。`),
    totalGates: 10,
    baseSpeed: 1.18,
    unlockShards: 0,
    badgeColor: "violet",
    isLimited: true,
  },
  {
    id: "silver-canyon",
    name: t(msg`银河峡谷`),
    blurb: t(msg`急弯多，需要稳定节拍。`),
    totalGates: 11,
    baseSpeed: 1.32,
    unlockShards: 6,
    badgeColor: "sunset",
  },
  {
    id: "midnight-arc",
    name: t(msg`午夜弧线`),
    blurb: t(msg`深夜赛道，每个加速门都贴在临界。`),
    totalGates: 12,
    baseSpeed: 1.45,
    unlockShards: 14,
    badgeColor: "forest",
  },
];

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((track) => track.id === id);
}
// i18n-ignore-end
