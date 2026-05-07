import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FARM_CROP_CATALOG, type FarmCropId } from "@yinjie/contracts";
import { FarmClockProvider, useFarmClock } from "./farm-clock-context";
import { useFarmState } from "./use-farm-state";
import { CoinDisplay } from "./components/coin-display";
import { EventLogPanel } from "./components/event-log-panel";
import { FarmIsoGrid } from "./components/farm-iso-grid";
import { FarmMascot } from "./components/farm-mascot";
import { FarmSky } from "./components/farm-sky";
import { NeighborFarmModal } from "./components/neighbor-farm-modal";
import { NeighborListPanel } from "./components/neighbor-list-panel";
import { PlotActionBar } from "./components/plot-action-bar";
import { SeedShopSheet } from "./components/seed-shop-sheet";
import { WarehouseSheet } from "./components/warehouse-sheet";

export function FarmPage() {
  return (
    <FarmClockProvider>
      <FarmPageInner />
    </FarmClockProvider>
  );
}

interface HarvestToast {
  cropId: FarmCropId;
  amount: number;
  coinsGained: number;
  leveledUp: boolean;
  expiresAt: number;
}

function FarmPageInner() {
  const stateQuery = useFarmState();
  const clock = useFarmClock();
  const [selectedPlotIndex, setSelectedPlotIndex] = useState<number | null>(null);
  const [seedShopOpen, setSeedShopOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [activeNeighborId, setActiveNeighborId] = useState<string | null>(null);
  const [toast, setToast] = useState<HarvestToast | null>(null);

  useEffect(() => {
    if (stateQuery.data?.serverNowMs) {
      clock.setServerNowMs(stateQuery.data.serverNowMs);
    }
  }, [stateQuery.data?.serverNowMs, clock]);

  useEffect(() => {
    if (!toast) return;
    const remaining = toast.expiresAt - Date.now();
    if (remaining <= 0) {
      setToast(null);
      return;
    }
    const timer = window.setTimeout(() => setToast(null), remaining);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (stateQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-500">
        正在准备隐界农场……
      </div>
    );
  }

  if (stateQuery.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-rose-600">
        <span>农场加载失败</span>
        <span className="text-xs text-stone-500">
          {(stateQuery.error as Error).message}
        </span>
      </div>
    );
  }

  const state = stateQuery.data!;
  const warehouseTotal = Object.values(state.warehouse).reduce(
    (acc, n) => acc + n,
    0,
  );
  const seedBagTotal = Object.values(state.seedBag).reduce(
    (acc, n) => acc + n,
    0,
  );

  const harvestHandler = (info: {
    cropId: FarmCropId;
    amount: number;
    coinsGained: number;
    leveledUp: boolean;
  }) => {
    setToast({
      ...info,
      expiresAt: Date.now() + 3500,
    });
    setSelectedPlotIndex(null);
  };

  return (
    <FarmSky>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4 text-stone-800">
        <header className="flex items-center justify-between">
          <Link
            to="/tabs/games"
            className="rounded-full px-2 py-1 text-xs text-stone-500 hover:bg-white/60"
          >
            ← 返回
          </Link>
          <h1 className="flex-1 text-center text-lg font-semibold text-emerald-900">
            隐界农场
          </h1>
          <div className="w-12" />
        </header>

        <CoinDisplay state={state} />

        <div className="grid gap-3 lg:grid-cols-3">
          <aside className="flex flex-col gap-3 lg:order-1">
            <button
              type="button"
              onClick={() => setSeedShopOpen(true)}
              className="rounded-2xl bg-white px-3 py-2 text-left text-xs shadow-sm hover:bg-emerald-50"
            >
              <div className="font-medium text-emerald-700">🛒 种子店</div>
              <div className="mt-0.5 text-stone-500">
                种子袋共 {seedBagTotal} 包
              </div>
            </button>
            <button
              type="button"
              onClick={() => setWarehouseOpen(true)}
              className="rounded-2xl bg-white px-3 py-2 text-left text-xs shadow-sm hover:bg-emerald-50"
            >
              <div className="font-medium text-amber-700">🏠 仓库</div>
              <div className="mt-0.5 text-stone-500">
                存货共 {warehouseTotal} 个
              </div>
            </button>
            <p className="hidden rounded-2xl bg-white/70 p-3 text-[11px] text-stone-500 shadow-sm lg:block">
              作物按真实小时数成熟。下线时世界角色仍在自己的田里忙活——回来时看到的状态是世界自治后的结果。
            </p>
          </aside>

          <section className="flex flex-col gap-3 lg:order-2 lg:col-span-1">
            <div className="rounded-2xl bg-white/70 p-2 shadow-sm backdrop-blur-sm">
              <FarmIsoGrid
                plots={state.plots}
                selectedIndex={selectedPlotIndex}
                onSelect={(i) =>
                  setSelectedPlotIndex((curr) => (curr === i ? null : i))
                }
              />
            </div>
            <PlotActionBar
              state={state}
              plotIndex={selectedPlotIndex}
              onHarvested={harvestHandler}
            />
          </section>

          <aside className="flex flex-col gap-3 lg:order-3">
            <NeighborListPanel onSelectNeighbor={setActiveNeighborId} />
            <EventLogPanel />
          </aside>
        </div>

        <p className="text-center text-[10px] text-stone-400 lg:hidden">
          作物按真实小时数成熟。下线时世界角色仍在自己的田里忙活。
        </p>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-700 px-4 py-2 text-sm text-white shadow-lg">
          收获 {FARM_CROP_CATALOG[toast.cropId].nameZh} ×{toast.amount} ·
          🪙+{toast.coinsGained}
          {toast.leveledUp && " · 升级！"}
        </div>
      )}

      <SeedShopSheet
        state={state}
        open={seedShopOpen}
        onClose={() => setSeedShopOpen(false)}
      />
      <WarehouseSheet
        state={state}
        open={warehouseOpen}
        onClose={() => setWarehouseOpen(false)}
      />
      <NeighborFarmModal
        characterId={activeNeighborId}
        onClose={() => setActiveNeighborId(null)}
      />
      <FarmMascot state={state} />
    </FarmSky>
  );
}
