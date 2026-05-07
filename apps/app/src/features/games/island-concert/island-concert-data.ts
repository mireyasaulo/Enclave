import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

// 岛屿演唱会 — MVP：选 1 件乐器 + 2 件舞台道具 + 编 3 首曲目，演出阶段做节奏 tap

export type Instrument = {
  id: string;
  name: string;
  emoji: string;
  scoreBonus: number; // 演出每段加成
  blurb: string;
};

export type StageProp = {
  id: string;
  name: string;
  emoji: string;
  posterBonus: number; // 完成时多送海报数
  blurb: string;
};

export type Song = {
  id: string;
  title: string;
  blurb: string;
  beatCount: number; // 节拍数
  intervalMs: number; // 节拍间隔
  windowMs: number; // 命中窗口
};

export const STAGE_PROP_LIMIT = 2;
export const SETLIST_SIZE = 3;
export const ROUND_DURATION_MS = 7 * 60 * 1000;
export const POSTER_THRESHOLD = 16; // 单曲达到此分数 → +1 海报
export const STREAK_BONUS_AT = 4;
export const LOG_LIMIT = 20;

export const INSTRUMENTS: Instrument[] = [
  {
    id: "guitar",
    name: t(msg`木吉他`),
    emoji: "🎸",
    scoreBonus: 0,
    blurb: t(msg`稳定加分，适合上手。`),
  },
  {
    id: "drum",
    name: t(msg`架子鼓`),
    emoji: "🥁",
    scoreBonus: 2,
    blurb: t(msg`每拍 +2 分，节拍要稳。`),
  },
  {
    id: "synth",
    name: t(msg`合成器`),
    emoji: "🎹",
    scoreBonus: 1,
    blurb: t(msg`电子音色，节奏带感。`),
  },
  {
    id: "vocal",
    name: t(msg`和声 mic`),
    emoji: "🎤",
    scoreBonus: 1,
    blurb: t(msg`高音段 +1，最适合海风曲。`),
  },
];

export const STAGE_PROPS: StageProp[] = [
  {
    id: "lights",
    name: t(msg`极光灯阵`),
    emoji: "🪩",
    posterBonus: 1,
    blurb: t(msg`补光更好看。`),
  },
  {
    id: "sea-banner",
    name: t(msg`海风旗阵`),
    emoji: "🚩",
    posterBonus: 1,
    blurb: t(msg`旗帜随风，气氛拉满。`),
  },
  {
    id: "fire",
    name: t(msg`篝火台`),
    emoji: "🔥",
    posterBonus: 1,
    blurb: t(msg`暖色背景。`),
  },
  {
    id: "speaker",
    name: t(msg`双层喇叭`),
    emoji: "🔊",
    posterBonus: 0,
    blurb: t(msg`音浪覆盖海岸线。`),
  },
];

export const SONGS: Song[] = [
  {
    id: "sea-breeze",
    title: t(msg`海风返场`),
    blurb: t(msg`轻快 6 拍。`),
    beatCount: 6,
    intervalMs: 1000,
    windowMs: 500,
  },
  {
    id: "lighthouse",
    title: t(msg`灯塔合唱`),
    blurb: t(msg`稳定 8 拍。`),
    beatCount: 8,
    intervalMs: 950,
    windowMs: 480,
  },
  {
    id: "tide-pop",
    title: t(msg`潮汐流行`),
    blurb: t(msg`快节奏 10 拍。`),
    beatCount: 10,
    intervalMs: 800,
    windowMs: 420,
  },
  {
    id: "moonlight",
    title: t(msg`月光之上`),
    blurb: t(msg`高音段 8 拍。`),
    beatCount: 8,
    intervalMs: 900,
    windowMs: 460,
  },
  {
    id: "fireworks",
    title: t(msg`烟花段子`),
    blurb: t(msg`重拍 12 拍。`),
    beatCount: 12,
    intervalMs: 750,
    windowMs: 380,
  },
];

export function getInstrument(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

export function getStageProp(id: string): StageProp | undefined {
  return STAGE_PROPS.find((p) => p.id === id);
}

export function getSong(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}
