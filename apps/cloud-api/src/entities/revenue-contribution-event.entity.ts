import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("revenue_contribution_events")
@Index("IDX_revenue_contribution_events_source", ["worldId", "sourceEventId"], {
  unique: true,
})
@Index("IDX_revenue_contribution_events_character", [
  "worldId",
  "characterId",
  "occurredAt",
])
export class RevenueContributionEventEntity {
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
  contributorPayeeId: string | null;

  @Column()
  contributorExternalRefType: string;

  @Column()
  contributorExternalRefId: string;

  @Column({ type: "datetime" })
  occurredAt: Date;

  @Column({ type: "datetime", nullable: true })
  reversedAt: Date | null;

  @Column({ type: "text", nullable: true })
  metadataJson: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
