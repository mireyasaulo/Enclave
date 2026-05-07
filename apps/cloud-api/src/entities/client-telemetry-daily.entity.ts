import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("client_telemetry_daily")
export class ClientTelemetryDailyEntity {
  @PrimaryColumn()
  date: string;

  @PrimaryColumn()
  appId: string;

  @PrimaryColumn()
  eventName: string;

  @Column({ type: "integer", default: 0 })
  count: number;

  @Column({ type: "integer", default: 0 })
  uniqueUsers: number;

  @Column({ type: "integer", default: 0 })
  uniqueAnons: number;

  @Column({ type: "integer", default: 0 })
  pvCount: number;

  @Column({ type: "integer", default: 0 })
  errorCount: number;

  @Column({ type: "integer", nullable: true })
  apiP50Ms: number | null;

  @Column({ type: "integer", nullable: true })
  apiP95Ms: number | null;

  @Column({ type: "real", nullable: true })
  apiSuccessRate: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
