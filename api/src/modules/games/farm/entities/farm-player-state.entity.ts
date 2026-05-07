import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  FarmPlot,
  FarmStolenLogEntry,
  FARM_DEFAULT_PLAYER_COINS,
  FARM_DEFAULT_PLOT_COUNT,
} from '../farm.types';

@Entity('farm_player_states')
export class FarmPlayerStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ownerId: string;

  @Column({ type: 'integer', default: FARM_DEFAULT_PLAYER_COINS })
  coins: number;

  @Column({ type: 'integer', default: 0 })
  experience: number;

  @Column({ type: 'integer', default: 1 })
  level: number;

  @Column({ type: 'integer', default: FARM_DEFAULT_PLOT_COUNT })
  plotCount: number;

  @Column('simple-json', { nullable: true })
  plotsPayload?: FarmPlot[] | null;

  @Column('simple-json', { nullable: true })
  warehousePayload?: Record<string, number> | null;

  @Column('simple-json', { nullable: true })
  seedBagPayload?: Record<string, number> | null;

  @Column('simple-json', { nullable: true })
  weeklyStolenLogPayload?: FarmStolenLogEntry[] | null;

  @Column({ type: 'datetime', nullable: true })
  lastTickAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
