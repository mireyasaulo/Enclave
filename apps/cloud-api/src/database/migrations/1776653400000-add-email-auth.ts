import type { MigrationInterface, QueryRunner } from "typeorm";

const UP_QUERIES = [
  `ALTER TABLE "cloud_users" ADD COLUMN "email" text`,
  `ALTER TABLE "cloud_users" ADD COLUMN "emailVerifiedAt" datetime`,
  `DROP INDEX IF EXISTS "IDX_cloud_users_phone"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_phone" ON "cloud_users" ("phone") WHERE "phone" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_email" ON "cloud_users" ("email") WHERE "email" IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS "email_verification_sessions" (
    "id" varchar PRIMARY KEY NOT NULL,
    "email" varchar NOT NULL,
    "code" varchar NOT NULL,
    "purpose" varchar NOT NULL DEFAULT ('world_access'),
    "expiresAt" datetime NOT NULL,
    "verifiedAt" datetime,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_email_verification_sessions_email_createdAt" ON "email_verification_sessions" ("email", "createdAt")`,
];

const DOWN_QUERIES = [
  `DROP INDEX IF EXISTS "IDX_email_verification_sessions_email_createdAt"`,
  `DROP TABLE IF EXISTS "email_verification_sessions"`,
  `DROP INDEX IF EXISTS "IDX_cloud_users_email"`,
  `DROP INDEX IF EXISTS "IDX_cloud_users_phone"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_phone" ON "cloud_users" ("phone")`,
  `ALTER TABLE "cloud_users" DROP COLUMN "emailVerifiedAt"`,
  `ALTER TABLE "cloud_users" DROP COLUMN "email"`,
];

export class AddEmailAuth1776653400000 implements MigrationInterface {
  name = "AddEmailAuth1776653400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const query of UP_QUERIES) {
      await queryRunner.query(query);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const query of DOWN_QUERIES) {
      await queryRunner.query(query);
    }
  }
}
