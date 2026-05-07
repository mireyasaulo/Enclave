import { useMemo, useState } from "react";
import { Button, cn } from "@yinjie/ui";
import {
  ArrowLeft,
  Coins,
  Gavel,
  History,
  RotateCcw,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import {
  CAR_SPECS,
  CAR_TIER_ORDER,
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
  ParkedCar,
  ParkingWarState,
  Slot,
  VisitLogEntry,
} from "./parking-war-types";

type Variant = "embedded" | "fullscreen";

type ParkingWarGameProps = {
  variant?: Variant;
  onExit?: () => void;
};

type Scene = "home" | "visit" | "leaderboard" | "log" | "garage";

export function ParkingWarGame({
  variant = "fullscreen",
  onExit,
}: ParkingWarGameProps) {
  const { state, actions } = useParkingWarState();
  const [scene, setScene] = useState<Scene>("home");
  const [activeNpcId, setActiveNpcId] = useState<string>(
    NPC_OPPONENTS[0]?.id ?? "",
  );

  const npc = useMemo(() => getNpcById(activeNpcId), [activeNpcId]);
  const npcLot = activeNpcId ? state.npcLots[activeNpcId] : undefined;

  const idleCarIds = useMemo(() => {
    return state.ownedCars
      .map((car) => ({
        car,
        location: findPlayerCarLocation(state, car.carId),
      }))
      .filter((entry) => entry.location.kind === "garage")
      .map((entry) => entry.car.carId);
  }, [state]);

  const recentEvents = state.events.slice(-3).reverse();
  const leaderboard = useMemo(() => buildLeaderboard(state), [state]);

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

  return (
    <section
      className={cn(
        "relative flex flex-col bg-[linear-gradient(180deg,rgba(255,247,238,0.96),rgba(255,255,255,0.98))] text-[color:var(--text-primary)]",
        variant === "fullscreen"
          ? "fixed inset-0 z-50"
          : "h-full min-h-[560px] rounded-[24px] border border-[rgba(214,94,47,0.14)] shadow-[var(--shadow-card)]",
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3",
          variant === "fullscreen"
            ? "border-b border-[rgba(214,94,47,0.12)] bg-[rgba(255,250,244,0.96)]"
            : "border-b border-[rgba(214,94,47,0.10)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onExit ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="返回游戏中心"
              onClick={onExit}
            >
              {variant === "fullscreen" ? (
                <ArrowLeft size={18} />
              ) : (
                <X size={18} />
              )}
            </Button>
          ) : null}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">抢车位</div>
            <div className="truncate text-[11px] text-[color:var(--text-tertiary)]">
              和世界里的人抢一个能停的位
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[rgba(214,94,47,0.18)] bg-[rgba(255,244,236,0.92)] px-3 py-1.5 text-[13px] font-semibold text-[#d65e2f]">
          <Wallet size={14} />¥{state.balance.toFixed(2)}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-[rgba(214,94,47,0.08)] bg-[rgba(255,250,244,0.6)] px-3 py-2 text-[13px]">
        <SceneTab
          label="我的车场"
          active={scene === "home"}
          onClick={() => setScene("home")}
        />
        <SceneTab
          label="去蹭车位"
          active={scene === "visit"}
          onClick={() => setScene("visit")}
        />
        <SceneTab
          label="排行榜"
          active={scene === "leaderboard"}
          onClick={() => setScene("leaderboard")}
        />
        <SceneTab
          label="足迹"
          active={scene === "log"}
          onClick={() => setScene("log")}
        />
        <SceneTab
          label="车库"
          active={scene === "garage"}
          onClick={() => setScene("garage")}
        />
      </nav>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {scene === "home" ? (
          <HomeLotPanel
            state={state}
            mine={homeStats.mine}
            theirs={homeStats.theirs}
            onCollect={actions.collect}
            onCollectAll={actions.collectAll}
            onFine={actions.fine}
            onFineAll={actions.fineAll}
            onKick={actions.kick}
            onParkHome={actions.parkHome}
            idleCarIds={idleCarIds}
          />
        ) : scene === "visit" ? (
          <VisitPanel
            npcs={NPC_OPPONENTS}
            activeNpc={npc}
            activeNpcLot={npcLot}
            idleCarIds={idleCarIds}
            ownedCarTierByCarId={Object.fromEntries(
              state.ownedCars.map((car) => [car.carId, car.tier]),
            )}
            onSelectNpc={setActiveNpcId}
            onParkInNpc={(slotIndex, carId) => {
              if (!activeNpcId) return;
              actions.parkInNpc(activeNpcId, slotIndex, carId);
            }}
            onRecall={(slotIndex) => {
              if (!activeNpcId) return;
              actions.recall(activeNpcId, slotIndex);
            }}
          />
        ) : scene === "leaderboard" ? (
          <LeaderboardPanel rows={leaderboard} />
        ) : scene === "log" ? (
          <VisitLogPanel entries={state.visitLog} />
        ) : (
          <GaragePanel
            state={state}
            onBuy={actions.buy}
            onReset={actions.reset}
          />
        )}
      </div>

      {recentEvents.length > 0 ? (
        <div className="border-t border-[rgba(214,94,47,0.10)] bg-[rgba(255,250,244,0.92)] px-4 py-2 text-[12px]">
          {recentEvents.map((event) => (
            <div
              key={event.id}
              className={cn(
                "truncate",
                event.tone === "success" && "text-[#15803d]",
                event.tone === "warn" && "text-[#b45309]",
                event.tone === "info" && "text-[color:var(--text-secondary)]",
              )}
            >
              · {event.text}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SceneTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 transition-colors",
        active
          ? "bg-[#d65e2f] text-white shadow-[0_2px_6px_rgba(214,94,47,0.25)]"
          : "text-[color:var(--text-secondary)] hover:bg-[rgba(214,94,47,0.08)]",
      )}
    >
      {label}
    </button>
  );
}

function HomeLotPanel({
  state,
  mine,
  theirs,
  onCollect,
  onCollectAll,
  onFine,
  onFineAll,
  onKick,
  onParkHome,
  idleCarIds,
}: {
  state: ParkingWarState;
  mine: number;
  theirs: number;
  onCollect: (slotIndex: number) => void;
  onCollectAll: () => void;
  onFine: (slotIndex: number) => void;
  onFineAll: () => void;
  onKick: (slotIndex: number) => void;
  onParkHome: (carId: string) => void;
  idleCarIds: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(214,94,47,0.14)] bg-white px-3 py-2">
        <div className="flex-1 text-[12px] text-[color:var(--text-secondary)]">
          自家车待收 <span className="font-semibold text-[#15803d]">¥{mine.toFixed(2)}</span>
          ，外来车囤了 <span className="font-semibold text-[#b45309]">¥{theirs.toFixed(2)}</span>
        </div>
        <Button size="sm" variant="primary" onClick={onCollectAll} disabled={mine <= 0}>
          <Coins size={14} /> 全部收钱
        </Button>
        <Button size="sm" variant="secondary" onClick={onFineAll} disabled={theirs <= 0}>
          <Gavel size={14} /> 全部贴条
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {state.playerLot.slots.map((slot) => (
          <PlayerSlotCard
            key={slot.index}
            slot={slot}
            onCollect={() => onCollect(slot.index)}
            onFine={() => onFine(slot.index)}
            onKick={() => onKick(slot.index)}
          />
        ))}
      </div>

      {idleCarIds.length > 0 ? (
        <div className="rounded-2xl border border-[rgba(214,94,47,0.14)] bg-white px-3 py-2.5">
          <div className="text-[12px] font-medium text-[color:var(--text-secondary)]">
            车库里还有空着的车
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {idleCarIds.map((carId) => {
              const car = state.ownedCars.find((entry) => entry.carId === carId);
              if (!car) return null;
              const spec = CAR_SPECS[car.tier];
              return (
                <Button
                  key={carId}
                  size="sm"
                  variant="secondary"
                  onClick={() => onParkHome(carId)}
                >
                  {spec.emoji} 停回 {spec.name}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerSlotCard({
  slot,
  onCollect,
  onFine,
  onKick,
}: {
  slot: Slot;
  onCollect: () => void;
  onFine: () => void;
  onKick: () => void;
}) {
  if (!slot.parked) {
    return (
      <div className="flex aspect-[5/4] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(214,94,47,0.30)] bg-[rgba(255,247,238,0.6)] text-[12px] text-[color:var(--text-tertiary)]">
        空位 #{slot.index + 1}
      </div>
    );
  }
  return (
    <SlotCard
      parked={slot.parked}
      footer={
        slot.parked.source.kind === "player" ? (
          <Button
            size="sm"
            variant="primary"
            className="w-full"
            onClick={onCollect}
            disabled={slot.parked.pendingEarnings <= 0}
          >
            <Coins size={14} /> 收钱
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="primary" onClick={onFine}>
              贴条
            </Button>
            <Button size="sm" variant="ghost" onClick={onKick}>
              赶走
            </Button>
          </div>
        )
      }
    />
  );
}

function SlotCard({
  parked,
  footer,
}: {
  parked: ParkedCar;
  footer: React.ReactNode;
}) {
  const source = parked.source;
  const isPlayer = source.kind === "player";
  const spec =
    source.kind === "player" ? CAR_SPECS[inferTierFromCarId(source.carId)] : null;
  const npc = source.kind === "npc" ? getNpcById(source.npcId) : null;
  const emoji = isPlayer ? spec?.emoji ?? "🚗" : npc?.carEmoji ?? "🚗";
  const ownerLabel = isPlayer ? "我的" : npc?.name ?? "陌生人";
  const carName = isPlayer ? spec?.name ?? "我的车" : npc?.carName ?? "对方的车";

  return (
    <div
      className={cn(
        "flex aspect-[5/4] flex-col justify-between rounded-2xl border bg-white px-3 py-2.5",
        isPlayer
          ? "border-[rgba(214,94,47,0.18)] shadow-[0_2px_8px_rgba(214,94,47,0.08)]"
          : "border-[rgba(180,83,9,0.20)] bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]",
      )}
    >
      <div>
        <div className="text-[28px] leading-none">{emoji}</div>
        <div className="mt-1 truncate text-[12px] font-medium text-[color:var(--text-secondary)]">
          {ownerLabel} · {carName}
        </div>
        <div
          className={cn(
            "mt-0.5 text-[14px] font-semibold",
            isPlayer ? "text-[#15803d]" : "text-[#b45309]",
          )}
        >
          ¥{parked.pendingEarnings.toFixed(2)}
        </div>
      </div>
      <div className="mt-2">{footer}</div>
    </div>
  );
}

function inferTierFromCarId(carId: string): CarTier {
  for (const tier of CAR_TIER_ORDER) {
    if (carId.includes(`-${tier}-`)) return tier;
  }
  return "starter";
}

function VisitPanel({
  npcs,
  activeNpc,
  activeNpcLot,
  idleCarIds,
  ownedCarTierByCarId,
  onSelectNpc,
  onParkInNpc,
  onRecall,
}: {
  npcs: NpcOpponent[];
  activeNpc: NpcOpponent | null;
  activeNpcLot: Lot | undefined;
  idleCarIds: string[];
  ownedCarTierByCarId: Record<string, CarTier>;
  onSelectNpc: (npcId: string) => void;
  onParkInNpc: (slotIndex: number, carId: string) => void;
  onRecall: (slotIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {npcs.map((npc) => (
          <button
            key={npc.id}
            type="button"
            onClick={() => onSelectNpc(npc.id)}
            className={cn(
              "flex shrink-0 flex-col items-start rounded-2xl border px-3 py-2 text-left transition-colors",
              activeNpc?.id === npc.id
                ? "border-[#d65e2f] bg-[rgba(214,94,47,0.08)] text-[#d65e2f]"
                : "border-[rgba(214,94,47,0.14)] bg-white text-[color:var(--text-secondary)] hover:bg-[rgba(255,247,238,0.8)]",
            )}
          >
            <div className="text-[13px] font-medium">{npc.name}</div>
            <div className="text-[11px] text-[color:var(--text-tertiary)]">
              {npc.carName}
            </div>
          </button>
        ))}
      </div>

      {activeNpc && activeNpcLot ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[rgba(214,94,47,0.12)] bg-white px-3 py-2.5">
            <div className="text-[13px] font-semibold">{activeNpc.name} 的车场</div>
            <div className="mt-0.5 text-[12px] italic text-[color:var(--text-secondary)]">
              "{activeNpc.welcomeQuote}"
            </div>
            <div className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
              {activeNpc.blurb} · 每分钟可收 ¥{activeNpc.carRatePerMinute} · 贴条概率 {(activeNpc.fineRiskPerMinute * 100).toFixed(0)}%/分钟
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {activeNpcLot.slots.map((slot) => (
              <NpcSlotCard
                key={slot.index}
                slot={slot}
                idleCarIds={idleCarIds}
                ownedCarTierByCarId={ownedCarTierByCarId}
                onPark={(carId) => onParkInNpc(slot.index, carId)}
                onRecall={() => onRecall(slot.index)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NpcSlotCard({
  slot,
  idleCarIds,
  ownedCarTierByCarId,
  onPark,
  onRecall,
}: {
  slot: Slot;
  idleCarIds: string[];
  ownedCarTierByCarId: Record<string, CarTier>;
  onPark: (carId: string) => void;
  onRecall: () => void;
}) {
  if (!slot.parked) {
    return (
      <div className="flex aspect-[5/4] flex-col rounded-2xl border border-dashed border-[rgba(214,94,47,0.30)] bg-[rgba(255,247,238,0.6)] px-3 py-2.5">
        <div className="text-[12px] font-medium text-[color:var(--text-tertiary)]">
          空位 #{slot.index + 1}
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {idleCarIds.length === 0 ? (
            <div className="text-[11px] text-[color:var(--text-tertiary)]">
              没空闲的车
            </div>
          ) : (
            idleCarIds.map((carId) => {
              const tier = ownedCarTierByCarId[carId];
              const spec = tier ? CAR_SPECS[tier] : CAR_SPECS.starter;
              return (
                <Button
                  key={carId}
                  size="sm"
                  variant="primary"
                  onClick={() => onPark(carId)}
                >
                  {spec.emoji} 停 {spec.name}
                </Button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <SlotCard
      parked={slot.parked}
      footer={
        slot.parked.source.kind === "player" ? (
          <Button size="sm" variant="primary" className="w-full" onClick={onRecall}>
            <Coins size={14} /> 开走收钱
          </Button>
        ) : (
          <div className="text-center text-[11px] text-[color:var(--text-tertiary)]">
            对方自己的车，蹭不了
          </div>
        )
      }
    />
  );
}

function LeaderboardPanel({ rows }: { rows: LeaderboardEntry[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--text-secondary)]">
        <Trophy size={15} className="text-[#d65e2f]" /> 财富榜（含 NPC 自家车场被动收益）
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const tone =
            row.rank === 1
              ? "border-[rgba(214,94,47,0.30)] bg-[rgba(255,244,236,0.96)]"
              : row.rank === 2
                ? "border-[rgba(180,83,9,0.18)] bg-[rgba(255,250,240,0.96)]"
                : row.rank === 3
                  ? "border-[rgba(180,83,9,0.14)] bg-white"
                  : "border-[rgba(214,94,47,0.10)] bg-white";
          return (
            <div
              key={`${row.rank}-${row.name}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                tone,
                row.isPlayer && "ring-1 ring-[#d65e2f]",
              )}
            >
              <div
                className={cn(
                  "w-7 shrink-0 text-center text-[15px] font-semibold",
                  row.rank === 1
                    ? "text-[#d65e2f]"
                    : row.rank === 2
                      ? "text-[#b45309]"
                      : "text-[color:var(--text-tertiary)]",
                )}
              >
                {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
              </div>
              <div className="flex-1 text-[14px] font-medium">
                {row.name}
                {row.isPlayer ? (
                  <span className="ml-2 rounded-full bg-[#d65e2f] px-1.5 py-0.5 text-[10px] font-medium text-white">
                    你
                  </span>
                ) : null}
              </div>
              <div className="font-semibold text-[#15803d]">
                ¥{row.balance.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitLogPanel({ entries }: { entries: VisitLogEntry[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--text-secondary)]">
        <History size={15} className="text-[#d65e2f]" /> 最近 {entries.length} 条停车场动态
      </div>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(214,94,47,0.20)] bg-white px-3 py-6 text-center text-[12px] text-[color:var(--text-tertiary)]">
          还没有动静，先停一辆车试试。
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-[rgba(214,94,47,0.10)] bg-white px-3 py-2 text-[12px]"
            >
              <div className="text-[color:var(--text-primary)]">{entry.text}</div>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-[color:var(--text-tertiary)]">
                <span>{formatRelative(entry.atMs)}</span>
                {typeof entry.amount === "number" && entry.amount > 0 ? (
                  <span className="font-medium text-[#b45309]">
                    ¥{entry.amount.toFixed(2)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "刚刚";
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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
      <div className="rounded-2xl border border-[rgba(214,94,47,0.12)] bg-white px-3 py-2.5">
        <div className="text-[13px] font-semibold">我的车</div>
        <div className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
          最多同时拥有 {PLAYER_GARAGE_LIMIT} 辆，已拥有 {state.ownedCars.length} 辆
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.ownedCars.map((car) => {
            const spec = CAR_SPECS[car.tier];
            const where = findPlayerCarLocation(state, car.carId);
            const whereLabel =
              where.kind === "home"
                ? `自家位 #${where.slotIndex + 1}`
                : where.kind === "npc"
                  ? `${getNpcById(where.npcId)?.name ?? "对方"} 的车场`
                  : "车库待命";
            return (
              <div
                key={car.carId}
                className="rounded-xl border border-[rgba(214,94,47,0.12)] bg-[rgba(255,250,244,0.6)] px-2.5 py-1.5 text-[12px]"
              >
                {spec.emoji} {spec.name} · ¥{spec.ratePerMinute}/分钟 ·{" "}
                <span className="text-[color:var(--text-tertiary)]">
                  {whereLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[12px] text-[color:var(--text-secondary)]">
          买更高档的车，赚得快、被贴条心也疼
        </div>
        {CAR_TIER_ORDER.map((tier, idx) => {
          const spec = CAR_SPECS[tier];
          const owned = state.ownedCars.some((car) => car.tier === tier);
          if (tier === "starter") return null;
          const cantUpgrade =
            idx <= ownedTopTierIdx ||
            owned ||
            state.balance < spec.unlockCost ||
            state.ownedCars.length >= PLAYER_GARAGE_LIMIT;
          return (
            <div
              key={tier}
              className="flex items-center justify-between rounded-2xl border border-[rgba(214,94,47,0.12)] bg-white px-3 py-2.5"
            >
              <div>
                <div className="text-[13px] font-medium">
                  {spec.emoji} {spec.name}
                </div>
                <div className="text-[11px] text-[color:var(--text-tertiary)]">
                  ¥{spec.ratePerMinute}/分钟 · 解锁 ¥{spec.unlockCost}
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={cantUpgrade}
                onClick={() => onBuy(tier)}
              >
                {owned ? "已拥有" : "提车"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-[rgba(214,94,47,0.20)] bg-[rgba(255,247,238,0.6)] px-3 py-2.5">
        <div className="text-[12px] font-medium text-[color:var(--text-secondary)]">
          想从头来一遍？
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-1.5"
          onClick={() => {
            if (window.confirm("确定要重置整个停车场吗？")) onReset();
          }}
        >
          <RotateCcw size={14} /> 重置存档
        </Button>
      </div>
    </div>
  );
}
