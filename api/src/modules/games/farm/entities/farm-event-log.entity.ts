import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { FarmActorType, FarmEventKind } from '../farm.types';

@Entity('farm_event_logs')
@Index('IDX_farm_event_owner_created', ['ownerId', 'createdAt'])
export class FarmEventLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column({ type: 'text' })
  actorType: FarmActorType;

  @Column()
  actorId: string;

  @Column()
  actorName: string;

  @Column({ type: 'text', nullable: true })
  targetType?: FarmActorType | null;

  @Column({ type: 'text', nullable: true })
  targetId?: string | null;

  @Column({ type: 'text', nullable: true })
  targetName?: string | null;

  @Column({ type: 'text' })
  kind: FarmEventKind;

  @Column({ type: 'text', nullable: true })
  cropId?: string | null;

  @Column({ type: 'integer', nullable: true })
  intimacyDelta?: number | null;

  @Column('simple-json', { nullable: true })
  payloadJson?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
