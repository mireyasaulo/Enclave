import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('wiki_blocks')
@Index(['userId', 'revokedAt'])
export class WikiBlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  scope: string; // 'global' | 'page' | 'talk'

  @Column({ type: 'text', nullable: true })
  targetCharacterId?: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column()
  createdBy: string;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  revokedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
