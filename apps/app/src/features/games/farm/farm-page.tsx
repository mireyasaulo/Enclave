import { useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { FarmClockProvider, useFarmClock } from "./farm-clock-context";
import { useFarmState } from "./use-farm-state";

export function FarmPage() {
  return (
    <FarmClockProvider>
      <FarmPageInner />
    </FarmClockProvider>
  );
}

function FarmPageInner() {
  const stateQuery = useFarmState();
  const clock = useFarmClock();

  useEffect(() => {
    if (stateQuery.data?.serverNowMs) {
      clock.setServerNowMs(stateQuery.data.serverNowMs);
    }
  }, [stateQuery.data?.serverNowMs, clock]);

  if (stateQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-500">
        <Trans>正在准备隐界农场……</Trans>
      </div>
    );
  }

  if (stateQuery.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-rose-600">
        <span>
          <Trans>农场加载失败</Trans>
        </span>
        <span className="text-xs text-stone-500">
          {(stateQuery.error as Error).message}
        </span>
      </div>
    );
  }

  const state = stateQuery.data!;
  return (
    <div className="flex h-full flex-col gap-4 p-4 text-stone-800">
      <header className="rounded-2xl bg-emerald-50 px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-emerald-900">
          <Trans>隐界农场</Trans>
        </h1>
        <p className="mt-1 text-xs text-emerald-700">
          <Trans>
            金币 {state.coins}　Lv.{state.level}　经验 {state.experience}　田块{" "}
            {state.plotCount}
          </Trans>
        </p>
      </header>
      <section className="rounded-2xl bg-white px-4 py-3 text-xs text-stone-500 shadow-sm">
        <Trans>
          基础界面正在加载，下一步将接入田块网格、种子店、邻居与事件流。
        </Trans>
      </section>
    </div>
  );
}
