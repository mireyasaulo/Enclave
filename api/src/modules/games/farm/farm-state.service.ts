import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharactersService } from '../../characters/characters.service';
import { WorldOwnerService } from '../../auth/world-owner.service';
import { FarmEventService } from './farm-event.service';
import { FarmNpcStateEntity } from './entities/farm-npc-state.entity';
import { FarmPlayerStateEntity } from './entities/farm-player-state.entity';
import {
  FARM_CROP_CATALOG,
  computeLevelFromExperience,
  computeMaturedAtMs,
  computePlotCountForLevel,
  computeRottenAtMs,
  getCropDefinition,
  isFarmCropId,
} from './crop-catalog';
import {
  FARM_DEFAULT_PLAYER_COINS,
  FARM_DEFAULT_PLAYER_SEED_BAG,
  FARM_DEFAULT_PLOT_COUNT,
  FARM_PLAYER_ACTOR_ID,
  FARM_PLAYER_DAILY_STEAL_LIMIT,
  FarmCropId,
  FarmHarvestResult,
  FarmNeighborSummary,
  FarmPlayerStateView,
  FarmPlot,
  FarmStealResult,
  FarmStolenLogEntry,
} from './farm.types';

interface MaintenanceTarget {
  kind: 'self' | 'npc';
  plotIndex: number;
  characterId?: string;
}

