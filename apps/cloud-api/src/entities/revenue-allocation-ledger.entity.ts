import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("revenue_allocation_ledger")
@Index("IDX_revenue_allocation_usage", ["usageEventId"])
@Index("IDX_revenue_allocation_payee_status", ["payeeId", "status"])
@Index("IDX_revenue_allocation_world_character", ["worldId", "characterId"])
export class RevenueAllocationLedgerEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  usageEventId: string;

  @Column()
  worldId: string;

  @Column()
  characterId: string;

  @Column({ type: "text", nullable: true })
  payeeId: string | null;

  @Column()
  participantType: string;

  @Column()
  sourceType: string;

  @Column({ type: "integer" })
  amountCents: number;

  @Column({ default: "CNY" })
  currency: string;

  @Column({ type: "float", nullable: true })
  contributionScore: number | null;

  @Column({ default: "held" })
  status: string;

  @Column({ type: "text", nullable: true })
  settlementBatchId: string | null;

  @Column({ type: "text", nullable: true })
  policyId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
