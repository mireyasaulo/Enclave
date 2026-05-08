import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("cloud_token_usage_breakdown_daily")
@Index(
  "IDX_cloud_token_breakdown_unique",
  ["worldId", "bucketDate", "dimension", "key"],
  { unique: true },
)
@Index("IDX_cloud_token_breakdown_lookup", [
  "worldId",
  "bucketDate",
  "dimension",
])
export class CloudTokenUsageBreakdownDailyEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  worldId: string;

  @Column({ type: "varchar", length: 10 })
  bucketDate: string;

  @Column()
  dimension: string;

  @Column()
  key: string;

  @Column({ type: "text", nullable: true })
  label: string | null;

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

  @Column({ type: "datetime" })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
