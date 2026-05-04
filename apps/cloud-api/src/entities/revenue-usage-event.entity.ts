import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("revenue_usage_events")
@Index("IDX_revenue_usage_events_source", ["worldId", "sourceEventId"], {
  unique: true,
})
@Index("IDX_revenue_usage_events_character", [
  "worldId",
  "characterId",
  "occurredAt",
])
export class RevenueUsageEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  worldId: string;

  @Column()
  sourceEventId: string;

  @Column()
  eventType: string;

  @Column()
  characterId: string;

  @Column({ type: "text", nullable: true })
  characterName: string | null;

  @Column({ type: "integer", default: 1 })
  quantity: number;

  @Column({ type: "integer", default: 0 })
  unitAmountCents: number;

  @Column({ type: "integer", default: 0 })
  grossAmountCents: number;

  @Column({ default: "CNY" })
  currency: string;

  @Column({ type: "text", nullable: true })
  policyId: string | null;

  @Column({ type: "datetime", nullable: true })
  processedAt: Date | null;

  @Column({ type: "datetime" })
  occurredAt: Date;

  @Column({ type: "text", nullable: true })
  metadataJson: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
