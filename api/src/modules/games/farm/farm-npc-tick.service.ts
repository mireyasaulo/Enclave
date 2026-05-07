import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterEntity } from '../../characters/character.entity';
import { WorldOwnerService } from '../../auth/world-owner.service';
import { FarmEventService } from './farm-event.service';
import { FarmNpcService } from './farm-npc.service';
import {
  ensurePlotsArray,
  refreshPlotStage,
} from './farm-state.service';
import { FarmNpcStateEntity } from './entities/farm-npc-state.entity';
import {
  FARM_CROP_CATALOG,
  FARM_CROP_IDS,
  computeMaturedAtMs,
  computeRottenAtMs,
  getCropDefinition,
} from './crop-catalog';
import {
  FARM_NPC_TICK_CRON,
  FarmCropId,
  FarmPlot,
  FarmTickSummary,
} from './farm.types';

@Injectable()
export class FarmNpcTickService {
  private readonly logger = new Logger(FarmNpcTickService.name);
  private running = false;

  constructor(
    @InjectRepository(FarmNpcStateEntity)
    private readonly npcRepo: Repository<FarmNpcStateEntity>,
    private readonly worldOwnerService: WorldOwnerService,
    private readonly npcService: FarmNpcService,
    private readonly eventService: FarmEventService,
  ) {}

