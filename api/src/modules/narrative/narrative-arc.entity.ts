import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
@Entity('narrative_arcs')
export class NarrativeArcEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'userId' })
  ownerId: string;

  @Column()
  characterId: string;

  @Column()
  title: string;

  @Column({ default: 'active' })
  status: string; // 'active' | 'completed' | 'paused'

  @Column({ default: 0 })
  progress: number; // 0-100

  @Column('simple-json', { nullable: true })
  milestones?: { label: string; completedAt?: Date }[];

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;
}
// i18n-ignore-end
