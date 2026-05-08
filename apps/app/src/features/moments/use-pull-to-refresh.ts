import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const TRIGGER_DISTANCE = 64;
const MAX_PULL = 120;
const RESISTANCE = 0.55;

type UsePullToRefreshOptions = {
  /** Async refresh callback; pull indicator stays visible until it resolves. */
  onRefresh: () => Promise<unknown> | void;
  /** Disable when false (eg. while no scroll container yet). */
  enabled?: boolean;
};

type PullState = {
  pulling: boolean;
  refreshing: boolean;
  /** Vertical translation in pixels for the indicator/list. */
  offset: number;
  /** 0…1 progress to TRIGGER_DISTANCE. */
  progress: number;
};

type UsePullToRefreshResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  state: PullState;
};

export function usePullToRefresh({
  onRefresh,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const activePullRef = useRef(false);
  const [state, setState] = useState<PullState>({
    pulling: false,
    refreshing: false,
    offset: 0,
    progress: 0,
  });

  const finishRefresh = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pulling: false,
      refreshing: false,
      offset: 0,
      progress: 0,
    }));
  }, []);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;
      const node = containerRef.current;
      if (!node) return;
      // Only start tracking when scroll is at top.
      if (node.scrollTop > 0) return;
      startYRef.current = event.touches[0]?.clientY ?? null;
      activePullRef.current = false;
    },
    [enabled],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;
      const node = containerRef.current;
      if (!node) return;
      const startY = startYRef.current;
      if (startY === null) return;

      const currentY = event.touches[0]?.clientY ?? startY;
      const dy = currentY - startY;
      if (dy <= 0) {
        if (activePullRef.current) {
          activePullRef.current = false;
          setState((prev) => ({
            ...prev,
            pulling: false,
            offset: 0,
            progress: 0,
          }));
        }
        return;
      }

      activePullRef.current = true;
      const offset = Math.min(dy * RESISTANCE, MAX_PULL);
      const progress = Math.min(offset / TRIGGER_DISTANCE, 1);
      // Block native overscroll while pulling
      if (event.cancelable) {
        event.preventDefault();
      }
      setState((prev) =>
        prev.refreshing
          ? prev
          : { pulling: true, refreshing: false, offset, progress },
      );
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(() => {
    if (!activePullRef.current) {
      startYRef.current = null;
      return;
    }
    activePullRef.current = false;
    startYRef.current = null;

    setState((prev) => {
      if (prev.offset >= TRIGGER_DISTANCE) {
        const result = onRefresh();
        Promise.resolve(result).finally(() => {
          window.setTimeout(finishRefresh, 250);
        });
        return {
          pulling: false,
          refreshing: true,
          offset: TRIGGER_DISTANCE,
          progress: 1,
        };
      }
      return {
        pulling: false,
        refreshing: false,
        offset: 0,
        progress: 0,
      };
    });
  }, [finishRefresh, onRefresh]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !enabled) return;
    node.addEventListener("touchstart", handleTouchStart, { passive: true });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    node.addEventListener("touchend", handleTouchEnd);
    node.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, handleTouchEnd, handleTouchMove, handleTouchStart]);

  return { containerRef, state };
}
