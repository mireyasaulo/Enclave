import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("cloud_token_usage_budget")
@Index("IDX_cloud_token_budget_world", ["worldId"], { unique: true })
export class CloudTokenUsageBudgetEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text", nullable: true })
  worldId: string | null;

  @Column({ default: false })
  enabled: boolean;

  @Column({ default: "tokens" })
  metric: string;

  @Column({ default: "monitor" })
  enforcement: string;

  @Column({ type: "text", nullable: true })
  downgradeModel: string | null;

  @Column({ type: "integer", nullable: true })
  dailyLimit: number | null;

  @Column({ type: "integer", nullable: true })
  monthlyLimit: number | null;

  @Column({ type: "float", default: 0.8 })
  warningRatio: number;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
