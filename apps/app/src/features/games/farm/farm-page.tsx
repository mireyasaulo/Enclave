import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FARM_CROP_CATALOG, type FarmCropId } from "@yinjie/contracts";
import { FarmClockProvider, useFarmClock } from "./farm-clock-context";
import { useFarmState } from "./use-farm-state";
import { CoinDisplay } from "./components/coin-display";
import { EventLogPanel } from "./components/event-log-panel";
import { FarmGrid } from "./components/farm-grid";
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

  return (
    <div className="relative flex h-full flex-col gap-3 bg-gradient-to-b from-emerald-50/40 to-amber-50/40 p-4 text-stone-800">
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSeedShopOpen(true)}
          className="flex-1 rounded-2xl bg-white px-3 py-2 text-left text-xs shadow-sm hover:bg-emerald-50"
        >
          <div className="font-medium text-emerald-700">🛒 种子店</div>
          <div className="mt-0.5 text-stone-500">
            种子袋共 {seedBagTotal} 包
          </div>
        </button>
        <button
          type="button"
          onClick={() => setWarehouseOpen(true)}
          className="flex-1 rounded-2xl bg-white px-3 py-2 text-left text-xs shadow-sm hover:bg-emerald-50"
        >
          <div className="font-medium text-amber-700">🏠 仓库</div>
          <div className="mt-0.5 text-stone-500">
            存货共 {warehouseTotal} 个
          </div>
        </button>
      </div>

      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <FarmGrid
          plots={state.plots}
          selectedIndex={selectedPlotIndex}
          onSelect={(i) =>
            setSelectedPlotIndex((curr) => (curr === i ? null : i))
          }
        />
      </section>

      <PlotActionBar
        state={state}
        plotIndex={selectedPlotIndex}
        onHarvested={(info) => {
          const def = FARM_CROP_CATALOG[info.cropId];
          setToast({
            ...info,
            expiresAt: Date.now() + 3500,
          });
          setSelectedPlotIndex(null);
          // 防止 lint 抱怨 def 未使用 — toast 仍展示
          void def;
        }}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <NeighborListPanel onSelectNeighbor={setActiveNeighborId} />
        <EventLogPanel />
      </div>

      <p className="text-center text-[10px] text-stone-400">
        作物按真实小时数成熟。下线时世界角色仍在自己的田里忙活。
      </p>

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
    </div>
  );
}
