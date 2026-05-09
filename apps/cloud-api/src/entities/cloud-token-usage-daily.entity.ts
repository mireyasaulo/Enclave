import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("cloud_token_usage_daily")
@Index("IDX_cloud_token_usage_daily_world_date", ["worldId", "bucketDate"], {
  unique: true,
})
@Index("IDX_cloud_token_usage_daily_date", ["bucketDate"])
export class CloudTokenUsageDailyEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  worldId: string;

  @Column({ type: "varchar", length: 10 })
  bucketDate: string;

  @Column({ default: "CNY" })
  currency: string;

  @Column({ type: "integer", default: 0 })
  promptTokens: number;

  @Column({ type: "integer", default: 0 })
  completionTokens: number;

  @Column({ type: "integer", default: 0 })
  totalTokens: number;

  @Column({ type: "integer", default: 0 })
  estimatedCostCents: number;

  @Column({ type: "integer", default: 0 })
  requestCount: number;

  @Column({ type: "integer", default: 0 })
  successCount: number;

  @Column({ type: "integer", default: 0 })
  failedCount: number;

  @Column({ type: "integer", default: 0 })
  activeCharacterCount: number;

  @Column({ type: "datetime" })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
