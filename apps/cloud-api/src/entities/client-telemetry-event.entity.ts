import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("client_telemetry_events")
@Index("IDX_client_telemetry_events_app_name_time", [
  "appId",
  "eventName",
  "occurredAt",
])
@Index("IDX_client_telemetry_events_app_type_time", [
  "appId",
  "eventType",
  "occurredAt",
])
@Index("IDX_client_telemetry_events_session", ["sessionId"])
@Index("IDX_client_telemetry_events_user_time", ["userId", "occurredAt"])
export class ClientTelemetryEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  appId: string;

  @Column()
  eventName: string;

  @Column()
  eventType: string;

  @Column()
  anonId: string;

  @Column({ type: "text", nullable: true })
  userId: string | null;

  @Column()
  sessionId: string;

  @Column({ type: "text", nullable: true })
  pagePath: string | null;

  @Column({ type: "text", nullable: true })
  referrer: string | null;

  @Column({ type: "text", nullable: true })
  propsJson: string | null;

  @Column({ type: "text", nullable: true })
  userAgent: string | null;

  @Column({ type: "varchar", nullable: true })
  ipHash: string | null;

  @Column({ type: "text", nullable: true })
  release: string | null;

  @Column({ type: "datetime" })
  occurredAt: Date;

  @Column({ type: "datetime" })
  serverReceivedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
