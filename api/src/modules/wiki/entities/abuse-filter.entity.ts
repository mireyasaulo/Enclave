import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AbuseFilterAction =
  | 'log'
  | 'warn'
  | 'block'
  | 'tag_high_risk';

export type AbuseFilterScope = 'content' | 'recipe' | 'all';

export type AbuseFilterPattern =
  | {
      type: 'regex';
      regex: string;
      flags?: string;
      fields?: string[];
    }
  | {
      type: 'shrink';
      field: string;
      threshold: number; // 0..1, e.g. 0.8 means shrink ≥80%
    }
  | {
      type: 'frequency';
      windowSec: number;
      maxEdits: number;
    }
  | {
      type: 'link_flood';
      threshold: number;
    }
  | {
      type: 'keyword_list';
      keywords: string[];
      caseSensitive?: boolean;
    };

@Entity('wiki_abuse_filters')
@Index(['enabled'])
export class AbuseFilterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 120 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ default: true })
  enabled: boolean;

  @Column('simple-json')
  pattern: AbuseFilterPattern;

  @Column({ default: 'all' })
  scope: AbuseFilterScope;

  @Column()
  action: AbuseFilterAction;

  @Column({ default: 'medium' })
  severity: 'low' | 'medium' | 'high';

  @Column({ type: 'text', nullable: true })
  createdBy?: string | null;

  @Column({ default: 0 })
  hitCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastHitAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