  @Cron(FARM_NPC_TICK_CRON)
  async runScheduledTick(): Promise<void> {
    if (this.running) {
      this.logger.warn('上一次 farm tick 仍在执行，跳过本轮');
      return;
    }
    this.running = true;
    try {
      const summary = await this.runTick();
      this.logger.log(
        `farm tick: 扫描 ${summary.scannedCharacterCount} 个角色，触发 ${summary.actedCount} 次动作（种植 ${summary.plantCount} / 收获 ${summary.harvestCount}），用时 ${summary.durationMs}ms`,
      );
    } catch (error) {
      this.logger.error(
        'farm tick 执行失败',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  async runTick(): Promise<FarmTickSummary> {
    const startedAt = Date.now();
    const owner = await this.worldOwnerService.getOwnerOrThrow();
    const characters = await this.npcService.listEligibleCharacters(owner.id);
    await this.npcService.ensureNpcStateForCharacters(characters, owner.id);

    let actedCount = 0;
    let plantCount = 0;
    let harvestCount = 0;
    const stealCount = 0;
    const incidentBroadcastCount = 0;

    for (const character of characters) {
      const npc = await this.npcRepo.findOneBy({ characterId: character.id });
      if (!npc) continue;
      const onlineLikelihood = computeOnlineLikelihood(character);
      if (Math.random() > onlineLikelihood) continue;

      let mutated = false;

      const harvested = this.harvestRipePlots(npc, character.id);
      if (harvested > 0) {
        harvestCount += harvested;
        mutated = true;
        await this.eventService.recordEvent({
          ownerId: owner.id,
          kind: 'harvest',
          actorType: 'character',
          actorId: character.id,
          actorName: character.name,
          payload: { count: harvested },
        });
      }

      const planted = this.maybePlantNewCrop(npc, character);
      if (planted) {
        plantCount += 1;
        mutated = true;
        await this.eventService.recordEvent({
          ownerId: owner.id,
          kind: 'plant',
          actorType: 'character',
          actorId: character.id,
          actorName: character.name,
          cropId: planted,
          payload: { plotIndex: findFirstPlotForCrop(npc, planted) },
        });
      }

      const maintained = this.maybeMaintainPlots(npc);
      if (maintained > 0) {
        mutated = true;
      }

      if (mutated) {
        actedCount += 1;
        npc.lastActedAt = new Date();
      }
      npc.lastTickAt = new Date();
      await this.npcRepo.save(npc);
    }

    await this.eventService.pruneOldEvents(owner.id, 30);

    return {
      scannedCharacterCount: characters.length,
      actedCount,
      plantCount,
      harvestCount,
      stealCount,
      incidentBroadcastCount,
      durationMs: Date.now() - startedAt,
    };
  }

  private harvestRipePlots(
    npc: FarmNpcStateEntity,
    characterId: string,
  ): number {
    const now = Date.now();
    const plots = ensurePlotsArray(npc.plotsPayload, npc.plotCount).map((p) =>
      refreshPlotStage(p, now),
    );
    const warehouse = { ...(npc.warehousePayload ?? {}) };
    let harvested = 0;
    for (let i = 0; i < plots.length; i += 1) {
      const plot = plots[i]!;
      if (
        !plot.cropId ||
        plot.maturedAt == null ||
        now < plot.maturedAt
      ) {
        continue;
      }
      const def = getCropDefinition(plot.cropId);
      const isRotten = now >= computeRottenAtMs(plot.cropId, plot.plantedAt!);
      const baseAmount = plot.yieldOverride ?? rollYield(def.yieldRange);
      const stolenAmount = (plot.stolenBy ?? []).filter((id) => id !== characterId).length;
      const remainingAmount = Math.max(1, baseAmount - stolenAmount);
      const amount = isRotten ? Math.max(1, Math.floor(remainingAmount / 2)) : remainingAmount;
      const coinsGained = amount * def.sellPrice;
      warehouse[plot.cropId] = (warehouse[plot.cropId] ?? 0) + amount;
      npc.coins += coinsGained;
      plots[i] = createEmptyNpcPlot(i);
      harvested += 1;
    }
    npc.plotsPayload = plots;
    npc.warehousePayload = warehouse;
    return harvested;
  }

  private maybePlantNewCrop(
    npc: FarmNpcStateEntity,
    character: CharacterEntity,
  ): FarmCropId | null {
    const plots = ensurePlotsArray(npc.plotsPayload, npc.plotCount);
    const emptyIndex = plots.findIndex((p) => !p.cropId);
    if (emptyIndex === -1) return null;

    const candidate = pickCropForCharacter(npc, character);
    if (!candidate) return null;
    const def = getCropDefinition(candidate);
    if (npc.coins < def.seedCost) return null;
    npc.coins -= def.seedCost;

    const now = Date.now();
    const newPlots = plots.map((p) => ({ ...p }));
    newPlots[emptyIndex] = {
      index: emptyIndex,
      cropId: candidate,
      plantedAt: now,
      maturedAt: computeMaturedAtMs(candidate, now),
      stage: 'seed',
      watered: false,
      weeds: 0,
      bugs: 0,
      stolenBy: [],
      plantedBy: character.id,
    };
    npc.plotsPayload = newPlots;
    return candidate;
  }

  private maybeMaintainPlots(npc: FarmNpcStateEntity): number {
    const diligence = (npc.moodPayload?.diligence ?? 50) / 100;
    const plots = ensurePlotsArray(npc.plotsPayload, npc.plotCount).map((p) => ({ ...p }));
    let mutated = 0;
    for (let i = 0; i < plots.length; i += 1) {
      const plot = plots[i]!;
      if (!plot.cropId) continue;
      if (plot.weeds > 0 && Math.random() < diligence) {
        plot.weeds = 0;
        mutated += 1;
      }
      if (plot.bugs > 0 && Math.random() < diligence) {
        plot.bugs = 0;
        mutated += 1;
      }
      if (!plot.watered && Math.random() < diligence * 0.4) {
        plot.watered = true;
        mutated += 1;
      }
      // 偶发自然增加杂草/虫
      if (Math.random() < 0.05) plot.weeds = Math.min(3, plot.weeds + 1);
      if (Math.random() < 0.03) plot.bugs = Math.min(3, plot.bugs + 1);
    }
    npc.plotsPayload = plots;
    return mutated;
  }
}

export function computeOnlineLikelihood(character: CharacterEntity): number {
  const freq = character.feedFrequency ?? 1;
  let base = 0.1;
  if (freq >= 5) base = 0.6;
  else if (freq >= 2) base = 0.3;

  if (!character.isOnline) base *= 0.4;

  const hour = new Date().getHours();
  if (hour >= 1 && hour < 6) base *= 0.2;

  return Math.max(0.02, Math.min(0.9, base));
}

function pickCropForCharacter(
  npc: FarmNpcStateEntity,
  character: CharacterEntity,
): FarmCropId | null {
  const expert = new Set((character.expertDomains ?? []).map((d) => String(d).toLowerCase()));
  const affordable = FARM_CROP_IDS.filter((id) => {
    const def = FARM_CROP_CATALOG[id];
    return def.unlockLevel <= npc.level && npc.coins >= def.seedCost;
  });
  if (affordable.length === 0) return null;
  const preferred = affordable.filter((id) =>
    FARM_CROP_CATALOG[id].preferredDomains.some((d) => expert.has(d)),
  );
  const pool = preferred.length > 0 ? preferred : affordable;
  pool.sort(
    (a, b) => FARM_CROP_CATALOG[b].sellPrice - FARM_CROP_CATALOG[a].sellPrice,
  );
  const topN = pool.slice(0, Math.max(1, Math.min(3, pool.length)));
  return topN[Math.floor(Math.random() * topN.length)]!;
}

function findFirstPlotForCrop(
  npc: FarmNpcStateEntity,
  cropId: FarmCropId,
): number {
  const plots = ensurePlotsArray(npc.plotsPayload, npc.plotCount);
  return plots.findIndex((p) => p.cropId === cropId);
}

function createEmptyNpcPlot(index: number): FarmPlot {
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

function rollYield([lo, hi]: [number, number]): number {
  if (lo >= hi) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
