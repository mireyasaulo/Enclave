import { useEffect } from "react";

import type { InputState, WorldStatus } from "./tank-war-types";

type KeyMap = {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  fire: string[];
};

const P1_KEYS_SINGLE: KeyMap = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  fire: ["KeyJ", "Space"],
};

const P1_KEYS_DUO: KeyMap = {
  up: ["KeyW"],
  down: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  fire: ["KeyJ", "Space"],
};

const P2_KEYS: KeyMap = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  fire: ["Slash", "NumpadDivide", "ShiftRight"],
};

const PAUSE_KEYS = ["KeyP", "Escape"];

function matches(map: KeyMap, code: string): keyof KeyMap | null {
  for (const k of Object.keys(map) as Array<keyof KeyMap>) {
    if (map[k].includes(code)) return k;
  }
  return null;
}

export function useTankWarInput(
  inputRef: React.MutableRefObject<InputState>,
  _status: WorldStatus,
  twoPlayer: boolean,
): void {
  useEffect(() => {
    const p1 = twoPlayer ? P1_KEYS_DUO : P1_KEYS_SINGLE;
    const p2 = twoPlayer ? P2_KEYS : null;

    function set(code: string, down: boolean) {
      const input = inputRef.current;
      if (PAUSE_KEYS.includes(code)) {
        if (down) input.pauseToggle = !input.pauseToggle;
        return true;
      }
      const m1 = matches(p1, code);
      if (m1) {
        if (m1 === "up") input.p1Up = down;
        else if (m1 === "down") input.p1Down = down;
        else if (m1 === "left") input.p1Left = down;
        else if (m1 === "right") input.p1Right = down;
        else if (m1 === "fire") input.p1Fire = down;
        return true;
      }
      if (p2) {
        const m2 = matches(p2, code);
        if (m2) {
          if (m2 === "up") input.p2Up = down;
          else if (m2 === "down") input.p2Down = down;
          else if (m2 === "left") input.p2Left = down;
          else if (m2 === "right") input.p2Right = down;
          else if (m2 === "fire") input.p2Fire = down;
          return true;
        }
      }
      return false;
    }

    function isTextInputFocused(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if ((target as HTMLElement).isContentEditable) return true;
      return false;
    }

    function onDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (isTextInputFocused(e)) return;
      const handled = set(e.code, true);
      if (handled) e.preventDefault();
    }
    function onUp(e: KeyboardEvent) {
      if (isTextInputFocused(e)) return;
      const handled = set(e.code, false);
      if (handled) e.preventDefault();
    }

    window.addEventListener("keydown", onDown, { passive: false });
    window.addEventListener("keyup", onUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      // 释放所有按键状态
      const input = inputRef.current;
      input.p1Up = false;
      input.p1Down = false;
      input.p1Left = false;
      input.p1Right = false;
      input.p1Fire = false;
      input.p2Up = false;
      input.p2Down = false;
      input.p2Left = false;
      input.p2Right = false;
      input.p2Fire = false;
    };
  }, [inputRef, twoPlayer]);
}
