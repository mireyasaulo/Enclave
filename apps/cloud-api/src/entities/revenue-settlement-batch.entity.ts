import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("revenue_settlement_batches")
export class RevenueSettlementBatchEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: "generated" })
  status: string;

  @Column({ default: "CNY" })
  currency: string;

  @Column({ type: "integer", default: 0 })
  totalAmountCents: number;

  @Column({ type: "integer", default: 0 })
  allocationCount: number;

  @Column({ type: "datetime", nullable: true })
  periodFrom: Date | null;

  @Column({ type: "datetime", nullable: true })
  periodTo: Date | null;

  @Column({ type: "text", nullable: true })
  generatedBy: string | null;

  @Column({ type: "text", nullable: true })
  metadataJson: string | null;

  @CreateDateColumn()
  generatedAt: Date;
}
