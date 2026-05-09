import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `ALTER TABLE "client_telemetry_events" ADD COLUMN "worldId" varchar(120)`,
  `CREATE INDEX IF NOT EXISTS "IDX_client_telemetry_events_app_world_time" ON "client_telemetry_events" ("appId", "worldId", "occurredAt")`,
];

const DOWN_QUERIES = [
  `DROP INDEX IF EXISTS "IDX_client_telemetry_events_app_world_time"`,
  // SQLite 3.35+ 支持 ALTER TABLE DROP COLUMN，better-sqlite3 当前已包含。
  `ALTER TABLE "client_telemetry_events" DROP COLUMN "worldId"`,
];

export class AddWorldIdToTelemetry1776656400000 implements MigrationInterface {
  name = "AddWorldIdToTelemetry1776656400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const query of UP_QUERIES) {
      await queryRunner.query(query);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const query of DOWN_QUERIES) {
      await queryRunner.query(query);
    }
  }
}
// i18n-ignore-end
