import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppError } from '../../../common/app-error.exception';
import { FarmEventService } from './farm-event.service';
import { FarmNpcService } from './farm-npc.service';
import { FarmStateService } from './farm-state.service';
import { isFarmCropId } from './crop-catalog';
import {
  FarmCropId,
  FarmEventView,
  FarmHarvestResult,
  FarmNeighborDetail,
  FarmNeighborSummary,
  FarmPlayerStateView,
  FarmStealResult,
} from './farm.types';

interface PlantBody {
  plotIndex: number;
  cropId: FarmCropId;
}

interface PlotActionBody {
  plotIndex: number;
  characterId?: string;
}

interface SeedTransactionBody {
  cropId: FarmCropId;
  quantity: number;
}

@Controller('games/farm')
export class FarmController {
  constructor(
    private readonly stateService: FarmStateService,
    private readonly eventService: FarmEventService,
    private readonly npcService: FarmNpcService,
  ) {}

  @Get('state')
  async getState(): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    return this.stateService.getPlayerStateView(ownerId);
  }

  @Get('neighbors')
  async listNeighbors(
    @Query('limit') limit?: string,
  ): Promise<FarmNeighborSummary[]> {
    const ownerId = await this.stateService.resolveOwnerId();
    const limitN = limit ? Math.max(1, Math.min(200, Number(limit))) : undefined;
    return this.npcService.listNeighbors(ownerId, { limit: limitN });
  }

  @Get('neighbors/:characterId')
  async getNeighbor(
    @Param('characterId') characterId: string,
  ): Promise<FarmNeighborDetail> {
    const ownerId = await this.stateService.resolveOwnerId();
    return this.npcService.getNeighborDetail(ownerId, characterId);
  }

  @Post('plant')
  async plant(@Body() body: PlantBody): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const plotIndex = parsePlotIndex(body.plotIndex);
    const cropId = parseCropId(body.cropId);
    return this.stateService.plant(ownerId, plotIndex, cropId);
  }

  @Post('water')
  async water(@Body() body: PlotActionBody): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const plotIndex = parsePlotIndex(body.plotIndex);
    return this.stateService.waterPlot(ownerId, {
      kind: body.characterId ? 'npc' : 'self',
      plotIndex,
      characterId: body.characterId,
    });
  }

  @Post('weed')
  async weed(@Body() body: PlotActionBody): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const plotIndex = parsePlotIndex(body.plotIndex);
    return this.stateService.weedPlot(ownerId, {
      kind: body.characterId ? 'npc' : 'self',
      plotIndex,
      characterId: body.characterId,
    });
  }

  @Post('debug')
  async debugBugs(@Body() body: PlotActionBody): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const plotIndex = parsePlotIndex(body.plotIndex);
    return this.stateService.debugPlot(ownerId, {
      kind: body.characterId ? 'npc' : 'self',
      plotIndex,
      characterId: body.characterId,
    });
  }

  @Post('harvest')
  async harvest(@Body() body: { plotIndex: number }): Promise<FarmHarvestResult> {
    const ownerId = await this.stateService.resolveOwnerId();
    const plotIndex = parsePlotIndex(body.plotIndex);
    return this.stateService.harvest(ownerId, plotIndex);
  }

  @Post('steal')
  async steal(
    @Body() body: { characterId: string; plotIndex: number },
  ): Promise<FarmStealResult> {
    const ownerId = await this.stateService.resolveOwnerId();
    const plotIndex = parsePlotIndex(body.plotIndex);
    if (typeof body.characterId !== 'string' || body.characterId.length === 0) {
      throw new AppError('FARM_CHARACTER_REQUIRED', {
        legacyMessage: 'characterId 必填',
      });
    }
    return this.stateService.stealFromNpc(ownerId, body.characterId, plotIndex);
  }

  @Post('buy-seed')
  async buySeed(@Body() body: SeedTransactionBody): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const cropId = parseCropId(body.cropId);
    return this.stateService.buySeed(ownerId, cropId, Math.floor(body.quantity));
  }

  @Post('sell-crop')
  async sellCrop(@Body() body: SeedTransactionBody): Promise<FarmPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const cropId = parseCropId(body.cropId);
    return this.stateService.sellCrop(ownerId, cropId, Math.floor(body.quantity));
  }

  @Get('events')
  async listEvents(
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ): Promise<FarmEventView[]> {
    const ownerId = await this.stateService.resolveOwnerId();
    const sinceDate = since ? new Date(since) : undefined;
    const limitN = limit ? Math.max(1, Math.min(200, Number(limit))) : 50;
    const rows = await this.eventService.listEvents(ownerId, {
      since: sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : undefined,
      limit: limitN,
    });
    return rows.map((row) => this.eventService.toEventView(row));
  }
}

function parsePlotIndex(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new AppError('FARM_INVALID_PLOT_INDEX', {
      legacyMessage: 'plotIndex 必须为非负整数',
    });
  }
  return n;
}

function parseCropId(raw: unknown): FarmCropId {
  if (typeof raw !== 'string' || !isFarmCropId(raw)) {
    throw new AppError('FARM_UNKNOWN_CROP', {
      params: { cropId: String(raw) },
      legacyMessage: `未知作物：${String(raw)}`,
    });
  }
  return raw;
}
