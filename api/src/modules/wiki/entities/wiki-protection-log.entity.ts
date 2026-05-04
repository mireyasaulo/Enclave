import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('wiki_protection_logs')
@Index(['characterId', 'createdAt'])
export class WikiProtectionLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  characterId: string;

  @Column()
  oldLevel: string;

  @Column()
  newLevel: string;

  @Column()
  changedBy: string;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