const WEEKLY_STOLEN_LOG_KEEP_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class FarmStateService {
  constructor(
    @InjectRepository(FarmPlayerStateEntity)
    private readonly playerRepo: Repository<FarmPlayerStateEntity>,
    @InjectRepository(FarmNpcStateEntity)
    private readonly npcRepo: Repository<FarmNpcStateEntity>,
    private readonly worldOwnerService: WorldOwnerService,
    private readonly eventService: FarmEventService,
    private readonly charactersService: CharactersService,
  ) {}

  async getOrCreatePlayerState(
    ownerId: string,
  ): Promise<FarmPlayerStateEntity> {
    let state = await this.playerRepo.findOneBy({ ownerId });
    if (!state) {
      state = this.playerRepo.create({
        ownerId,
        coins: FARM_DEFAULT_PLAYER_COINS,
        experience: 0,
        level: 1,
        plotCount: FARM_DEFAULT_PLOT_COUNT,
        plotsPayload: createEmptyPlots(FARM_DEFAULT_PLOT_COUNT),
        warehousePayload: {},
        seedBagPayload: { ...FARM_DEFAULT_PLAYER_SEED_BAG },
        weeklyStolenLogPayload: [],
        lastTickAt: null,
      });
      state = await this.playerRepo.save(state);
    } else {
      let mutated = false;
      const desiredPlotCount = computePlotCountForLevel(state.level);
      if (desiredPlotCount > state.plotCount) {
        state.plotCount = desiredPlotCount;
        mutated = true;
      }
      const plots = ensurePlotsArray(state.plotsPayload, state.plotCount);
      if (plots !== state.plotsPayload) {
        state.plotsPayload = plots;
        mutated = true;
      }
      const warehouse = state.warehousePayload ?? {};
      if (!state.warehousePayload) {
        state.warehousePayload = warehouse;
        mutated = true;
      }
      const seedBag = state.seedBagPayload ?? { ...FARM_DEFAULT_PLAYER_SEED_BAG };
      if (!state.seedBagPayload) {
        state.seedBagPayload = seedBag;
        mutated = true;
      }
      const stolen = pruneStolenLog(state.weeklyStolenLogPayload ?? []);
      if (stolen !== state.weeklyStolenLogPayload) {
        state.weeklyStolenLogPayload = stolen;
        mutated = true;
      }
      if (mutated) {
        state = await this.playerRepo.save(state);
      }
    }
    return state;
  }

  async getPlayerStateView(ownerId: string): Promise<FarmPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    return this.toPlayerView(state);
  }

  async resolveOwnerId(): Promise<string> {
    const owner = await this.worldOwnerService.getOwnerOrThrow();
    return owner.id;
  }

  async plant(
    ownerId: string,
    plotIndex: number,
    cropId: FarmCropId,
  ): Promise<FarmPlayerStateView> {
    if (!isFarmCropId(cropId)) {
      throw new BadRequestException(`未知作物：${cropId}`);
    }
    const def = getCropDefinition(cropId);
    const state = await this.getOrCreatePlayerState(ownerId);
    if (state.level < def.unlockLevel) {
      throw new ForbiddenException(`等级不足：需 ${def.unlockLevel} 级才能种 ${def.nameZh}`);
    }
    const plots = ensurePlotsArray(state.plotsPayload, state.plotCount).map((p) => ({ ...p }));
    const plot = plots[plotIndex];
    if (!plot) throw new NotFoundException('田块不存在');
    if (plot.stage !== 'empty' && plot.stage !== 'rotten') {
      throw new BadRequestException('该田块当前不能种植');
    }

    const seedBag = { ...(state.seedBagPayload ?? {}) };
    const haveSeeds = (seedBag[cropId] ?? 0) > 0;
    if (haveSeeds) {
      seedBag[cropId] = (seedBag[cropId] ?? 0) - 1;
    } else {
      if (state.coins < def.seedCost) {
        throw new BadRequestException(`金币不足：需 ${def.seedCost}`);
      }
      state.coins -= def.seedCost;
    }

    const now = Date.now();
    plots[plotIndex] = {
      index: plotIndex,
      cropId,
      plantedAt: now,
      maturedAt: computeMaturedAtMs(cropId, now),
      stage: 'seed',
      watered: false,
      weeds: 0,
      bugs: 0,
      stolenBy: [],
      plantedBy: FARM_PLAYER_ACTOR_ID,
    };

    state.plotsPayload = plots;
    state.seedBagPayload = seedBag;
    const saved = await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'plant',
      actorType: 'owner',
      actorId: FARM_PLAYER_ACTOR_ID,
      actorName: '我',
      cropId,
      payload: { plotIndex, viaSeedBag: haveSeeds },
    });

    return this.toPlayerView(saved);
  }

  async harvest(ownerId: string, plotIndex: number): Promise<FarmHarvestResult> {
    const state = await this.getOrCreatePlayerState(ownerId);
    const plots = ensurePlotsArray(state.plotsPayload, state.plotCount).map((p) => ({ ...p }));
    const plot = plots[plotIndex];
    if (!plot) throw new NotFoundException('田块不存在');
    if (!plot.cropId || plot.maturedAt == null) {
      throw new BadRequestException('该田块没有作物');
    }
    const now = Date.now();
    if (now < plot.maturedAt) {
      throw new BadRequestException('作物还没成熟');
    }
    const def = getCropDefinition(plot.cropId);
    const isRotten = now >= computeRottenAtMs(plot.cropId, plot.plantedAt!);
    const baseAmount = plot.yieldOverride ?? rollYield(def.yieldRange);
    const stolenAmount = (plot.stolenBy ?? []).length;
    const remainingAmount = Math.max(1, baseAmount - stolenAmount);
    const amount = isRotten ? Math.max(1, Math.floor(remainingAmount / 2)) : remainingAmount;
    const coinsGained = amount * def.sellPrice;
    const xpGained = isRotten ? Math.floor(def.experience / 2) : def.experience;

    state.coins += coinsGained;
    state.experience += xpGained;
    const newLevel = computeLevelFromExperience(state.experience);
    const leveledUp = newLevel > state.level;
    state.level = newLevel;
    const desiredPlotCount = computePlotCountForLevel(state.level);
    if (desiredPlotCount > state.plotCount) {
      state.plotCount = desiredPlotCount;
    }

    const warehouse = { ...(state.warehousePayload ?? {}) };
    warehouse[plot.cropId] = (warehouse[plot.cropId] ?? 0) + amount;
    state.warehousePayload = warehouse;

    plots[plotIndex] = createEmptyPlot(plotIndex);
    if (state.plotCount > plots.length) {
      for (let i = plots.length; i < state.plotCount; i += 1) {
        plots.push(createEmptyPlot(i));
      }
    }
    state.plotsPayload = plots;

    const saved = await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'harvest',
      actorType: 'owner',
      actorId: FARM_PLAYER_ACTOR_ID,
      actorName: '我',
      cropId: plot.cropId,
      payload: { plotIndex, amount, coinsGained, isRotten, xpGained },
    });

    if (leveledUp) {
      await this.eventService.recordEvent({
        ownerId,
        kind: 'level_up',
        actorType: 'owner',
        actorId: FARM_PLAYER_ACTOR_ID,
        actorName: '我',
        payload: { level: state.level, plotCount: state.plotCount },
      });
    }

    return {
      player: this.toPlayerView(saved),
      harvested: {
        cropId: plot.cropId,
        amount,
        coinsGained,
        experienceGained: xpGained,
        leveledUp,
      },
    };
  }

  async waterPlot(
    ownerId: string,
    target: MaintenanceTarget,
  ): Promise<FarmPlayerStateView> {
    if (target.kind === 'npc') {
      throw new BadRequestException('对 NPC 浇水将在邻居模块开放');
    }
    return this.maintainSelfPlot(ownerId, target.plotIndex, 'water');
  }

  async weedPlot(
    ownerId: string,
    target: MaintenanceTarget,
  ): Promise<FarmPlayerStateView> {
    if (target.kind === 'npc') {
      throw new BadRequestException('对 NPC 除草将在邻居模块开放');
    }
    return this.maintainSelfPlot(ownerId, target.plotIndex, 'weed');
  }

  async debugPlot(
    ownerId: string,
    target: MaintenanceTarget,
  ): Promise<FarmPlayerStateView> {
    if (target.kind === 'npc') {
      throw new BadRequestException('对 NPC 除虫将在邻居模块开放');
    }
    return this.maintainSelfPlot(ownerId, target.plotIndex, 'debug');
  }

  async buySeed(
    ownerId: string,
    cropId: FarmCropId,
    quantity: number,
  ): Promise<FarmPlayerStateView> {
    if (!isFarmCropId(cropId)) {
      throw new BadRequestException(`未知作物：${cropId}`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('数量必须为正整数');
    }
    const def = getCropDefinition(cropId);
    const state = await this.getOrCreatePlayerState(ownerId);
    if (state.level < def.unlockLevel) {
      throw new ForbiddenException(`等级不足：需 ${def.unlockLevel} 级才能购买 ${def.nameZh} 种子`);
    }
    const totalCost = def.seedCost * quantity;
    if (state.coins < totalCost) {
      throw new BadRequestException(`金币不足：需 ${totalCost}`);
    }
    state.coins -= totalCost;
    const seedBag = { ...(state.seedBagPayload ?? {}) };
    seedBag[cropId] = (seedBag[cropId] ?? 0) + quantity;
    state.seedBagPayload = seedBag;
    const saved = await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'buy',
      actorType: 'owner',
      actorId: FARM_PLAYER_ACTOR_ID,
      actorName: '我',
      cropId,
      payload: { quantity, totalCost },
    });

    return this.toPlayerView(saved);
  }

  async sellCrop(
    ownerId: string,
    cropId: FarmCropId,
    quantity: number,
  ): Promise<FarmPlayerStateView> {
    if (!isFarmCropId(cropId)) {
      throw new BadRequestException(`未知作物：${cropId}`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('数量必须为正整数');
    }
    const def = getCropDefinition(cropId);
    const state = await this.getOrCreatePlayerState(ownerId);
    const warehouse = { ...(state.warehousePayload ?? {}) };
    const have = warehouse[cropId] ?? 0;
    if (have < quantity) {
      throw new BadRequestException(`仓库中 ${def.nameZh} 不足`);
    }
    warehouse[cropId] = have - quantity;
    state.warehousePayload = warehouse;
    const coinsGained = def.sellPrice * quantity;
    state.coins += coinsGained;
    const saved = await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'sell',
      actorType: 'owner',
      actorId: FARM_PLAYER_ACTOR_ID,
      actorName: '我',
      cropId,
      payload: { quantity, coinsGained },
    });

    return this.toPlayerView(saved);
  }

  async assertDailyStealQuota(state: FarmPlayerStateEntity): Promise<void> {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const recent = (state.weeklyStolenLogPayload ?? []).filter(
      (entry) => entry.atMs >= cutoff && entry.thiefCharacterId === FARM_PLAYER_ACTOR_ID,
    );
    if (recent.length >= FARM_PLAYER_DAILY_STEAL_LIMIT) {
      throw new ForbiddenException(
        `今日偷菜次数已达上限（${FARM_PLAYER_DAILY_STEAL_LIMIT}/天）`,
      );
    }
  }

  async stealFromNpc(
    ownerId: string,
    characterId: string,
    plotIndex: number,
  ): Promise<FarmStealResult> {
    const character = await this.charactersService.findById(characterId);
    if (!character) {
      throw new NotFoundException(`角色不存在：${characterId}`);
    }
    const isVisible = await this.charactersService.isVisibleToOwner(
      characterId,
      ownerId,
    );
    if (!isVisible) {
      throw new NotFoundException('该角色当前不可见');
    }
    const npc = await this.npcRepo.findOneBy({ characterId });
    if (!npc) {
      throw new NotFoundException('该角色还没有农场');
    }
    const npcPlots = ensurePlotsArray(npc.plotsPayload, npc.plotCount).map((p) => ({ ...p }));
    const plot = npcPlots[plotIndex];
    if (!plot) throw new NotFoundException('田块不存在');
    if (
      !plot.cropId ||
      plot.maturedAt == null ||
      Date.now() < plot.maturedAt
    ) {
      throw new BadRequestException('该作物还没成熟');
    }
    if ((plot.stolenBy ?? []).includes(FARM_PLAYER_ACTOR_ID)) {
      throw new BadRequestException('你已经偷过这块田了');
    }

    const player = await this.getOrCreatePlayerState(ownerId);
    await this.assertDailyStealQuota(player);

    const def = getCropDefinition(plot.cropId);
    const stolenAmount = Math.max(1, Math.floor((plot.yieldOverride ?? def.yieldRange[0]) / 2));
    const coinsGained = stolenAmount * Math.max(1, Math.floor(def.sellPrice / 2));

    plot.stolenBy = [...(plot.stolenBy ?? []), FARM_PLAYER_ACTOR_ID];
    npcPlots[plotIndex] = plot;
    npc.plotsPayload = npcPlots;
    await this.npcRepo.save(npc);

    const playerWarehouse = { ...(player.warehousePayload ?? {}) };
    playerWarehouse[plot.cropId] = (playerWarehouse[plot.cropId] ?? 0) + stolenAmount;
    player.warehousePayload = playerWarehouse;
    player.coins += coinsGained;
    const stolenLog = pruneStolenLog(player.weeklyStolenLogPayload ?? []);
    stolenLog.push({
      thiefCharacterId: FARM_PLAYER_ACTOR_ID,
      thiefName: '我',
      cropId: plot.cropId,
      amount: stolenAmount,
      atMs: Date.now(),
    });
    player.weeklyStolenLogPayload = stolenLog;
    const savedPlayer = await this.playerRepo.save(player);

    const intimacyDelta = -3;
    const newIntimacy = Math.max(0, Math.min(100, (character.intimacyLevel ?? 0) + intimacyDelta));
    if (newIntimacy !== character.intimacyLevel) {
      character.intimacyLevel = newIntimacy;
      await this.charactersService.upsert(character);
    }

    await this.eventService.recordEvent({
      ownerId,
      kind: 'steal',
      actorType: 'owner',
      actorId: FARM_PLAYER_ACTOR_ID,
      actorName: '我',
      targetType: 'character',
      targetId: characterId,
      targetName: character.name,
      cropId: plot.cropId,
      intimacyDelta,
      payload: { plotIndex, stolenAmount, coinsGained },
    });

    const target: FarmNeighborSummary = {
      characterId,
      characterName: character.name,
      characterAvatar: character.avatar ?? null,
      intimacyLevel: newIntimacy,
      isOnline: character.isOnline ?? false,
      ripePlotCount: npcPlots.filter(
        (p) => p.cropId && p.maturedAt != null && Date.now() >= p.maturedAt,
      ).length,
      totalPlotCount: npc.plotCount,
      level: npc.level,
      coins: npc.coins,
      lastActedAt:
        npc.lastActedAt instanceof Date
          ? npc.lastActedAt.toISOString()
          : npc.lastActedAt
            ? new Date(npc.lastActedAt).toISOString()
            : null,
      expertDomains: character.expertDomains ?? [],
      relationship: character.relationship ?? null,
    };

    return {
      player: this.toPlayerView(savedPlayer),
      target,
      stolen: {
        cropId: plot.cropId,
        amount: stolenAmount,
        coinsGained,
        intimacyDelta,
      },
    };
  }

  toPlayerView(state: FarmPlayerStateEntity): FarmPlayerStateView {
    const plots = ensurePlotsArray(state.plotsPayload, state.plotCount);
    const refreshed = plots.map((p) => refreshPlotStage(p, Date.now()));
    return {
      ownerId: state.ownerId,
      coins: state.coins,
      experience: state.experience,
      level: state.level,
      plotCount: state.plotCount,
      plots: refreshed,
      warehouse: state.warehousePayload ?? {},
      seedBag: state.seedBagPayload ?? {},
      weeklyStolenLog: pruneStolenLog(state.weeklyStolenLogPayload ?? []),
      serverNowMs: Date.now(),
      updatedAt:
        state.updatedAt instanceof Date
          ? state.updatedAt.toISOString()
          : new Date(state.updatedAt).toISOString(),
    };
  }

  private async maintainSelfPlot(
    ownerId: string,
    plotIndex: number,
    action: 'water' | 'weed' | 'debug',
  ): Promise<FarmPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    const plots = ensurePlotsArray(state.plotsPayload, state.plotCount).map((p) => ({ ...p }));
    const plot = plots[plotIndex];
    if (!plot) throw new NotFoundException('田块不存在');
    if (!plot.cropId) throw new BadRequestException('该田块没有作物');

    if (action === 'water') {
      if (plot.watered) throw new BadRequestException('该田块今日已浇过水');
      plot.watered = true;
    } else if (action === 'weed') {
      if (plot.weeds <= 0) throw new BadRequestException('该田块没有杂草');
      plot.weeds = 0;
    } else if (action === 'debug') {
      if (plot.bugs <= 0) throw new BadRequestException('该田块没有害虫');
      plot.bugs = 0;
    }

    plots[plotIndex] = plot;
    state.plotsPayload = plots;
    const saved = await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: action,
      actorType: 'owner',
      actorId: FARM_PLAYER_ACTOR_ID,
      actorName: '我',
      cropId: plot.cropId ?? null,
      payload: { plotIndex },
    });

    return this.toPlayerView(saved);
  }
}

