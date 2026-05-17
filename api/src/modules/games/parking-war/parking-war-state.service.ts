// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { WorldOwnerService } from '../../auth/world-owner.service';
import { ParkingWarPlayerStateEntity } from './entities/parking-war-player-state.entity';
import { ParkingWarOccupancyEntity } from './entities/parking-war-occupancy.entity';
import {
  PARKING_WAR_CAR_DEFAULT_DURABILITY,
  PARKING_WAR_DEFAULT_BALANCE_CENTS,
  PARKING_WAR_DEFAULT_GARAGE_SLOTS,
  PARKING_WAR_DEFAULT_LOT_MULTIPLIER_BP,
  PARKING_WAR_DEFAULT_LOT_SIZE,
  PARKING_WAR_DEFAULT_LOT_SURFACE,
} from './parking-war.constants';
import type {
  ParkingWarHomeSlot,
  ParkingWarOccupancyView,
  ParkingWarOwnedCar,
  ParkingWarPlayerStateView,
} from './parking-war.types';

@Injectable()
export class ParkingWarStateService implements OnModuleInit {
  private readonly logger = new Logger(ParkingWarStateService.name);

  constructor(
    @InjectRepository(ParkingWarPlayerStateEntity)
    private readonly playerRepo: Repository<ParkingWarPlayerStateEntity>,
    @InjectRepository(ParkingWarOccupancyEntity)
    private readonly occupancyRepo: Repository<ParkingWarOccupancyEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly worldOwnerService: WorldOwnerService,
  ) {}

  /**
   * 唯一复合索引在这里建（不要写 @Index({unique:true}) — synchronize 早于 onModuleInit，
   * 老库重复行会卡死服务启动；见 memory feedback_entity_unique_index_synchronize_trap.md）。
   *
   * - 一格车位同时只能有一辆车
   * - 一辆车不能同时停两个地方
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uniq_pw_occupancy_slot
         ON parking_war_occupancies (lotOwnerKind, lotOwnerId, slotIndex)`,
      );
      await this.dataSource.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uniq_pw_occupancy_car
         ON parking_war_occupancies (visitorKind, visitorId, carId)`,
      );
    } catch (error) {
      this.logger.warn(
        `parking-war unique index creation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async resolveOwnerId(): Promise<string> {
    const owner = await this.worldOwnerService.getOwnerOrThrow();
    return owner.id;
  }

  async getOrCreatePlayerState(
    ownerId: string,
  ): Promise<ParkingWarPlayerStateEntity> {
    let state = await this.playerRepo.findOneBy({ ownerId });
    if (state) return state;

    const starterCarId = randomUUID();
    const ownedCars: ParkingWarOwnedCar[] = [
      {
        carId: starterCarId,
        tier: 'starter',
        rarity: 'common',
        level: 1,
        paintIndex: 0,
        durability: PARKING_WAR_CAR_DEFAULT_DURABILITY,
        plate: null,
        parkedRef: null,
        unavailableUntilMs: null,
      },
    ];
    const homeSlots: ParkingWarHomeSlot[] = Array.from(
      { length: PARKING_WAR_DEFAULT_LOT_SIZE },
      (_, index) => ({ index, occupancyId: null }),
    );
    state = this.playerRepo.create({
      ownerId,
      balanceCents: PARKING_WAR_DEFAULT_BALANCE_CENTS,
      totalEarnedCents: 0,
      garageSlots: PARKING_WAR_DEFAULT_GARAGE_SLOTS,
      lotSize: PARKING_WAR_DEFAULT_LOT_SIZE,
      lotSurface: PARKING_WAR_DEFAULT_LOT_SURFACE,
      lotMultiplierBp: PARKING_WAR_DEFAULT_LOT_MULTIPLIER_BP,
      ownedCarsPayload: ownedCars,
      homeSlotsPayload: homeSlots,
      lastTickAt: null,
      lastDailyBonusKey: null,
      streakDays: 0,
      dailyTasksPayload: null,
      dailyShieldRemaining: 0,
    });
    return this.playerRepo.save(state);
  }

  async getPlayerStateView(
    ownerId: string,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    return this.toPlayerView(state);
  }

  private async toPlayerView(
    state: ParkingWarPlayerStateEntity,
  ): Promise<ParkingWarPlayerStateView> {
    const [homeOccupancies, awayOccupancies] = await Promise.all([
      this.occupancyRepo.find({
        where: { lotOwnerKind: 'player', lotOwnerId: state.ownerId },
      }),
      this.occupancyRepo.find({
        where: { visitorKind: 'player', visitorId: state.ownerId },
      }),
    ]);

    const todayKey = formatDateKey(new Date());
    const dailyBonusAvailable = state.lastDailyBonusKey !== todayKey;

    return {
      ownerId: state.ownerId,
      balanceCents: state.balanceCents,
      totalEarnedCents: state.totalEarnedCents,
      garageSlots: state.garageSlots,
      lotSize: state.lotSize,
      lotSurface: state.lotSurface,
      lotMultiplierBp: state.lotMultiplierBp,
      ownedCars: state.ownedCarsPayload ?? [],
      homeSlots:
        state.homeSlotsPayload ??
        Array.from({ length: state.lotSize }, (_, index) => ({
          index,
          occupancyId: null,
        })),
      homeOccupancies: homeOccupancies.map(toOccupancyView),
      awayOccupancies: awayOccupancies.map(toOccupancyView),
      streakDays: state.streakDays,
      lastDailyBonusKey: state.lastDailyBonusKey ?? null,
      dailyBonusAvailable,
      dailyShieldRemaining: state.dailyShieldRemaining,
      dailyTasks: state.dailyTasksPayload?.tasks ?? [],
      serverNowMs: Date.now(),
      updatedAt:
        state.updatedAt instanceof Date
          ? state.updatedAt.toISOString()
          : new Date(state.updatedAt).toISOString(),
    };
  }
}

function toOccupancyView(
  entity: ParkingWarOccupancyEntity,
): ParkingWarOccupancyView {
  return {
    occupancyId: entity.id,
    lotOwnerKind: entity.lotOwnerKind,
    lotOwnerId: entity.lotOwnerId,
    slotIndex: entity.slotIndex,
    visitorKind: entity.visitorKind,
    visitorId: entity.visitorId,
    carId: entity.carId,
    carTier: entity.carTier,
    carRarity: entity.carRarity,
    carLevel: entity.carLevel,
    carPaintIndex: entity.carPaintIndex,
    carPlate: entity.carPlate ?? null,
    parkedAtMs: Number(entity.parkedAtMs),
    pendingEarningsCents: entity.pendingEarningsCents,
    warningLevel: entity.warningLevel,
    warnedAtMs: entity.warnedAtMs != null ? Number(entity.warnedAtMs) : null,
    ticketedAtMs:
      entity.ticketedAtMs != null ? Number(entity.ticketedAtMs) : null,
    towableAtMs:
      entity.towableAtMs != null ? Number(entity.towableAtMs) : null,
  };
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// i18n-ignore-end
