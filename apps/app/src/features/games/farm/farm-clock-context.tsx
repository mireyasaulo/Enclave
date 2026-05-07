import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface FarmClock {
  nowMs: number;
  serverOffsetMs: number;
  setServerNowMs: (serverNowMs: number) => void;
}

const FarmClockContext = createContext<FarmClock | null>(null);

export function FarmClockProvider({ children }: { children: ReactNode }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const offsetRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const value = useMemo<FarmClock>(
    () => ({
      nowMs,
      serverOffsetMs: offsetRef.current,
      setServerNowMs: (serverNowMs: number) => {
        offsetRef.current = Date.now() - serverNowMs;
      },
    }),
    [nowMs],
  );

  return (
    <FarmClockContext.Provider value={value}>
      {children}
    </FarmClockContext.Provider>
  );
}

export function useFarmClock(): FarmClock {
  const ctx = useContext(FarmClockContext);
  if (!ctx) {
    throw new Error("useFarmClock must be used inside FarmClockProvider");
  }
  return ctx;
}

export function useFarmAdjustedNow(): number {
  const { nowMs, serverOffsetMs } = useFarmClock();
  return nowMs - serverOffsetMs;
}
