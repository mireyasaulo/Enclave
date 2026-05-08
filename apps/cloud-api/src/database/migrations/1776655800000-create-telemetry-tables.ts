import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `CREATE TABLE IF NOT EXISTS "client_telemetry_events" (
    "id" varchar PRIMARY KEY NOT NULL,
    "appId" varchar NOT NULL,
    "eventName" varchar NOT NULL,
    "eventType" varchar NOT NULL,
    "anonId" varchar NOT NULL,
    "userId" text,
    "sessionId" varchar NOT NULL,
    "pagePath" text,
    "referrer" text,
    "propsJson" text,
    "userAgent" text,
    "ipHash" varchar,
    "release" text,
    "occurredAt" datetime NOT NULL,
    "serverReceivedAt" datetime NOT NULL,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_client_telemetry_events_app_name_time" ON "client_telemetry_events" ("appId", "eventName", "occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "IDX_client_telemetry_events_app_type_time" ON "client_telemetry_events" ("appId", "eventType", "occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "IDX_client_telemetry_events_session" ON "client_telemetry_events" ("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_client_telemetry_events_user_time" ON "client_telemetry_events" ("userId", "occurredAt")`,

  `CREATE TABLE IF NOT EXISTS "client_telemetry_daily" (
    "date" varchar NOT NULL,
    "appId" varchar NOT NULL,
    "eventName" varchar NOT NULL,
    "count" integer NOT NULL DEFAULT (0),
    "uniqueUsers" integer NOT NULL DEFAULT (0),
    "uniqueAnons" integer NOT NULL DEFAULT (0),
    "pvCount" integer NOT NULL DEFAULT (0),
    "errorCount" integer NOT NULL DEFAULT (0),
    "apiP50Ms" integer,
    "apiP95Ms" integer,
    "apiSuccessRate" real,
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY ("date", "appId", "eventName")
  )`,
];

const DOWN_QUERIES = [
  `DROP TABLE IF EXISTS "client_telemetry_daily"`,
  `DROP INDEX IF EXISTS "IDX_client_telemetry_events_user_time"`,
  `DROP INDEX IF EXISTS "IDX_client_telemetry_events_session"`,
  `DROP INDEX IF EXISTS "IDX_client_telemetry_events_app_type_time"`,
  `DROP INDEX IF EXISTS "IDX_client_telemetry_events_app_name_time"`,
  `DROP TABLE IF EXISTS "client_telemetry_events"`,
];

export class CreateTelemetryTables1776655800000 implements MigrationInterface {
  name = "CreateTelemetryTables1776655800000";

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
