import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { FarmEventLogEntity } from './entities/farm-event-log.entity';
import {
  FarmActorType,
  FarmEventKind,
  FarmEventView,
} from './farm.types';

export interface RecordEventInput {
  ownerId: string;
  kind: FarmEventKind;
  actorType: FarmActorType;
  actorId: string;
  actorName: string;
  targetType?: FarmActorType | null;
  targetId?: string | null;
  targetName?: string | null;
  cropId?: string | null;
  intimacyDelta?: number | null;
  payload?: Record<string, unknown> | null;
}

@Injectable()
export class FarmEventService {
  constructor(
    @InjectRepository(FarmEventLogEntity)
    private readonly repo: Repository<FarmEventLogEntity>,
  ) {}

  async recordEvent(input: RecordEventInput): Promise<FarmEventLogEntity> {
    const entity = this.repo.create({
      ownerId: input.ownerId,
      kind: input.kind,
      actorType: input.actorType,
      actorId: input.actorId,
      actorName: input.actorName,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetName: input.targetName ?? null,
      cropId: input.cropId ?? null,
      intimacyDelta: input.intimacyDelta ?? null,
      payloadJson: input.payload ?? null,
    });
    return this.repo.save(entity);
  }

  async listEvents(
    ownerId: string,
    opts?: { since?: Date; limit?: number },
  ): Promise<FarmEventLogEntity[]> {
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
  ): Promise<FarmEventLogEntity[]> {
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

  toEventView(entity: FarmEventLogEntity): FarmEventView {
    return {
      id: entity.id,
      kind: entity.kind,
      actorType: entity.actorType,
      actorId: entity.actorId,
      actorName: entity.actorName,
      targetType: entity.targetType ?? null,
      targetId: entity.targetId ?? null,
      cropId: (entity.cropId as FarmEventView['cropId']) ?? null,
      intimacyDelta: entity.intimacyDelta ?? null,
      payload: entity.payloadJson ?? null,
      createdAt:
        entity.createdAt instanceof Date
          ? entity.createdAt.toISOString()
          : new Date(entity.createdAt).toISOString(),
    };
  }
}
