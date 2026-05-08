import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `CREATE TABLE IF NOT EXISTS "cloud_feedbacks" (
    "id" varchar PRIMARY KEY NOT NULL,
    "source" varchar NOT NULL DEFAULT ('desktop'),
    "category" varchar NOT NULL,
    "priority" varchar NOT NULL,
    "title" text NOT NULL,
    "detail" text NOT NULL,
    "reproduction" text NOT NULL DEFAULT (''),
    "expected" text NOT NULL DEFAULT (''),
    "diagnosticSummary" text NOT NULL DEFAULT (''),
    "includeSystemSnapshot" boolean NOT NULL DEFAULT (0),
    "clientRecordId" text,
    "clientSubmittedAt" text,
    "appPlatform" text,
    "apiBaseUrl" text,
    "ownerName" text,
    "ownerSignature" text,
    "submitterPhone" text,
    "submitterEmail" text,
    "submitterIp" text,
    "submitterUserAgent" text,
    "status" varchar NOT NULL DEFAULT ('new'),
    "handlerNote" text,
    "handledAt" datetime,
    "handledBy" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_source" ON "cloud_feedbacks" ("source")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_category" ON "cloud_feedbacks" ("category")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_priority" ON "cloud_feedbacks" ("priority")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_status" ON "cloud_feedbacks" ("status")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_clientRecordId" ON "cloud_feedbacks" ("clientRecordId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_submitterPhone" ON "cloud_feedbacks" ("submitterPhone")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_submitterEmail" ON "cloud_feedbacks" ("submitterEmail")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_feedbacks_createdAt" ON "cloud_feedbacks" ("createdAt")`,
];

const DOWN_QUERIES = [
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_createdAt"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_submitterEmail"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_submitterPhone"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_clientRecordId"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_status"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_priority"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_category"`,
  `DROP INDEX IF EXISTS "IDX_cloud_feedbacks_source"`,
  `DROP TABLE IF EXISTS "cloud_feedbacks"`,
];

export class CreateCloudFeedbackTable1776654000000
  implements MigrationInterface
{
  name = "CreateCloudFeedbackTable1776654000000";

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
