import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AbuseFilterAction } from './abuse-filter.entity';

@Entity('wiki_abuse_filter_hits')
@Index(['filterId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class AbuseFilterHitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filterId: string;

  @Column()
  userId: string;

  @Column({ type: 'text', nullable: true })
  characterId?: string | null;

  @Column({ type: 'text', nullable: true })
  revisionId?: string | null;

  @Column({ type: 'text', length: 500, default: '' })
  matchedText: string;

  @Column()
  actionTaken: AbuseFilterAction;

  @Column()
  operation: string; // 'edit' | 'create' | 'soft_delete' | 'restore' | 'revert'

  @CreateDateColumn()
  createdAt: Date;
}
