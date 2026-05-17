// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ParkingWarEventLogEntity } from './entities/parking-war-event-log.entity';
import type {
  ParkingWarActorKind,
  ParkingWarEventKind,
  ParkingWarEventView,
} from './parking-war.types';

export interface RecordParkingWarEventInput {
  ownerId: string;
  kind: ParkingWarEventKind;
  actorKind: ParkingWarActorKind;
  actorId: string;
  actorName: string;
  targetKind?: ParkingWarActorKind | null;
  targetId?: string | null;
  targetName?: string | null;
  amountCents?: number | null;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class ParkingWarEventService {
  private readonly logger = new Logger(ParkingWarEventService.name);

  constructor(
    @InjectRepository(ParkingWarEventLogEntity)
    private readonly repo: Repository<ParkingWarEventLogEntity>,
  ) {}

  async recordEvent(
    input: RecordParkingWarEventInput,
  ): Promise<ParkingWarEventLogEntity> {
    const entity = this.repo.create({
      ownerId: input.ownerId,
      kind: input.kind,
      actorKind: input.actorKind,
      actorId: input.actorId,
      actorName: input.actorName,
      targetKind: input.targetKind ?? null,
      targetId: input.targetId ?? null,
      targetName: input.targetName ?? null,
      amountCents: input.amountCents ?? null,
      payloadJson: input.payload ?? null,
    });
    return this.repo.save(entity);
  }

  async listEvents(
    ownerId: string,
    opts?: { since?: Date; limit?: number },
  ): Promise<ParkingWarEventLogEntity[]> {
    const qb = this.repo
      .createQueryBuilder('event')
      .where('event.ownerId = :ownerId', { ownerId })
      .orderBy('event.createdAt', 'DESC')
      .limit(opts?.limit ?? 50);

    if (opts?.since) {
      qb.andWhere('event.createdAt > :since', { since: opts.since });
    }

    return qb.getMany();
  }

  async listEventsForActor(
    ownerId: string,
    actorId: string,
    limit = 5,
  ): Promise<ParkingWarEventLogEntity[]> {
    return this.repo.find({
      where: [
        { ownerId, actorId },
        { ownerId, targetId: actorId },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async pruneOldEvents(ownerId: string, keepDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - keepDays * 24 * 3600 * 1000);
    const result = await this.repo.delete({
      ownerId,
      createdAt: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }

  toEventView(entity: ParkingWarEventLogEntity): ParkingWarEventView {
    return {
      id: entity.id,
      kind: entity.kind,
      actorKind: entity.actorKind,
      actorId: entity.actorId,
      actorName: entity.actorName,
      targetKind: entity.targetKind ?? null,
      targetId: entity.targetId ?? null,
      targetName: entity.targetName ?? null,
      amountCents: entity.amountCents ?? null,
      payload: entity.payloadJson ?? null,
      createdAt:
        entity.createdAt instanceof Date
          ? entity.createdAt.toISOString()
          : new Date(entity.createdAt).toISOString(),
    };
  }
}
// i18n-ignore-end
