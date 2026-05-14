import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import { X } from "lucide-react";

import {
  LOGIC_HEIGHT,
  LOGIC_WIDTH,
} from "./tank-war-data";
import { bakeSprites, type SpriteSheet } from "./tank-war-bake-sprites";
import { drawWorld } from "./tank-war-renderer";
import { useTankWarWorld } from "./use-tank-war-world";
import { useTankWarInput } from "./use-tank-war-input";
import { TankWarTouchControls } from "./tank-war-touch-controls";
import type { HudSnapshot, PlayerMode } from "./tank-war-types";

const t = translateRuntimeMessage;

type Variant = "embedded" | "fullscreen";

type TankWarGameProps = {
  variant?: Variant;
  onExit?: () => void;
};

function detectTouch(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}

export function TankWarGame({ variant = "fullscreen", onExit }: TankWarGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const spritesRef = useRef<SpriteSheet | null>(null);
  const [scale, setScale] = useState(1);
  const [isTouch] = useState(detectTouch);

  const { hud, controls, inputRef } = useTankWarWorld({
    canvasRef,
    getSprites: () => spritesRef.current,
  });

  useTankWarInput(inputRef, hud.status, hud.mode === "two-player");

  useEffect(() => {
    spritesRef.current = bakeSprites();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        drawWorld(ctx, null, spritesRef.current);
      }
    }
  }, []);

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const compute = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight || w;
      const sx = Math.floor(w / LOGIC_WIDTH);
      const sy = Math.floor(h / LOGIC_HEIGHT);
      const next = Math.max(1, Math.min(sx, sy));
      setScale(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const containerCls =
    variant === "embedded"
      ? "rounded-[16px] bg-black"
      : "min-h-screen bg-black";

  return (
    <section className={cn("flex flex-col items-center gap-2 p-3", containerCls)}>
      <header className="flex w-full items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-wider">
            {t(msg`坦克大战`)}
          </span>
          <HudSummary hud={hud} />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => controls.toggleMute()}
            className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-white"
          >
            {hud.muted ? t(msg`已静音`) : t(msg`音效开`)}
          </button>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/10"
              aria-label={t(msg`退出游戏`)}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={wrapperRef}
        className="flex w-full max-w-[520px] flex-1 items-center justify-center"
        style={{ minHeight: LOGIC_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          width={LOGIC_WIDTH}
          height={LOGIC_HEIGHT}
          style={{
            width: LOGIC_WIDTH * scale,
            height: LOGIC_HEIGHT * scale,
            imageRendering: "pixelated",
            background: "#000",
          }}
        />
      </div>

      {hud.status === "boot" || hud.status === "game-over" || hud.status === "stage-clear" ? (
        <MenuOverlay hud={hud} controls={controls} />
      ) : null}

      {isTouch && hud.status === "playing" ? (
        <TankWarTouchControls inputRef={inputRef} />
      ) : null}

      {!isTouch ? (
        <p className="text-[11px] text-white/60">
          {hud.mode === "two-player"
            ? t(msg`P1: WASD + J 开火 / P2: 方向键 + / 开火`)
            : t(msg`方向键 / WASD 移动，J / 空格开火，P 暂停`)}
        </p>
      ) : null}
    </section>
  );
}

function HudSummary({ hud }: { hud: HudSnapshot }) {
  if (hud.status === "boot") return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/80">
      <span>
        {t(msg`第 ${hud.stage} 关`)}
      </span>
      <span>
        {t(msg`敌剩 ${hud.enemyRemaining}`)}
      </span>
      {hud.mode === "two-player" ? (
        <>
          <span>P1 ♥{hud.lives} · {hud.score}</span>
          <span>P2 ♥{hud.livesP2 ?? 0} · {hud.scoreP2 ?? 0}</span>
        </>
      ) : (
        <>
          <span>♥{hud.lives}</span>
          <span>{t(msg`得分 ${hud.score}`)}</span>
        </>
      )}
    </div>
  );
}

function MenuOverlay({
  hud,
  controls,
}: {
  hud: HudSnapshot;
  controls: {
    start: (mode: PlayerMode, stage: number) => void;
    resume: () => void;
    restart: () => void;
    toggleMute: () => void;
  };
}) {
  const [mode, setMode] = useState<PlayerMode>("one-player");
  const [stage, setStage] = useState<number>(1);
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2 rounded-lg bg-white/5 p-3 text-white">
      {hud.status === "boot" ? (
        <p className="text-[13px] font-semibold">{t(msg`坦克大战`)}</p>
      ) : hud.status === "game-over" ? (
        <p className="text-[13px] font-semibold text-red-400">{t(msg`Game Over`)}</p>
      ) : (
        <p className="text-[13px] font-semibold text-emerald-400">
          {t(msg`恭喜过关，进入下一关`)}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("one-player")}
          className={cn(
            "rounded-full px-3 py-1 text-[12px]",
            mode === "one-player" ? "bg-amber-400 text-black" : "bg-white/10",
          )}
        >
          {t(msg`单人`)}
        </button>
        <button
          type="button"
          onClick={() => setMode("two-player")}
          className={cn(
            "rounded-full px-3 py-1 text-[12px]",
            mode === "two-player" ? "bg-amber-400 text-black" : "bg-white/10",
          )}
        >
          {t(msg`双人`)}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/70">{t(msg`选关:`)}</span>
        <input
          type="number"
          min={1}
          max={hud.maxUnlockedStage}
          value={stage}
          onChange={(e) =>
            setStage(
              Math.max(1, Math.min(hud.maxUnlockedStage, Number(e.target.value) || 1)),
            )
          }
          className="w-16 rounded bg-white/10 px-2 py-1 text-[12px] text-white"
        />
        <span className="text-[11px] text-white/50">
          {t(msg`已解锁 ${hud.maxUnlockedStage} / 35`)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => controls.start(mode, stage)}
          className="rounded-full bg-amber-400 px-4 py-1.5 text-[13px] font-semibold text-black"
        >
          {hud.status === "boot" ? t(msg`开始游戏`) : t(msg`再来一局`)}
        </button>
        {hud.status === "stage-clear" ? (
          <button
            type="button"
            onClick={() => controls.resume()}
            className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] text-white"
          >
            {t(msg`下一关`)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