export function createEmptyPlot(index: number): FarmPlot {
  return {
    index,
    cropId: null,
    plantedAt: null,
    maturedAt: null,
    stage: 'empty',
    watered: false,
    weeds: 0,
    bugs: 0,
    stolenBy: [],
  };
}

export function createEmptyPlots(count: number): FarmPlot[] {
  return Array.from({ length: count }, (_, i) => createEmptyPlot(i));
}

export function ensurePlotsArray(
  payload: FarmPlot[] | null | undefined,
  expectedCount: number,
): FarmPlot[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    return createEmptyPlots(expectedCount);
  }
  if (payload.length < expectedCount) {
    const extra = Array.from(
      { length: expectedCount - payload.length },
      (_, i) => createEmptyPlot(payload.length + i),
    );
    return [...payload, ...extra];
  }
  return payload;
}

export function refreshPlotStage(plot: FarmPlot, nowMs: number): FarmPlot {
  if (!plot.cropId || plot.plantedAt == null || plot.maturedAt == null) {
    return plot;
  }
  const def = FARM_CROP_CATALOG[plot.cropId];
  if (!def) return plot;
  const rottenAt = computeRottenAtMs(plot.cropId, plot.plantedAt);
  let stage = plot.stage;
  if (nowMs >= rottenAt) {
    stage = 'rotten';
  } else if (nowMs >= plot.maturedAt) {
    stage = 'ripe';
  } else {
    const fraction = (nowMs - plot.plantedAt) / (plot.maturedAt - plot.plantedAt);
    if (fraction < 0.25) stage = 'seed';
    else if (fraction < 0.5) stage = 'sprout';
    else stage = 'growing';
  }
  if (stage === plot.stage) return plot;
  return { ...plot, stage };
}

export function pruneStolenLog(
  log: FarmStolenLogEntry[],
): FarmStolenLogEntry[] {
  const cutoff = Date.now() - WEEKLY_STOLEN_LOG_KEEP_MS;
  const filtered = log.filter((entry) => entry.atMs >= cutoff);
  if (filtered.length === log.length) return log;
  return filtered;
}

function rollYield([lo, hi]: [number, number]): number {
  if (lo >= hi) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
