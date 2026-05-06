import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("revenue_payees")
@Index("IDX_revenue_payees_external_ref", ["externalRefType", "externalRefId"], {
  unique: true,
})
export class RevenuePayeeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  displayName: string;

  @Column({ default: "pending" })
  status: string;

  @Column()
  externalRefType: string;

  @Column()
  externalRefId: string;

  @Column({ type: "text", nullable: true })
  contact: string | null;

  @Column({ type: "text", nullable: true })
  payoutNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
