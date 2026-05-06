import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("cloud_feedbacks")
export class CloudFeedbackEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ default: "desktop" })
  source: string;

  @Index()
  @Column()
  category: string;

  @Index()
  @Column()
  priority: string;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text" })
  detail: string;

  @Column({ type: "text", default: "" })
  reproduction: string;

  @Column({ type: "text", default: "" })
  expected: string;

  @Column({ type: "text", default: "" })
  diagnosticSummary: string;

  @Column({ type: "boolean", default: false })
  includeSystemSnapshot: boolean;

  @Index()
  @Column({ type: "text", nullable: true })
  clientRecordId: string | null;

  @Column({ type: "text", nullable: true })
  clientSubmittedAt: string | null;

  @Column({ type: "text", nullable: true })
  appPlatform: string | null;

  @Column({ type: "text", nullable: true })
  apiBaseUrl: string | null;

  @Column({ type: "text", nullable: true })
  ownerName: string | null;

  @Column({ type: "text", nullable: true })
  ownerSignature: string | null;

  @Index()
  @Column({ type: "text", nullable: true })
  submitterPhone: string | null;

  @Index()
  @Column({ type: "text", nullable: true })
  submitterEmail: string | null;

  @Column({ type: "text", nullable: true })
  submitterIp: string | null;

  @Column({ type: "text", nullable: true })
  submitterUserAgent: string | null;

  @Index()
  @Column({ default: "new" })
  status: string;

  @Column({ type: "text", nullable: true })
  handlerNote: string | null;

  @Column({ type: "datetime", nullable: true })
  handledAt: Date | null;

  @Column({ type: "text", nullable: true })
  handledBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
