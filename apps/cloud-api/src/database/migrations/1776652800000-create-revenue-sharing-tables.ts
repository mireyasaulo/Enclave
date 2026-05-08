import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `CREATE TABLE IF NOT EXISTS "revenue_sharing_policies" (
    "id" varchar PRIMARY KEY NOT NULL,
    "version" integer NOT NULL,
    "status" varchar NOT NULL DEFAULT ('inactive'),
    "configJson" text NOT NULL,
    "createdBy" text,
    "activatedAt" datetime,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_revenue_sharing_policies_status_created" ON "revenue_sharing_policies" ("status", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "revenue_payees" (
    "id" varchar PRIMARY KEY NOT NULL,
    "displayName" varchar NOT NULL,
    "status" varchar NOT NULL DEFAULT ('pending'),
    "externalRefType" varchar NOT NULL,
    "externalRefId" varchar NOT NULL,
    "contact" text,
    "payoutNote" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_revenue_payees_external_ref" ON "revenue_payees" ("externalRefType", "externalRefId")`,

  `CREATE TABLE IF NOT EXISTS "revenue_contribution_events" (
    "id" varchar PRIMARY KEY NOT NULL,
    "worldId" varchar NOT NULL,
    "sourceEventId" varchar NOT NULL,
    "eventType" varchar NOT NULL,
    "characterId" varchar NOT NULL,
    "contributorPayeeId" text,
    "contributorExternalRefType" varchar NOT NULL,
    "contributorExternalRefId" varchar NOT NULL,
    "occurredAt" datetime NOT NULL,
    "reversedAt" datetime,
    "metadataJson" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_revenue_contribution_events_source" ON "revenue_contribution_events" ("worldId", "sourceEventId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_revenue_contribution_events_character" ON "revenue_contribution_events" ("worldId", "characterId", "occurredAt")`,

  `CREATE TABLE IF NOT EXISTS "revenue_usage_events" (
    "id" varchar PRIMARY KEY NOT NULL,
    "worldId" varchar NOT NULL,
    "sourceEventId" varchar NOT NULL,
    "eventType" varchar NOT NULL,
    "characterId" varchar NOT NULL,
    "characterName" text,
    "quantity" integer NOT NULL DEFAULT (1),
    "unitAmountCents" integer NOT NULL DEFAULT (0),
    "grossAmountCents" integer NOT NULL DEFAULT (0),
    "currency" varchar NOT NULL DEFAULT ('CNY'),
    "policyId" text,
    "processedAt" datetime,
    "occurredAt" datetime NOT NULL,
    "metadataJson" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_revenue_usage_events_source" ON "revenue_usage_events" ("worldId", "sourceEventId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_revenue_usage_events_character" ON "revenue_usage_events" ("worldId", "characterId", "occurredAt")`,

  `CREATE TABLE IF NOT EXISTS "revenue_allocation_ledger" (
    "id" varchar PRIMARY KEY NOT NULL,
    "usageEventId" varchar NOT NULL,
    "worldId" varchar NOT NULL,
    "characterId" varchar NOT NULL,
    "payeeId" text,
    "participantType" varchar NOT NULL,
    "sourceType" varchar NOT NULL,
    "amountCents" integer NOT NULL,
    "currency" varchar NOT NULL DEFAULT ('CNY'),
    "contributionScore" float,
    "status" varchar NOT NULL DEFAULT ('held'),
    "settlementBatchId" text,
    "policyId" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_revenue_allocation_usage" ON "revenue_allocation_ledger" ("usageEventId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_revenue_allocation_payee_status" ON "revenue_allocation_ledger" ("payeeId", "status")`,
  `CREATE INDEX IF NOT EXISTS "IDX_revenue_allocation_world_character" ON "revenue_allocation_ledger" ("worldId", "characterId")`,

  `CREATE TABLE IF NOT EXISTS "revenue_settlement_batches" (
    "id" varchar PRIMARY KEY NOT NULL,
    "status" varchar NOT NULL DEFAULT ('generated'),
    "currency" varchar NOT NULL DEFAULT ('CNY'),
    "totalAmountCents" integer NOT NULL DEFAULT (0),
    "allocationCount" integer NOT NULL DEFAULT (0),
    "periodFrom" datetime,
    "periodTo" datetime,
    "generatedBy" text,
    "metadataJson" text,
    "generatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
];

const DOWN_QUERIES = [
  `DROP TABLE IF EXISTS "revenue_settlement_batches"`,
  `DROP INDEX IF EXISTS "IDX_revenue_allocation_world_character"`,
  `DROP INDEX IF EXISTS "IDX_revenue_allocation_payee_status"`,
  `DROP INDEX IF EXISTS "IDX_revenue_allocation_usage"`,
  `DROP TABLE IF EXISTS "revenue_allocation_ledger"`,
  `DROP INDEX IF EXISTS "IDX_revenue_usage_events_character"`,
  `DROP INDEX IF EXISTS "IDX_revenue_usage_events_source"`,
  `DROP TABLE IF EXISTS "revenue_usage_events"`,
  `DROP INDEX IF EXISTS "IDX_revenue_contribution_events_character"`,
  `DROP INDEX IF EXISTS "IDX_revenue_contribution_events_source"`,
  `DROP TABLE IF EXISTS "revenue_contribution_events"`,
  `DROP INDEX IF EXISTS "IDX_revenue_payees_external_ref"`,
  `DROP TABLE IF EXISTS "revenue_payees"`,
  `DROP INDEX IF EXISTS "IDX_revenue_sharing_policies_status_created"`,
  `DROP TABLE IF EXISTS "revenue_sharing_policies"`,
];

export class CreateRevenueSharingTables1776652800000
  implements MigrationInterface
{
  name = "CreateRevenueSharingTables1776652800000";

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
