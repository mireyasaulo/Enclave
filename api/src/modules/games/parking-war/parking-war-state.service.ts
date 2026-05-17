// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../../common/app-error.exception';
import { WorldOwnerService } from '../../auth/world-owner.service';
import { ParkingWarPlayerStateEntity } from './entities/parking-war-player-state.entity';
import { ParkingWarNpcStateEntity } from './entities/parking-war-npc-state.entity';
import { ParkingWarOccupancyEntity } from './entities/parking-war-occupancy.entity';
import { ParkingWarEventService } from './parking-war-event.service';
import { ParkingWarNeighborService } from './parking-war-neighbor.service';
import {
  computeCarBuyPriceCents,
  computeCarRatePerMinuteCents,
  computeCarUpgradeCostCents,
  PARKING_WAR_CAR_DEFAULT_DURABILITY,
  PARKING_WAR_CAR_MAX_LEVEL,
  PARKING_WAR_CAR_REPAIR_COST_PER_POINT_CENTS,
  PARKING_WAR_DAILY_PARK_LIMIT,
  PARKING_WAR_DEFAULT_BALANCE_CENTS,
  PARKING_WAR_DEFAULT_GARAGE_SLOTS,
  PARKING_WAR_DEFAULT_LOT_MULTIPLIER_BP,
  PARKING_WAR_DEFAULT_LOT_SIZE,
  PARKING_WAR_DEFAULT_LOT_SURFACE,
  PARKING_WAR_OFFLINE_CATCHUP_CAP_MS,
  PARKING_WAR_PLAYER_ACTOR_ID,
  PARKING_WAR_VISITOR_SHARE_BP,
} from './parking-war.constants';
import type {
  ParkingWarCarTier,
  ParkingWarCollectResult,
  ParkingWarHomeSlot,
  ParkingWarLotSurface,
  ParkingWarOccupancyView,
  ParkingWarOwnedCar,
  ParkingWarPlayerStateView,
  ParkingWarRarity,
  ParkingWarRecallResult,
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
    private readonly eventService: ParkingWarEventService,
    private readonly neighborService: ParkingWarNeighborService,
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

  // ============================================================
  // Init / Read
  // ============================================================

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
      lastTickAt: new Date(),
      lastDailyBonusKey: null,
      streakDays: 0,
      dailyTasksPayload: null,
      dailyShieldRemaining: 0,
    });
    state = await this.playerRepo.save(state);

    // 自动把起步车停进 slot 0，开始挂机产钱
    try {
      await this.parkOwnedCarAtHomeInternal(state, starterCarId, 0);
      // re-read after side-effects
      state = (await this.playerRepo.findOneBy({ ownerId })) ?? state;
    } catch (error) {
      this.logger.warn(
        `parking-war auto-park starter car failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return state;
  }

  async getPlayerStateView(
    ownerId: string,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);
    return this.toPlayerView(state);
  }

  // ============================================================
  // Tick / Collect
  // ============================================================

  /**
   * 推进所有与玩家相关的 occupancy 的 pendingEarnings：
   *  - home occupancies：visitor 是谁都按玩家自己 lot 的 surface/multiplier 计费
   *  - away occupancies：玩家车停在 NPC 家，按那家 NPC 的 surface/multiplier 计费
   *
   * 离线补算：lastTickAt 到 now 的时间窗口被夹到 OFFLINE_CATCHUP_CAP_MS。
   */
  async tickPlayerHomeOccupancies(
    state: ParkingWarPlayerStateEntity,
    nowMs: number = Date.now(),
  ): Promise<void> {
    const lastTickMs = state.lastTickAt?.getTime() ?? nowMs;
    const rawDelta = Math.max(0, nowMs - lastTickMs);
    const cappedDelta = Math.min(rawDelta, PARKING_WAR_OFFLINE_CATCHUP_CAP_MS);
    if (cappedDelta <= 0) {
      state.lastTickAt = new Date(nowMs);
      await this.playerRepo.save(state);
      return;
    }

    const [homeOccupancies, awayOccupancies] = await Promise.all([
      this.occupancyRepo.find({
        where: { lotOwnerKind: 'player', lotOwnerId: state.ownerId },
      }),
      this.occupancyRepo.find({
        where: { visitorKind: 'player', visitorId: state.ownerId },
      }),
    ]);

    const minutes = cappedDelta / 60_000;

    for (const occ of homeOccupancies) {
      const ratePerMinute = computeCarRatePerMinuteCents({
        tier: occ.carTier,
        rarity: occ.carRarity,
        level: occ.carLevel,
        surface: state.lotSurface,
        lotMultiplierBp: state.lotMultiplierBp,
      });
      const delta = Math.round(ratePerMinute * minutes);
      if (delta > 0) {
        occ.pendingEarningsCents += delta;
      }
    }

    // away：取每个 NPC 的 surface/multiplier
    const awayHostIds = Array.from(
      new Set(
        awayOccupancies
          .filter((o) => o.lotOwnerKind === 'npc')
          .map((o) => o.lotOwnerId),
      ),
    );
    let hostMap = new Map<
      string,
      { surface: ParkingWarLotSurface; lotMultiplierBp: number }
    >();
    if (awayHostIds.length > 0) {
      const npcStates = await Promise.all(
        awayHostIds.map((id) => this.neighborService.getNpcState(id)),
      );
      hostMap = new Map(
        npcStates
          .filter((n): n is ParkingWarNpcStateEntity => n != null)
          .map((n) => [
            n.characterId,
            { surface: n.lotSurface, lotMultiplierBp: n.lotMultiplierBp },
          ]),
      );
    }
    for (const occ of awayOccupancies) {
      const host = hostMap.get(occ.lotOwnerId);
      if (!host) continue;
      const ratePerMinute = computeCarRatePerMinuteCents({
        tier: occ.carTier,
        rarity: occ.carRarity,
        level: occ.carLevel,
        surface: host.surface,
        lotMultiplierBp: host.lotMultiplierBp,
      });
      const delta = Math.round(ratePerMinute * minutes);
      if (delta > 0) {
        occ.pendingEarningsCents += delta;
      }
    }

    if (homeOccupancies.length + awayOccupancies.length > 0) {
      await this.occupancyRepo.save([
        ...homeOccupancies,
        ...awayOccupancies,
      ]);
    }
    state.lastTickAt = new Date(nowMs);
    await this.playerRepo.save(state);
  }

  async collectFromSlot(
    ownerId: string,
    slotIndex?: number,
  ): Promise<ParkingWarCollectResult> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);

    const where =
      slotIndex == null
        ? { lotOwnerKind: 'player' as const, lotOwnerId: ownerId }
        : {
            lotOwnerKind: 'player' as const,
            lotOwnerId: ownerId,
            slotIndex,
          };
    const occupancies = await this.occupancyRepo.find({ where });
    if (occupancies.length === 0) {
      throw new AppError('PARKING_WAR_NOTHING_TO_COLLECT', {
        legacyMessage: '车位上没有可收的车',
      });
    }

    let gained = 0;
    for (const occ of occupancies) {
      // 自己停自己家：100% 入自己钱包；
      // Stage 3 起 NPC 访客停玩家家时，玩家不直接收，而是等被贴条/拖车才能从访客身上抽
      if (occ.visitorKind === 'player' && occ.visitorId === ownerId) {
        gained += occ.pendingEarningsCents;
        occ.pendingEarningsCents = 0;
      }
    }
    if (gained === 0) {
      throw new AppError('PARKING_WAR_NOTHING_TO_COLLECT', {
        legacyMessage: '车位上没有可收的车',
      });
    }
    await this.occupancyRepo.save(occupancies);

    state.balanceCents += gained;
    state.totalEarnedCents += gained;
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'collect',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      amountCents: gained,
      payload: { slotIndex: slotIndex ?? null },
    });

    return { view: await this.toPlayerView(state), gainedCents: gained };
  }

  // ============================================================
  // Park / Recall (home only — Stage 3 adds neighbor variant)
  // ============================================================

  async parkOwnedCarAtHome(
    ownerId: string,
    carId: string,
    slotIndex: number,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);
    await this.parkOwnedCarAtHomeInternal(state, carId, slotIndex);
    const refreshed =
      (await this.playerRepo.findOneBy({ ownerId })) ?? state;
    return this.toPlayerView(refreshed);
  }

  /**
   * 把玩家的某辆车停进 NPC 邻居的指定车位。每日上限 8 次（按事件日志计）。
   */
  async parkOwnedCarAtNeighbor(
    ownerId: string,
    carId: string,
    characterId: string,
    slotIndex: number,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);

    await this.assertDailyParkBudgetAvailable(ownerId);

    const cars = [...(state.ownedCarsPayload ?? [])];
    const carIdx = cars.findIndex((c) => c.carId === carId);
    if (carIdx < 0) {
      throw new AppError('PARKING_WAR_CAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '找不到这辆车',
      });
    }
    const car = cars[carIdx];
    if (car.parkedRef) {
      throw new AppError('PARKING_WAR_CAR_ALREADY_PARKED', {
        legacyMessage: '该车已停在外面，无法再停',
      });
    }
    const nowMs = Date.now();
    if (car.unavailableUntilMs && car.unavailableUntilMs > nowMs) {
      throw new AppError('PARKING_WAR_CAR_COOLDOWN', {
        legacyMessage: '该车被拖走后正在冷却',
      });
    }

    const saved = await this.neighborService.createOccupancyForNeighborPark({
      ownerId,
      characterId,
      slotIndex,
      car,
      nowMs,
    });

    cars[carIdx] = {
      ...car,
      parkedRef: {
        occupancyId: saved.id,
        lotOwnerKind: 'npc',
        lotOwnerId: characterId,
        slotIndex,
        parkedAtMs: nowMs,
      },
    };
    state.ownedCarsPayload = cars;
    await this.playerRepo.save(state);

    return this.toPlayerView(state);
  }

  private async assertDailyParkBudgetAvailable(ownerId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await this.eventService.listEvents(ownerId, {
      since: startOfDay,
      limit: 200,
    });
    const todayPark = rows.filter(
      (r) =>
        r.kind === 'park' &&
        (r.payloadJson as { atHome?: boolean } | null)?.atHome === false,
    );
    if (todayPark.length >= PARKING_WAR_DAILY_PARK_LIMIT) {
      throw new AppError('PARKING_WAR_DAILY_PARK_LIMIT_REACHED', {
        legacyMessage: `今日停别人家次数已用完（${PARKING_WAR_DAILY_PARK_LIMIT}/日）`,
      });
    }
  }

  private async parkOwnedCarAtHomeInternal(
    state: ParkingWarPlayerStateEntity,
    carId: string,
    slotIndex: number,
  ): Promise<void> {
    const cars = [...(state.ownedCarsPayload ?? [])];
    const carIdx = cars.findIndex((c) => c.carId === carId);
    if (carIdx < 0) {
      throw new AppError('PARKING_WAR_CAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '找不到这辆车',
      });
    }
    const car = cars[carIdx];
    if (car.parkedRef) {
      throw new AppError('PARKING_WAR_CAR_ALREADY_PARKED', {
        legacyMessage: '该车已停在外面，无法再停',
      });
    }
    const nowMs = Date.now();
    if (car.unavailableUntilMs && car.unavailableUntilMs > nowMs) {
      throw new AppError('PARKING_WAR_CAR_COOLDOWN', {
        legacyMessage: '该车被拖走后正在冷却',
      });
    }
    const homeSlots = [
      ...(state.homeSlotsPayload ??
        Array.from({ length: state.lotSize }, (_, i) => ({
          index: i,
          occupancyId: null,
        }))),
    ];
    if (slotIndex < 0 || slotIndex >= homeSlots.length) {
      throw new AppError('PARKING_WAR_SLOT_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '车位不存在',
      });
    }
    if (homeSlots[slotIndex].occupancyId) {
      throw new AppError('PARKING_WAR_SLOT_OCCUPIED', {
        legacyMessage: '车位已被占',
      });
    }

    const occupancy = this.occupancyRepo.create({
      lotOwnerKind: 'player',
      lotOwnerId: state.ownerId,
      slotIndex,
      visitorKind: 'player',
      visitorId: state.ownerId,
      carId,
      carTier: car.tier,
      carRarity: car.rarity,
      carLevel: car.level,
      carPaintIndex: car.paintIndex,
      carPlate: car.plate ?? null,
      parkedAtMs: nowMs,
      pendingEarningsCents: 0,
      warningLevel: 0,
    });
    const saved = await this.occupancyRepo.save(occupancy);

    homeSlots[slotIndex] = { index: slotIndex, occupancyId: saved.id };
    cars[carIdx] = {
      ...car,
      parkedRef: {
        occupancyId: saved.id,
        lotOwnerKind: 'player',
        lotOwnerId: state.ownerId,
        slotIndex,
        parkedAtMs: nowMs,
      },
    };
    state.homeSlotsPayload = homeSlots;
    state.ownedCarsPayload = cars;
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId: state.ownerId,
      kind: 'park',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      targetKind: 'player',
      targetId: state.ownerId,
      targetName: '自家车场',
      payload: { carId, slotIndex, atHome: true },
    });
  }

  /**
   * 召回 occupancy。
   * - 自停自家：pending 100% 入玩家钱包
   * - 停在 NPC 邻居家：pending 按 VISITOR_SHARE_BP(70%) 给玩家、剩余给 NPC
   */
  async recallOccupancy(
    ownerId: string,
    occupancyId: string,
  ): Promise<ParkingWarRecallResult> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);

    const occ = await this.occupancyRepo.findOneBy({ id: occupancyId });
    if (!occ) {
      throw new AppError('PARKING_WAR_OCCUPANCY_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '车辆已不在车位上',
      });
    }
    if (!(occ.visitorKind === 'player' && occ.visitorId === ownerId)) {
      throw new AppError('PARKING_WAR_NOT_YOUR_CAR', {
        status: HttpStatus.FORBIDDEN,
        legacyMessage: '只能召回自己的车',
      });
    }

    const totalPending = occ.pendingEarningsCents;
    const isHome =
      occ.lotOwnerKind === 'player' && occ.lotOwnerId === ownerId;
    const playerShare = isHome
      ? totalPending
      : Math.floor((totalPending * PARKING_WAR_VISITOR_SHARE_BP) / 10_000);
    const hostShare = totalPending - playerShare;

    state.balanceCents += playerShare;
    state.totalEarnedCents += playerShare;

    // 把车从 OwnedCar 上解绑
    const cars = (state.ownedCarsPayload ?? []).map((c) =>
      c.carId === occ.carId ? { ...c, parkedRef: null } : c,
    );
    state.ownedCarsPayload = cars;

    // 清空场主一侧的 home 槽位 + 给 NPC 那 30%
    if (isHome) {
      const homeSlots = (state.homeSlotsPayload ?? []).map((s) =>
        s.index === occ.slotIndex ? { ...s, occupancyId: null } : s,
      );
      state.homeSlotsPayload = homeSlots;
      await this.occupancyRepo.delete({ id: occupancyId });
    } else if (occ.lotOwnerKind === 'npc') {
      await this.neighborService.releaseOccupancyOnNeighbor(occ);
      if (hostShare > 0) {
        await this.neighborService.creditNpcBalance(occ.lotOwnerId, hostShare);
      }
    }
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'recall',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      targetKind: occ.lotOwnerKind,
      targetId: occ.lotOwnerId,
      targetName: isHome ? '自家车场' : null,
      amountCents: playerShare,
      payload: {
        carId: occ.carId,
        slotIndex: occ.slotIndex,
        atHome: isHome,
        hostShareCents: hostShare,
      },
    });

    return {
      view: await this.toPlayerView(state),
      gainedCents: playerShare,
      splitToHostCents: hostShare,
    };
  }

  // ============================================================
  // Garage: buy / upgrade / paint / repair
  // ============================================================

  async buyCar(
    ownerId: string,
    tier: ParkingWarCarTier,
    rarity: ParkingWarRarity,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);

    const cars = [...(state.ownedCarsPayload ?? [])];
    if (cars.length >= state.garageSlots) {
      throw new AppError('PARKING_WAR_GARAGE_FULL', {
        legacyMessage: '车库已满，先升级车库或卖车',
      });
    }
    const price = computeCarBuyPriceCents(tier, rarity);
    if (state.balanceCents < price) {
      throw new AppError('PARKING_WAR_INSUFFICIENT_BALANCE', {
        params: { required: price, balance: state.balanceCents },
        legacyMessage: '余额不足',
      });
    }

    const newCar: ParkingWarOwnedCar = {
      carId: randomUUID(),
      tier,
      rarity,
      level: 1,
      paintIndex: 0,
      durability: PARKING_WAR_CAR_DEFAULT_DURABILITY,
      plate: null,
      parkedRef: null,
      unavailableUntilMs: null,
    };
    cars.push(newCar);
    state.ownedCarsPayload = cars;
    state.balanceCents -= price;
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'buy_car',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      amountCents: -price,
      payload: { tier, rarity, carId: newCar.carId },
    });
    return this.toPlayerView(state);
  }

  async upgradeCar(
    ownerId: string,
    carId: string,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    await this.tickPlayerHomeOccupancies(state);

    const cars = [...(state.ownedCarsPayload ?? [])];
    const idx = cars.findIndex((c) => c.carId === carId);
    if (idx < 0) {
      throw new AppError('PARKING_WAR_CAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '找不到这辆车',
      });
    }
    const car = cars[idx];
    if (car.level >= PARKING_WAR_CAR_MAX_LEVEL) {
      throw new AppError('PARKING_WAR_CAR_MAX_LEVEL', {
        legacyMessage: '该车已满级',
      });
    }
    const cost = computeCarUpgradeCostCents(car.level);
    if (state.balanceCents < cost) {
      throw new AppError('PARKING_WAR_INSUFFICIENT_BALANCE', {
        params: { required: cost, balance: state.balanceCents },
        legacyMessage: '余额不足',
      });
    }
    cars[idx] = { ...car, level: car.level + 1 };
    state.ownedCarsPayload = cars;
    state.balanceCents -= cost;

    // 升级后同步在场 occupancy 的 carLevel（确保收益马上生效）
    if (car.parkedRef) {
      await this.occupancyRepo.update(
        { id: car.parkedRef.occupancyId },
        { carLevel: car.level + 1 },
      );
    }
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'upgrade_car',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      amountCents: -cost,
      payload: { carId, newLevel: car.level + 1 },
    });
    return this.toPlayerView(state);
  }

  async paintCar(
    ownerId: string,
    carId: string,
    paintIndex: number,
  ): Promise<ParkingWarPlayerStateView> {
    if (!Number.isInteger(paintIndex) || paintIndex < 0 || paintIndex > 2) {
      throw new AppError('PARKING_WAR_INVALID_PAINT_INDEX', {
        legacyMessage: 'paintIndex 仅支持 0/1/2',
      });
    }
    const state = await this.getOrCreatePlayerState(ownerId);
    const cars = [...(state.ownedCarsPayload ?? [])];
    const idx = cars.findIndex((c) => c.carId === carId);
    if (idx < 0) {
      throw new AppError('PARKING_WAR_CAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '找不到这辆车',
      });
    }
    cars[idx] = { ...cars[idx], paintIndex };
    state.ownedCarsPayload = cars;

    const parkedRef = cars[idx].parkedRef;
    if (parkedRef) {
      await this.occupancyRepo.update(
        { id: parkedRef.occupancyId },
        { carPaintIndex: paintIndex },
      );
    }
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'paint_car',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      payload: { carId, paintIndex },
    });
    return this.toPlayerView(state);
  }

  async repairCar(
    ownerId: string,
    carId: string,
  ): Promise<ParkingWarPlayerStateView> {
    const state = await this.getOrCreatePlayerState(ownerId);
    const cars = [...(state.ownedCarsPayload ?? [])];
    const idx = cars.findIndex((c) => c.carId === carId);
    if (idx < 0) {
      throw new AppError('PARKING_WAR_CAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '找不到这辆车',
      });
    }
    const car = cars[idx];
    const missing = PARKING_WAR_CAR_DEFAULT_DURABILITY - car.durability;
    if (missing <= 0) {
      throw new AppError('PARKING_WAR_CAR_FULLY_REPAIRED', {
        legacyMessage: '该车耐久已满',
      });
    }
    const cost = missing * PARKING_WAR_CAR_REPAIR_COST_PER_POINT_CENTS;
    if (state.balanceCents < cost) {
      throw new AppError('PARKING_WAR_INSUFFICIENT_BALANCE', {
        params: { required: cost, balance: state.balanceCents },
        legacyMessage: '余额不足',
      });
    }
    cars[idx] = { ...car, durability: PARKING_WAR_CAR_DEFAULT_DURABILITY };
    state.ownedCarsPayload = cars;
    state.balanceCents -= cost;
    await this.playerRepo.save(state);

    await this.eventService.recordEvent({
      ownerId,
      kind: 'repair_car',
      actorKind: 'player',
      actorId: PARKING_WAR_PLAYER_ACTOR_ID,
      actorName: '世界主人',
      amountCents: -cost,
      payload: { carId, restoredPoints: missing },
    });
    return this.toPlayerView(state);
  }

  // ============================================================
  // View
  // ============================================================

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
