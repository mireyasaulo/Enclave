// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppError } from '../../../common/app-error.exception';
import { ParkingWarEventService } from './parking-war-event.service';
import { ParkingWarStateService } from './parking-war-state.service';
import type {
  ParkingWarCarTier,
  ParkingWarCollectResult,
  ParkingWarEventView,
  ParkingWarPlayerStateView,
  ParkingWarRarity,
} from './parking-war.types';

const CAR_TIERS = new Set<ParkingWarCarTier>([
  'starter',
  'family',
  'business',
  'performance',
  'luxury',
  'super',
]);
const RARITIES = new Set<ParkingWarRarity>([
  'common',
  'rare',
  'epic',
  'legend',
]);

interface ParkBody {
  carId: string;
  slotIndex: number;
  // characterId 在 Stage 3 启用，传值表示停到 NPC/角色车场；Stage 2 仅支持停自己家
  characterId?: string;
}

@Controller('games/parking-war')
export class ParkingWarController {
  constructor(
    private readonly stateService: ParkingWarStateService,
    private readonly eventService: ParkingWarEventService,
  ) {}

  @Get('state')
  async getState(): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    return this.stateService.getPlayerStateView(ownerId);
  }

  @Get('events')
  async listEvents(
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ): Promise<ParkingWarEventView[]> {
    const ownerId = await this.stateService.resolveOwnerId();
    const sinceDate = since ? new Date(since) : undefined;
    const limitN = limit ? Math.max(1, Math.min(200, Number(limit))) : 50;
    const rows = await this.eventService.listEvents(ownerId, {
      since:
        sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : undefined,
      limit: limitN,
    });
    return rows.map((row) => this.eventService.toEventView(row));
  }

  @Post('park')
  async park(@Body() body: ParkBody): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const carId = parseNonEmptyString(body.carId, 'carId');
    const slotIndex = parseSlotIndex(body.slotIndex);
    if (body.characterId) {
      throw new AppError('PARKING_WAR_FEATURE_NOT_READY', {
        legacyMessage: '邻居车场互访将在下一阶段开放',
      });
    }
    return this.stateService.parkOwnedCarAtHome(ownerId, carId, slotIndex);
  }

  @Post('recall')
  async recall(
    @Body() body: { occupancyId: string },
  ): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const occupancyId = parseNonEmptyString(body.occupancyId, 'occupancyId');
    return this.stateService.recallOccupancy(ownerId, occupancyId);
  }

  @Post('collect')
  async collect(
    @Body() body: { slotIndex?: number },
  ): Promise<ParkingWarCollectResult> {
    const ownerId = await this.stateService.resolveOwnerId();
    const slotIndex =
      body.slotIndex != null ? parseSlotIndex(body.slotIndex) : undefined;
    return this.stateService.collectFromSlot(ownerId, slotIndex);
  }

  @Post('buy-car')
  async buyCar(
    @Body() body: { tier: ParkingWarCarTier; rarity: ParkingWarRarity },
  ): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const tier = parseCarTier(body.tier);
    const rarity = parseRarity(body.rarity);
    return this.stateService.buyCar(ownerId, tier, rarity);
  }

  @Post('upgrade-car')
  async upgradeCar(
    @Body() body: { carId: string },
  ): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const carId = parseNonEmptyString(body.carId, 'carId');
    return this.stateService.upgradeCar(ownerId, carId);
  }

  @Post('paint-car')
  async paintCar(
    @Body() body: { carId: string; paintIndex: number },
  ): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const carId = parseNonEmptyString(body.carId, 'carId');
    if (!Number.isInteger(body.paintIndex)) {
      throw new AppError('PARKING_WAR_INVALID_PAINT_INDEX', {
        legacyMessage: 'paintIndex 必须为整数',
      });
    }
    return this.stateService.paintCar(ownerId, carId, body.paintIndex);
  }

  @Post('repair-car')
  async repairCar(
    @Body() body: { carId: string },
  ): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    const carId = parseNonEmptyString(body.carId, 'carId');
    return this.stateService.repairCar(ownerId, carId);
  }
}

function parseSlotIndex(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new AppError('PARKING_WAR_INVALID_SLOT_INDEX', {
      legacyMessage: 'slotIndex 必须为非负整数',
    });
  }
  return n;
}

function parseNonEmptyString(raw: unknown, field: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new AppError('PARKING_WAR_FIELD_REQUIRED', {
      params: { field },
      legacyMessage: `${field} 必填`,
    });
  }
  return raw.trim();
}

function parseCarTier(raw: unknown): ParkingWarCarTier {
  if (typeof raw !== 'string' || !CAR_TIERS.has(raw as ParkingWarCarTier)) {
    throw new AppError('PARKING_WAR_UNKNOWN_TIER', {
      params: { tier: String(raw) },
      legacyMessage: `未知车辆档位：${String(raw)}`,
    });
  }
  return raw as ParkingWarCarTier;
}

function parseRarity(raw: unknown): ParkingWarRarity {
  if (typeof raw !== 'string' || !RARITIES.has(raw as ParkingWarRarity)) {
    throw new AppError('PARKING_WAR_UNKNOWN_RARITY', {
      params: { rarity: String(raw) },
      legacyMessage: `未知稀有度：${String(raw)}`,
    });
  }
  return raw as ParkingWarRarity;
}
// i18n-ignore-end
