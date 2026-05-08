import { useMemo, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import {
  ArrowLeft,
  ChevronRight,
  History,
  MoreHorizontal,
  RotateCcw,
  Star,
  Trophy,
  X,
} from "lucide-react";
import {
  CAR_SPECS,
  CAR_TIER_ORDER,
  DAILY_BONUS_AMOUNT,
  NPC_OPPONENTS,
  PLAYER_GARAGE_LIMIT,
  getNpcById,
} from "./parking-war-data";
import {
  buildLeaderboard,
  findPlayerCarLocation,
  type LeaderboardEntry,
} from "./parking-war-engine";
import { useParkingWarState } from "./use-parking-war-state";
import type {
  CarTier,
  Lot,
  NpcOpponent,
  OwnedCar,
  ParkingWarState,
  Slot,
  VisitLogEntry,
} from "./parking-war-types";

const t = translateRuntimeMessage;

type Variant = "embedded" | "fullscreen";

type ParkingWarGameProps = {
  variant?: Variant;
  onExit?: () => void;
};

type ActiveLot = null | string; // null = my lot, string = npcId
type SheetView = "leaderboard" | "log" | "garage" | null;

const NPC_AVATAR_EMOJI: Record<string, string> = {
  "npc-axun": "👮",
  "npc-lin-chen": "🌙",
  "npc-xu-zhe": "💼",
  "npc-su-yu": "🌸",
  "npc-zhou-ran": "💪",
  "npc-lin-mian": "😴",
  "npc-bar-expert": "🍺",
};

function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ParkingWarGame({
  variant = "fullscreen",
  onExit,
}: ParkingWarGameProps) {
  const { state, actions } = useParkingWarState();
  const [activeLot, setActiveLot] = useState<ActiveLot>(null);
  const [sheetView, setSheetView] = useState<SheetView>(null);

  const isHome = activeLot === null;
  const activeNpc = activeLot ? getNpcById(activeLot) : null;
  const npcLot = activeLot ? state.npcLots[activeLot] : undefined;

  const idleCarIds = useMemo(
    () =>
      state.ownedCars
        .filter((car) => findPlayerCarLocation(state, car.carId).kind === "garage")
        .map((car) => car.carId),
    [state],
  );

  const playerCarsInNpcLots = useMemo(() => {
    const map: Record<string, string> = {};
    for (const car of state.ownedCars) {
      const loc = findPlayerCarLocation(state, car.carId);
      if (loc.kind === "npc") map[loc.npcId] = car.carId;
    }
    return map;
  }, [state]);

  const homeStats = useMemo(() => {
    let mine = 0;
    let theirs = 0;
    for (const slot of state.playerLot.slots) {
      if (!slot.parked) continue;
      if (slot.parked.source.kind === "player") mine += slot.parked.pendingEarnings;
      else theirs += slot.parked.pendingEarnings;
    }
    return { mine, theirs };
  }, [state.playerLot]);

  const visitStats = useMemo(() => {
    if (!npcLot) return { myEarnings: 0 };
    let myEarnings = 0;
    for (const slot of npcLot.slots) {
      if (slot.parked?.source.kind === "player") myEarnings += slot.parked.pendingEarnings;
    }
    return { myEarnings };
  }, [npcLot]);

  const recentEvents = state.events.slice(-3).reverse();
  const leaderboard = useMemo(() => buildLeaderboard(state), [state]);
  const canClaimToday = state.lastDailyBonusDateKey !== todayDateKey();

  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden",
        "bg-[#f3ede7] text-[color:var(--text-primary)]",
        variant === "fullscreen"
          ? "fixed inset-0 z-50"
          : "h-full min-h-[560px] rounded-[20px] shadow-[var(--shadow-card)]",
      )}
    >
      {/* ── Header ── */}
      <header className="relative z-10 flex shrink-0 items-center gap-2 bg-[#2d5a27] px-3 py-2.5 text-white shadow-[0_2px_8px_rgba(0,0,0,0.20)]">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            aria-label={t(msg`退出游戏`)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.25)]"
          >
            {variant === "fullscreen" ? <ArrowLeft size={15} /> : <X size={15} />}
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-[16px]">🅿️</span>
          <span className="text-[14px] font-bold tracking-wide">{t(msg`抢车位`)}</span>
        </div>
        {canClaimToday ? (
          <div className="flex items-center gap-1 rounded-full bg-[#f59e0b] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-[0_1px_4px_rgba(0,0,0,0.20)]">
            <Star size={9} />
            {t(msg`签到`)} +¥{DAILY_BONUS_AMOUNT}
          </div>
        ) : (
          <div className="rounded-full bg-[rgba(255,255,255,0.14)] px-2.5 py-0.5 text-[11px] text-[rgba(255,255,255,0.55)]">
            {t(msg`已签到`)}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-[rgba(255,255,255,0.18)] px-3 py-1 text-[13px] font-bold">
          💰 ¥{state.balance.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={() => setSheetView("leaderboard")}
          aria-label={t(msg`更多`)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.25)]"
        >
          <MoreHorizontal size={15} />
        </button>
      </header>

      {/* ── Main ── */}
      <div className="flex min-h-0 flex-1">
        {/* NPC sidebar (sm+) */}
        <aside className="hidden w-[160px] shrink-0 flex-col border-r border-[rgba(0,0,0,0.10)] bg-[#e8e0d8] sm:flex">
          <div className="border-b border-[rgba(0,0,0,0.08)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a7e74]">
            {t(msg`好友车场`)}
          </div>
          {/* My lot */}
          <button
            type="button"
            onClick={() => setActiveLot(null)}
            className={cn(
              "flex w-full items-center gap-2 border-l-[3px] px-3 py-2 text-left transition-colors",
              isHome
                ? "border-[#2d5a27] bg-[rgba(45,90,39,0.10)]"
                : "border-transparent hover:bg-[rgba(0,0,0,0.05)]",
            )}
          >
            <span className="shrink-0 text-[18px]">🏠</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold">{t(msg`我的车场`)}</div>
              <div className="text-[10px] text-[#8a7e74]">
                {state.playerLot.slots.filter((s) => !s.parked).length} {t(msg`空`)}
                · {state.playerLot.slots.filter((s) => s.parked).length} {t(msg`占`)}
              </div>
            </div>
            {isHome && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2d5a27]" />}
          </button>
          {/* NPC list */}
          <div className="flex-1 overflow-y-auto">
            {NPC_OPPONENTS.map((npc) => {
              const lot = state.npcLots[npc.id];
              const emptyCount = lot?.slots.filter((s) => !s.parked).length ?? 0;
              const myCarHere = playerCarsInNpcLots[npc.id];
              const isActive = activeLot === npc.id;
              return (
                <button
                  key={npc.id}
                  type="button"
                  onClick={() => setActiveLot(npc.id)}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-[3px] px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-[#d65e2f] bg-[#fff3eb]"
                      : "border-transparent hover:bg-[rgba(0,0,0,0.05)]",
                  )}
                >
                  <span className="shrink-0 text-[18px]">
                    {NPC_AVATAR_EMOJI[npc.id] ?? "👤"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[12px] font-semibold">{npc.name}</span>
                      {myCarHere && <span className="text-[10px]">🚗</span>}
                    </div>
                    <div className="text-[10px] text-[#8a7e74]">{emptyCount} {t(msg`空位`)}</div>
                  </div>
                  <ChevronRight size={12} className="shrink-0 text-[#b0a89e]" />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Lot area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Quick action bar */}
          <LotActionBar
            isHome={isHome}
            activeNpc={activeNpc}
            homeStats={homeStats}
            visitStats={visitStats}
            onCollectAll={actions.collectAll}
            onFineAll={actions.fineAll}
            onRecallAll={() => {
              if (!activeLot || !npcLot) return;
              for (const slot of npcLot.slots) {
                if (slot.parked?.source.kind === "player")
                  actions.recall(activeLot, slot.index);
              }
            }}
          />

          {/* Parking grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {isHome ? (
              <HomeParkingGrid
                lot={state.playerLot}
                state={state}
                idleCarIds={idleCarIds}
                onCollect={actions.collect}
                onFine={actions.fine}
                onKick={actions.kick}
                onParkHome={actions.parkHome}
              />
            ) : activeNpc && npcLot ? (
              <NpcParkingGrid
                npc={activeNpc}
                lot={npcLot}
                idleCarIds={idleCarIds}
                ownedCars={state.ownedCars}
                onPark={(slotIndex, carId) => actions.parkInNpc(activeNpc.id, slotIndex, carId)}
                onRecall={(slotIndex) => actions.recall(activeNpc.id, slotIndex)}
              />
            ) : null}
          </div>

          {/* Event strip */}
          {recentEvents.length > 0 && (
            <div className="shrink-0 border-t border-[rgba(0,0,0,0.08)] bg-[rgba(45,90,39,0.06)] px-3 py-1.5 text-[11px]">
              {recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={cn(
                    "truncate leading-5",
                    ev.tone === "success" && "text-[#15803d]",
                    ev.tone === "warn" && "text-[#b45309]",
                    ev.tone === "info" && "text-[#6b7280]",
                  )}
                >
                  · {ev.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile NPC chip bar */}
      <div
        className="shrink-0 border-t border-[rgba(0,0,0,0.10)] bg-[#e8e0d8] sm:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex gap-1.5 overflow-x-auto px-2 py-2 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveLot(null)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
              isHome
                ? "bg-[#2d5a27] text-white"
                : "border border-[rgba(0,0,0,0.12)] bg-white text-[#4a4040]",
            )}
          >
            🏠 {t(msg`我的`)}
          </button>
          {NPC_OPPONENTS.map((npc) => {
            const myCarHere = playerCarsInNpcLots[npc.id];
            const isActive = activeLot === npc.id;
            return (
              <button
                key={npc.id}
                type="button"
                onClick={() => setActiveLot(npc.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  isActive
                    ? "bg-[#d65e2f] text-white"
                    : "border border-[rgba(0,0,0,0.12)] bg-white text-[#4a4040]",
                )}
              >
                {NPC_AVATAR_EMOJI[npc.id] ?? "👤"} {npc.name}
                {myCarHere ? " 🚗" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* More sheet */}
      {sheetView && (
        <MoreSheet
          sheetView={sheetView}
          setSheetView={setSheetView}
          state={state}
          leaderboard={leaderboard}
          onBuy={actions.buy}
          onReset={actions.reset}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// LotActionBar
// ─────────────────────────────────────────────

function LotActionBar({
  isHome,
  activeNpc,
  homeStats,
  visitStats,
  onCollectAll,
  onFineAll,
  onRecallAll,
}: {
  isHome: boolean;
  activeNpc: NpcOpponent | null;
  homeStats: { mine: number; theirs: number };
  visitStats: { myEarnings: number };
  onCollectAll: () => void;
  onFineAll: () => void;
  onRecallAll: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[rgba(0,0,0,0.08)] bg-[#ddd5cb] px-3 py-2">
      {isHome ? (
        <>
          <div className="min-w-0 flex-1 text-[12px] text-[#6b5e52]">
            <span className="text-[13px] font-bold text-[#2d5a27]">{t(msg`我的车场`)}</span>
            {homeStats.mine > 0 && (
              <span className="ml-2">
                {t(msg`待收`)}{" "}
                <span className="font-semibold text-[#15803d]">
                  ¥{homeStats.mine.toFixed(2)}
                </span>
              </span>
            )}
            {homeStats.theirs > 0 && (
              <span className="ml-2">
                {t(msg`外来`)}{" "}
                <span className="font-semibold text-[#c2410c]">
                  ¥{homeStats.theirs.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          <GameBtn color="green" onClick={onCollectAll} disabled={homeStats.mine <= 0}>
            {t(msg`全部收钱`)}
          </GameBtn>
          <GameBtn color="orange" onClick={onFineAll} disabled={homeStats.theirs <= 0}>
            {t(msg`全部贴条`)}
          </GameBtn>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1 text-[12px] text-[#6b5e52]">
            <span className="text-[13px] font-bold text-[#d65e2f]">
              {activeNpc?.name ?? ""}{t(msg`的车场`)}
            </span>
            {visitStats.myEarnings > 0 && (
              <span className="ml-2">
                {t(msg`我的车`)}{" "}
                <span className="font-semibold text-[#0284c7]">
                  ¥{visitStats.myEarnings.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          <GameBtn color="blue" onClick={onRecallAll} disabled={visitStats.myEarnings <= 0}>
            {t(msg`全部开走`)}
          </GameBtn>
        </>
      )}
    </div>
  );
}

function GameBtn({
  color,
  onClick,
  disabled,
  children,
}: {
  color: "green" | "orange" | "blue";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "shrink-0 rounded-lg px-3 py-1 text-[12px] font-bold text-white transition-opacity disabled:opacity-40";
  const bg =
    color === "green"
      ? "bg-[#2d5a27] hover:bg-[#3d7a37]"
      : color === "orange"
        ? "bg-[#ea580c] hover:bg-[#c2410c]"
        : "bg-[#0284c7] hover:bg-[#0369a1]";
  return (
    <button type="button" className={cn(base, bg)} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// HomeParkingGrid
// ─────────────────────────────────────────────

function HomeParkingGrid({
  lot,
  state,
  idleCarIds,
  onCollect,
  onFine,
  onKick,
  onParkHome,
}: {
  lot: { slots: Slot[] };
  state: ParkingWarState;
  idleCarIds: string[];
  onCollect: (i: number) => void;
  onFine: (i: number) => void;
  onKick: (i: number) => void;
  onParkHome: (carId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {lot.slots.map((slot) => (
          <HomeBay
            key={slot.index}
            slot={slot}
            state={state}
            onCollect={() => onCollect(slot.index)}
            onFine={() => onFine(slot.index)}
            onKick={() => onKick(slot.index)}
          />
        ))}
      </div>

      {idleCarIds.length > 0 && (
        <div className="rounded-xl border border-[rgba(0,0,0,0.10)] bg-[rgba(255,255,255,0.65)] px-3 py-2">
          <div className="mb-1.5 text-[11px] font-medium text-[#8a7e74]">
            {t(msg`车库里还有空着的车`)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {idleCarIds.map((carId) => {
              const car = state.ownedCars.find((c) => c.carId === carId);
              if (!car) return null;
              const spec = CAR_SPECS[car.tier];
              return (
                <button
                  key={carId}
                  type="button"
                  onClick={() => onParkHome(carId)}
                  className="rounded-lg border border-[rgba(45,90,39,0.30)] bg-[#f0fdf4] px-2.5 py-1 text-[12px] font-medium text-[#15803d] hover:bg-[#dcfce7]"
                >
                  {spec.emoji} {t(msg`停`)} {spec.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeBay({
  slot,
  state,
  onCollect,
  onFine,
  onKick,
}: {
  slot: Slot;
  state: ParkingWarState;
  onCollect: () => void;
  onFine: () => void;
  onKick: () => void;
}) {
  if (!slot.parked) {
    return (
      <div className="flex min-h-[108px] flex-col rounded-xl border-2 border-dashed border-[#c8bdb2] bg-[#f9f5f0] p-2">
        <div className="font-mono text-[10px] text-[#b0a89e]">#{slot.index + 1}</div>
        <div className="flex flex-1 items-center justify-center text-[11px] text-[#c8bdb2]">
          {t(msg`空位`)}
        </div>
      </div>
    );
  }

  const { source, pendingEarnings } = slot.parked;
  const isPlayer = source.kind === "player";
  const spec = isPlayer ? CAR_SPECS[inferTierFromCarId(source.carId)] : null;
  const npc = !isPlayer ? getNpcById(source.npcId) : null;
  const emoji = isPlayer ? (spec?.emoji ?? "🚗") : (npc?.carEmoji ?? "🚗");
  const ownerLabel = isPlayer ? t(msg`我的`) : (npc?.name ?? t(msg`陌生人`));

  return (
    <div
      className={cn(
        "flex min-h-[108px] flex-col rounded-xl border-2 p-2",
        isPlayer ? "border-[#86efac] bg-[#f0fdf4]" : "border-[#fb923c] bg-[#fff7ed]",
      )}
    >
      <div className="font-mono text-[10px] text-[#b0a89e]">#{slot.index + 1}</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1">
        <div className="text-[30px] leading-none">{emoji}</div>
        <div className="text-center text-[10px] font-medium text-[#6b5e52]">{ownerLabel}</div>
        <div
          className={cn(
            "text-[14px] font-bold tabular-nums",
            isPlayer ? "text-[#15803d]" : "text-[#c2410c]",
          )}
        >
          ¥{pendingEarnings.toFixed(2)}
        </div>
      </div>
      <div className="mt-1">
        {isPlayer ? (
          <button
            type="button"
            onClick={onCollect}
            disabled={pendingEarnings <= 0}
            className="w-full rounded-lg bg-[#2d5a27] py-1 text-center text-[11px] font-bold text-white disabled:opacity-40"
          >
            {t(msg`收钱`)}
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onFine}
              className="flex-1 rounded-lg bg-[#ea580c] py-1 text-center text-[11px] font-bold text-white"
            >
              {t(msg`贴条`)}
            </button>
            <button
              type="button"
              onClick={onKick}
              className="flex-1 rounded-lg border border-[#d1c7bb] bg-white py-1 text-center text-[11px] font-medium text-[#6b5e52]"
            >
              {t(msg`赶走`)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// NpcParkingGrid
// ─────────────────────────────────────────────

function NpcParkingGrid({
  npc,
  lot,
  idleCarIds,
  ownedCars,
  onPark,
  onRecall,
}: {
  npc: NpcOpponent;
  lot: Lot;
  idleCarIds: string[];
  ownedCars: OwnedCar[];
  onPark: (slotIndex: number, carId: string) => void;
  onRecall: (slotIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(214,94,47,0.20)] bg-[rgba(255,247,238,0.85)] px-3 py-2">
        <span className="text-[24px]">{NPC_AVATAR_EMOJI[npc.id] ?? "👤"}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[#d65e2f]">{npc.name}{t(msg`的车场`)}</div>
          <div className="truncate text-[11px] italic text-[#8a7e74]">"{npc.welcomeQuote}"</div>
        </div>
        <div className="shrink-0 text-right text-[10px] text-[#8a7e74]">
          <div>¥{npc.carRatePerMinute}{t(msg`/分钟`)}</div>
          <div>{t(msg`贴条`)} {(npc.fineRiskPerMinute * 100).toFixed(0)}{t(msg`%/分钟`)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {lot.slots.map((slot) => (
          <NpcBay
            key={slot.index}
            slot={slot}
            npc={npc}
            idleCarIds={idleCarIds}
            ownedCars={ownedCars}
            onPark={(carId) => onPark(slot.index, carId)}
            onRecall={() => onRecall(slot.index)}
          />
        ))}
      </div>
    </div>
  );
}

function NpcBay({
  slot,
  npc,
  idleCarIds,
  ownedCars,
  onPark,
  onRecall,
}: {
  slot: Slot;
  npc: NpcOpponent;
  idleCarIds: string[];
  ownedCars: OwnedCar[];
  onPark: (carId: string) => void;
  onRecall: () => void;
}) {
  if (!slot.parked) {
    return (
      <div className="flex min-h-[108px] flex-col rounded-xl border-2 border-dashed border-[#c8bdb2] bg-[#f9f5f0] p-2">
        <div className="font-mono text-[10px] text-[#b0a89e]">#{slot.index + 1}</div>
        {idleCarIds.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-[10px] text-[#c8bdb2]">
            {t(msg`没空闲的车`)}
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-end gap-1 pt-1">
            {idleCarIds.map((carId) => {
              const car = ownedCars.find((c) => c.carId === carId);
              if (!car) return null;
              const spec = CAR_SPECS[car.tier];
              return (
                <button
                  key={carId}
                  type="button"
                  onClick={() => onPark(carId)}
                  className="w-full rounded-lg bg-[#0284c7] py-1 text-center text-[11px] font-bold text-white hover:bg-[#0369a1]"
                >
                  {spec.emoji} {t(msg`停进来`)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const { source, pendingEarnings } = slot.parked;
  const isPlayer = source.kind === "player";
  const npcOwner = !isPlayer ? getNpcById(source.npcId) : null;
  const emoji = isPlayer
    ? (() => {
        const car = ownedCars.find((c) => c.carId === source.carId);
        return car ? CAR_SPECS[car.tier].emoji : "🚗";
      })()
    : (npcOwner?.carEmoji ?? npc.carEmoji);
  const ownerLabel = isPlayer ? t(msg`我的车`) : (npcOwner?.name ?? npc.name);

  return (
    <div
      className={cn(
        "flex min-h-[108px] flex-col rounded-xl border-2 p-2",
        isPlayer ? "border-[#38bdf8] bg-[#f0f9ff]" : "border-[#cbd5e1] bg-[#f8fafc]",
      )}
    >
      <div className="font-mono text-[10px] text-[#b0a89e]">#{slot.index + 1}</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1">
        <div className="text-[30px] leading-none">{emoji}</div>
        <div className="text-center text-[10px] font-medium text-[#6b5e52]">{ownerLabel}</div>
        <div
          className={cn(
            "text-[14px] font-bold tabular-nums",
            isPlayer ? "text-[#0284c7]" : "text-[#94a3b8]",
          )}
        >
          {isPlayer ? `¥${pendingEarnings.toFixed(2)}` : t(msg`对方的车`)}
        </div>
      </div>
      {isPlayer && (
        <button
          type="button"
          onClick={onRecall}
          className="mt-1 w-full rounded-lg bg-[#0284c7] py-1 text-center text-[11px] font-bold text-white"
        >
          {t(msg`开走收钱`)}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MoreSheet
// ─────────────────────────────────────────────

function MoreSheet({
  sheetView,
  setSheetView,
  state,
  leaderboard,
  onBuy,
  onReset,
}: {
  sheetView: SheetView;
  setSheetView: (v: SheetView) => void;
  state: ParkingWarState;
  leaderboard: LeaderboardEntry[];
  onBuy: (tier: CarTier) => void;
  onReset: () => void;
}) {
  const tabs: { key: NonNullable<SheetView>; label: string; icon: string }[] = [
    { key: "leaderboard", label: t(msg`排行榜`), icon: "🏆" },
    { key: "log", label: t(msg`足迹`), icon: "📋" },
    { key: "garage", label: t(msg`车库`), icon: "🔧" },
  ];

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[rgba(0,0,0,0.45)]">
      <div
        className="flex flex-1 flex-col rounded-t-3xl bg-white"
        style={{ marginTop: "8%" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.08)] px-4 py-3">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSheetView(tab.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                  sheetView === tab.key
                    ? "bg-[#2d5a27] text-white"
                    : "text-[#6b5e52] hover:bg-[rgba(0,0,0,0.06)]",
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSheetView(null)}
            aria-label={t(msg`关闭`)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(0,0,0,0.08)] hover:bg-[rgba(0,0,0,0.14)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {sheetView === "leaderboard" ? (
            <LeaderboardPanel rows={leaderboard} />
          ) : sheetView === "log" ? (
            <VisitLogPanel entries={state.visitLog} />
          ) : (
            <GaragePanel state={state} onBuy={onBuy} onReset={onReset} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LeaderboardPanel
// ─────────────────────────────────────────────

function LeaderboardPanel({ rows }: { rows: LeaderboardEntry[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#6b5e52]">
        <Trophy size={15} className="text-[#d65e2f]" /> {t(msg`财富榜（NPC 含被动收益）`)}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              row.rank === 1
                ? "border-[#fde68a] bg-[#fffbeb]"
                : row.rank === 2
                  ? "border-[#e5e7eb] bg-[#f9fafb]"
                  : row.rank === 3
                    ? "border-[#f5d0a9] bg-[#fef3e7]"
                    : "border-[rgba(0,0,0,0.08)] bg-white",
              row.isPlayer && "ring-1 ring-[#2d5a27]",
            )}
          >
            <div className="w-7 shrink-0 text-center text-[15px] font-semibold">
              {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
            </div>
            <div className="flex-1 text-[14px] font-medium">
              {row.name}
              {row.isPlayer && (
                <span className="ml-2 rounded-full bg-[#2d5a27] px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {t(msg`你`)}
                </span>
              )}
            </div>
            <div className="shrink-0 font-semibold text-[#15803d]">
              ¥{row.balance.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// VisitLogPanel
// ─────────────────────────────────────────────

function VisitLogPanel({ entries }: { entries: VisitLogEntry[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#6b5e52]">
        <History size={15} className="text-[#d65e2f]" /> {t(msg`最近`)} {entries.length} {t(msg`条动态`)}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.12)] px-3 py-8 text-center text-[12px] text-[#9ca3af]">
          {t(msg`还没有动静，先停一辆车试试。`)}
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[12px]"
            >
              <div>{entry.text}</div>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#9ca3af]">
                <span>{formatRelative(entry.atMs)}</span>
                {typeof entry.amount === "number" && entry.amount > 0 && (
                  <span className="font-medium text-[#b45309]">
                    ¥{entry.amount.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// GaragePanel
// ─────────────────────────────────────────────

function GaragePanel({
  state,
  onBuy,
  onReset,
}: {
  state: ParkingWarState;
  onBuy: (tier: CarTier) => void;
  onReset: () => void;
}) {
  const ownedTopTierIdx = state.ownedCars.reduce(
    (max, car) => Math.max(max, CAR_TIER_ORDER.indexOf(car.tier)),
    -1,
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[rgba(0,0,0,0.10)] bg-white px-3 py-2.5">
        <div className="text-[13px] font-semibold">{t(msg`我的车`)}</div>
        <div className="mt-0.5 text-[11px] text-[#9ca3af]">
          {t(msg`最多同时拥有`)} {PLAYER_GARAGE_LIMIT} {t(msg`辆，已拥有`)} {state.ownedCars.length} {t(msg`辆`)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.ownedCars.map((car) => {
            const spec = CAR_SPECS[car.tier];
            const where = findPlayerCarLocation(state, car.carId);
            const whereLabel =
              where.kind === "home"
                ? `${t(msg`自家位`)} #${where.slotIndex + 1}`
                : where.kind === "npc"
                  ? `${getNpcById(where.npcId)?.name ?? t(msg`对方`)} ${t(msg`的车场`)}`
                  : t(msg`车库待命`);
            return (
              <div
                key={car.carId}
                className="rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#f9f5f1] px-2.5 py-1.5 text-[12px]"
              >
                {spec.emoji} {spec.name} · ¥{spec.ratePerMinute}{t(msg`/分钟`)} ·{" "}
                <span className="text-[#9ca3af]">{whereLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[12px] text-[#9ca3af]">{t(msg`买更高档的车，赚得更快`)}</div>
        {CAR_TIER_ORDER.map((tier, idx) => {
          if (tier === "starter") return null;
          const spec = CAR_SPECS[tier];
          const owned = state.ownedCars.some((car) => car.tier === tier);
          const cantUpgrade =
            idx <= ownedTopTierIdx ||
            owned ||
            state.balance < spec.unlockCost ||
            state.ownedCars.length >= PLAYER_GARAGE_LIMIT;
          return (
            <div
              key={tier}
              className="flex items-center justify-between rounded-xl border border-[rgba(0,0,0,0.10)] bg-white px-3 py-2.5"
            >
              <div>
                <div className="text-[13px] font-medium">
                  {spec.emoji} {spec.name}
                </div>
                <div className="text-[11px] text-[#9ca3af]">
                  ¥{spec.ratePerMinute}{t(msg`/分钟`)} · {t(msg`解锁`)} ¥{spec.unlockCost}
                </div>
              </div>
              <button
                type="button"
                disabled={cantUpgrade}
                onClick={() => onBuy(tier)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors",
                  owned
                    ? "border border-[#86efac] bg-[#f0fdf4] text-[#15803d]"
                    : cantUpgrade
                      ? "bg-[#f3f4f6] text-[#9ca3af]"
                      : "bg-[#2d5a27] text-white hover:bg-[#3d7a37]",
                )}
              >
                {owned ? t(msg`已拥有`) : t(msg`提车`)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.12)] px-3 py-2.5">
        <div className="text-[12px] font-medium text-[#9ca3af]">{t(msg`想从头来一遍？`)}</div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t(msg`确定要重置整个停车场吗？`))) onReset();
          }}
          className="mt-1.5 flex items-center gap-1 rounded-lg border border-[rgba(0,0,0,0.12)] bg-white px-3 py-1.5 text-[12px] text-[#6b5e52] hover:bg-[#f9f5f1]"
        >
          <RotateCcw size={12} /> {t(msg`重置存档`)}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function inferTierFromCarId(carId: string): CarTier {
  for (const tier of CAR_TIER_ORDER) {
    if (carId.includes(`-${tier}-`)) return tier;
  }
  return "starter";
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return t(msg`刚刚`);
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return t(msg`${minutes} 分钟前`);
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return t(msg`${hours} 小时前`);
  }
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
