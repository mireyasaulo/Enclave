import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `CREATE TABLE IF NOT EXISTS "cloud_token_usage_daily" (
    "id" varchar PRIMARY KEY NOT NULL,
    "worldId" varchar NOT NULL,
    "bucketDate" varchar(10) NOT NULL,
    "currency" varchar NOT NULL DEFAULT ('CNY'),
    "promptTokens" integer NOT NULL DEFAULT (0),
    "completionTokens" integer NOT NULL DEFAULT (0),
    "totalTokens" integer NOT NULL DEFAULT (0),
    "estimatedCostCents" integer NOT NULL DEFAULT (0),
    "requestCount" integer NOT NULL DEFAULT (0),
    "successCount" integer NOT NULL DEFAULT (0),
    "failedCount" integer NOT NULL DEFAULT (0),
    "activeCharacterCount" integer NOT NULL DEFAULT (0),
    "syncedAt" datetime NOT NULL,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_token_usage_daily_world_date" ON "cloud_token_usage_daily" ("worldId", "bucketDate")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_token_usage_daily_date" ON "cloud_token_usage_daily" ("bucketDate")`,

  `CREATE TABLE IF NOT EXISTS "cloud_token_usage_breakdown_daily" (
    "id" varchar PRIMARY KEY NOT NULL,
    "worldId" varchar NOT NULL,
    "bucketDate" varchar(10) NOT NULL,
    "dimension" varchar NOT NULL,
    "key" varchar NOT NULL,
    "label" text,
    "currency" varchar NOT NULL DEFAULT ('CNY'),
    "promptTokens" integer NOT NULL DEFAULT (0),
    "completionTokens" integer NOT NULL DEFAULT (0),
    "totalTokens" integer NOT NULL DEFAULT (0),
    "estimatedCostCents" integer NOT NULL DEFAULT (0),
    "requestCount" integer NOT NULL DEFAULT (0),
    "successCount" integer NOT NULL DEFAULT (0),
    "failedCount" integer NOT NULL DEFAULT (0),
    "syncedAt" datetime NOT NULL,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_token_breakdown_unique" ON "cloud_token_usage_breakdown_daily" ("worldId", "bucketDate", "dimension", "key")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_token_breakdown_lookup" ON "cloud_token_usage_breakdown_daily" ("worldId", "bucketDate", "dimension")`,

  `CREATE TABLE IF NOT EXISTS "cloud_token_usage_budget" (
    "id" varchar PRIMARY KEY NOT NULL,
    "worldId" text,
    "enabled" integer NOT NULL DEFAULT (0),
    "metric" varchar NOT NULL DEFAULT ('tokens'),
    "enforcement" varchar NOT NULL DEFAULT ('monitor'),
    "downgradeModel" text,
    "dailyLimit" integer,
    "monthlyLimit" integer,
    "warningRatio" real NOT NULL DEFAULT (0.8),
    "note" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_token_budget_world" ON "cloud_token_usage_budget" ("worldId")`,

  `CREATE TABLE IF NOT EXISTS "cloud_token_pricing_catalog" (
    "id" varchar PRIMARY KEY NOT NULL,
    "currency" varchar NOT NULL DEFAULT ('CNY'),
    "model" varchar NOT NULL,
    "inputPer1kMillicents" integer NOT NULL DEFAULT (0),
    "outputPer1kMillicents" integer NOT NULL DEFAULT (0),
    "enabled" integer NOT NULL DEFAULT (1),
    "note" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_token_pricing_currency_model" ON "cloud_token_pricing_catalog" ("currency", "model")`,
];

const DOWN_QUERIES = [
  `DROP INDEX IF EXISTS "IDX_cloud_token_pricing_currency_model"`,
  `DROP TABLE IF EXISTS "cloud_token_pricing_catalog"`,
  `DROP INDEX IF EXISTS "IDX_cloud_token_budget_world"`,
  `DROP TABLE IF EXISTS "cloud_token_usage_budget"`,
  `DROP INDEX IF EXISTS "IDX_cloud_token_breakdown_lookup"`,
  `DROP INDEX IF EXISTS "IDX_cloud_token_breakdown_unique"`,
  `DROP TABLE IF EXISTS "cloud_token_usage_breakdown_daily"`,
  `DROP INDEX IF EXISTS "IDX_cloud_token_usage_daily_date"`,
  `DROP INDEX IF EXISTS "IDX_cloud_token_usage_daily_world_date"`,
  `DROP TABLE IF EXISTS "cloud_token_usage_daily"`,
];

export class CreateCloudTokenUsageTables1776657000000
  implements MigrationInterface
{
  name = "CreateCloudTokenUsageTables1776657000000";

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
