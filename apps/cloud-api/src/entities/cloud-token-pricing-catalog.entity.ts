import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("cloud_token_pricing_catalog")
@Index("IDX_cloud_token_pricing_currency_model", ["currency", "model"], {
  unique: true,
})
export class CloudTokenPricingCatalogEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: "CNY" })
  currency: string;

  @Column()
  model: string;

  @Column({ type: "integer", default: 0 })
  inputPer1kMillicents: number;

  @Column({ type: "integer", default: 0 })
  outputPer1kMillicents: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
