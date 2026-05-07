import { useEffect, useEffectEvent, useRef, useState } from "react";

type ScrollBehaviorMode = "auto" | "smooth";

export function useScrollAnchor<T extends HTMLElement>(itemCount: number) {
  const ref = useRef<T | null>(null);
  const previousItemCountRef = useRef(itemCount);
  const initializedRef = useRef(false);
  const suppressNextPendingCountRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const programmaticScrollUntilRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const syncBottomState = useEffectEvent(() => {
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
      programmaticScrollUntilRef.current =
        performance.now() +
        (behavior === "smooth"
          ? PROGRAMMATIC_SCROLL_LOCK_SMOOTH_MS
          : PROGRAMMATIC_SCROLL_LOCK_AUTO_MS);
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

    syncBottomState();

    const handleScroll = () => {
      if (performance.now() < programmaticScrollUntilRef.current) {
        return;
      }
      syncBottomState();
    };

    const releaseProgrammaticLock = () => {
      programmaticScrollUntilRef.current = 0;
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    element.addEventListener("wheel", releaseProgrammaticLock, {
      passive: true,
    });
    element.addEventListener("touchmove", releaseProgrammaticLock, {
      passive: true,
    });
    return () => {
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("wheel", releaseProgrammaticLock);
      element.removeEventListener("touchmove", releaseProgrammaticLock);
    };
  }, [syncBottomState]);

  useEffect(() => {
    const previousItemCount = previousItemCountRef.current;
    previousItemCountRef.current = itemCount;

    if (!initializedRef.current) {
      if (itemCount === 0) {
        return;
      }

      initializedRef.current = true;
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
      return;
    }

    if (itemCount <= previousItemCount) {
      return;
    }

    const addedCount = itemCount - previousItemCount;
    const element = ref.current;
    if (!element || isAtBottomRef.current) {
      window.requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
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
const PROGRAMMATIC_SCROLL_LOCK_AUTO_MS = 200;
const PROGRAMMATIC_SCROLL_LOCK_SMOOTH_MS = 800;
