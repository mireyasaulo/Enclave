import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type ScrollBehaviorMode = "auto" | "smooth";

export function useScrollAnchor<T extends HTMLElement>(itemCount: number) {
  const ref = useRef<T | null>(null);
  const previousItemCountRef = useRef(itemCount);
  const initializedRef = useRef(false);
  const suppressNextPendingCountRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const lastUserGestureAtRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const syncBottomStateFromDom = useEffectEvent(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const nextIsAtBottom = isScrolledNearBottom(element);
    isAtBottomRef.current = nextIsAtBottom;
    setIsAtBottom(nextIsAtBottom);
    if (nextIsAtBottom) {
      setPendingCount(0);
    }
  });

  const scrollToBottom = useEffectEvent(
    (behavior: ScrollBehaviorMode = "smooth") => {
      const element = ref.current;
      if (!element) {
        return;
      }

      if (behavior === "auto") {
        element.scrollTop = element.scrollHeight;
      } else {
        element.scrollTo({
          top: element.scrollHeight,
          behavior,
        });
      }

      isAtBottomRef.current = true;
      setIsAtBottom(true);
      setPendingCount(0);
      // Treat the upcoming scroll events as ours, not user-driven.
      lastUserGestureAtRef.current = 0;

      // After the next paint, scrollHeight may have grown (e.g. message bubble
      // finished laying out). Re-pin to bottom so we don't end up just short.
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const current = ref.current;
          if (!current) {
            return;
          }
          current.scrollTop = current.scrollHeight;
        });
      }
    },
  );

  const suppressNextPendingCount = useEffectEvent(() => {
    suppressNextPendingCountRef.current = true;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const markUserGesture = () => {
      lastUserGestureAtRef.current = performance.now();
    };

    const handleScroll = () => {
      const now = performance.now();
      // Only treat scroll events as authoritative when a user gesture happened
      // recently (within USER_SCROLL_WINDOW_MS). Layout-only or programmatic
      // scrolls do not have an associated gesture and should not flip the
      // "at bottom" ref. Ongoing scrolls keep refreshing the window.
      if (now - lastUserGestureAtRef.current >= USER_SCROLL_WINDOW_MS) {
        return;
      }
      lastUserGestureAtRef.current = now;
      syncBottomStateFromDom();
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    element.addEventListener("wheel", markUserGesture, { passive: true });
    element.addEventListener("touchmove", markUserGesture, { passive: true });
    element.addEventListener("touchstart", markUserGesture, { passive: true });
    element.addEventListener("mousedown", markUserGesture, { passive: true });
    element.addEventListener("keydown", markUserGesture);
    return () => {
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("wheel", markUserGesture);
      element.removeEventListener("touchmove", markUserGesture);
      element.removeEventListener("touchstart", markUserGesture);
      element.removeEventListener("mousedown", markUserGesture);
      element.removeEventListener("keydown", markUserGesture);
    };
  }, [syncBottomStateFromDom]);

  useLayoutEffect(() => {
    const previousItemCount = previousItemCountRef.current;
    previousItemCountRef.current = itemCount;

    if (!initializedRef.current) {
      if (itemCount === 0) {
        return;
      }

      initializedRef.current = true;
      scrollToBottom("auto");
      return;
    }

    if (itemCount <= previousItemCount) {
      return;
    }

    const addedCount = itemCount - previousItemCount;
    const element = ref.current;
    if (!element || isAtBottomRef.current) {
      scrollToBottom("auto");
      return;
    }

    if (suppressNextPendingCountRef.current) {
      suppressNextPendingCountRef.current = false;
      return;
    }

    setPendingCount((current) => current + addedCount);
    setIsAtBottom(false);
  }, [itemCount, scrollToBottom]);

  return {
    ref,
    isAtBottom,
    isAtBottomRef,
    pendingCount,
    suppressNextPendingCount,
    scrollToBottom,
  };
}

function isScrolledNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    SCROLL_BOTTOM_THRESHOLD
  );
}

const SCROLL_BOTTOM_THRESHOLD = 72;
const USER_SCROLL_WINDOW_MS = 500;
