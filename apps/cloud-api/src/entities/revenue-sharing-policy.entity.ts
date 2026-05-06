import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("revenue_sharing_policies")
@Index("IDX_revenue_sharing_policies_status_created", ["status", "createdAt"])
export class RevenueSharingPolicyEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "integer" })
  version: number;

  @Column({ default: "inactive" })
  status: string;

  @Column({ type: "text" })
  configJson: string;

  @Column({ type: "text", nullable: true })
  createdBy: string | null;

  @Column({ type: "datetime", nullable: true })
  activatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
