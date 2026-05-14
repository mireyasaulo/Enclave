import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { drawWorld } from "./tank-war-renderer";
import {
  createWorld,
  emptyInput,
  isGameOver,
  isStageBeaten,
  setMuted as engineSetMuted,
  startStage,
  tick,
  togglePause,
} from "./tank-war-engine";
import { STAGE_CLEAR_MS } from "./tank-war-data";
import type {
  GameWorld,
  HudSnapshot,
  InputState,
  PlayerMode,
} from "./tank-war-types";
import { createSfx, type Sfx } from "./tank-war-audio";
import { loadPersist, savePersist, type TankWarPersist } from "./tank-war-storage";
import type { SpriteSheet } from "./tank-war-bake-sprites";

type Options = {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  getSprites: () => SpriteSheet | null;
};

export type WorldControls = {
  start: (mode: PlayerMode, stage: number) => void;
  resume: () => void;
  restart: () => void;
  toggleMute: () => void;
  togglePause: () => void;
};

export type UseTankWarWorldResult = {
  hud: HudSnapshot;
  controls: WorldControls;
  inputRef: React.MutableRefObject<InputState>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
};

export function useTankWarWorld(opts: Options): UseTankWarWorldResult {
  const worldRef = useRef<GameWorld>(createWorld());
  const inputRef = useRef<InputState>(emptyInput());
  const sfxRef = useRef<Sfx | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const persistRef = useRef<TankWarPersist>(loadPersist());
  const rafRef = useRef<number | null>(null);
  const stageClearHandledAt = useRef<number | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() =>
    snapshot(worldRef.current, persistRef.current),
  );

  // 初始化 sfx
  useEffect(() => {
    sfxRef.current = createSfx();
    sfxRef.current.setMuted(persistRef.current.muted);
    worldRef.current.muted = persistRef.current.muted;
    return () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    };
  }, []);

  // RAF loop
  useEffect(() => {
    let lastTs = performance.now();
    const loop = (ts: number) => {
      lastTs = ts;
      const world = worldRef.current;
      const sheet = opts.getSprites();
      // tick when playing
      tick(world, inputRef.current, sfxRef.current);

      // 关卡通关后等待若干 ms 再切到下一关菜单
      if (isStageBeaten(world)) {
        if (stageClearHandledAt.current === null) {
          stageClearHandledAt.current = world.stageClearAt ?? performance.now();
        } else if (
          performance.now() - (stageClearHandledAt.current ?? 0) >
          STAGE_CLEAR_MS
        ) {
          // 解锁下一关
          const next = Math.min(35, world.stage + 1);
          persistRef.current.maxUnlockedStage = Math.max(
            persistRef.current.maxUnlockedStage,
            next,
          );
          savePersist(persistRef.current);
          stageClearHandledAt.current = null;
        }
      } else {
        stageClearHandledAt.current = null;
      }

      if (isGameOver(world)) {
        persistRef.current.highScoreP1 = Math.max(
          persistRef.current.highScoreP1,
          world.scoreP1,
        );
        persistRef.current.highScoreP2 = Math.max(
          persistRef.current.highScoreP2,
          world.scoreP2,
        );
        savePersist(persistRef.current);
      }

      const canvas = opts.canvasRef.current;
      if (canvas && sheet) {
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          drawWorld(ctx, world, sheet, null);
        }
      }

      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    void lastTs;
  }, [opts.canvasRef, opts.getSprites]);

  // HUD 投影 — 每 120ms 拍一次快照
  useEffect(() => {
    const id = window.setInterval(() => {
      setHud(snapshot(worldRef.current, persistRef.current));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  // visibility 暂停
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        if (worldRef.current.status === "playing") {
          togglePause(worldRef.current, sfxRef.current);
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // pauseToggle 边沿
  const lastPauseRef = useRef(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      const cur = inputRef.current.pauseToggle;
      if (cur && !lastPauseRef.current) {
        togglePause(worldRef.current, sfxRef.current);
      }
      lastPauseRef.current = cur;
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  const start = useCallback((mode: PlayerMode, stage: number) => {
    const w = worldRef.current;
    startStage(w, stage, mode, { resetLives: true, resetScores: true });
    setHud(snapshot(w, persistRef.current));
  }, []);

  const resume = useCallback(() => {
    const w = worldRef.current;
    if (w.status === "stage-clear") {
      const next = Math.min(35, w.stage + 1);
      startStage(w, next, w.mode);
      setHud(snapshot(w, persistRef.current));
    } else if (w.status === "paused") {
      togglePause(w, sfxRef.current);
    }
  }, []);

  const restart = useCallback(() => {
    const w = worldRef.current;
    startStage(w, 1, w.mode, { resetLives: true, resetScores: true });
    setHud(snapshot(w, persistRef.current));
  }, []);

  const toggleMute = useCallback(() => {
    const next = !persistRef.current.muted;
    persistRef.current.muted = next;
    savePersist(persistRef.current);
    engineSetMuted(worldRef.current, sfxRef.current, next);
    setHud(snapshot(worldRef.current, persistRef.current));
  }, []);

  const togglePauseCb = useCallback(() => {
    togglePause(worldRef.current, sfxRef.current);
  }, []);

  const controls = useMemo<WorldControls>(
    () => ({
      start,
      resume,
      restart,
      toggleMute,
      togglePause: togglePauseCb,
    }),
    [start, resume, restart, toggleMute, togglePauseCb],
  );

  return { hud, controls, inputRef, audioRef };
}

function snapshot(world: GameWorld, persist: TankWarPersist): HudSnapshot {
  return {
    status: world.status,
    mode: world.mode,
    stage: world.stage,
    lives: world.livesP1,
    livesP2: world.mode === "two-player" ? world.livesP2 : undefined,
    enemyRemaining: Math.max(
      0,
      world.enemyQueue.length -
        world.spawnCursor +
        world.tanks.filter((t) => t.owner === "enemy").length,
    ),
    score: world.scoreP1,
    scoreP2: world.mode === "two-player" ? world.scoreP2 : undefined,
    muted: world.muted || persist.muted,
    maxUnlockedStage: persist.maxUnlockedStage,
  };
}
