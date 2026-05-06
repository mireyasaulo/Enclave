import type { MigrationInterface, QueryRunner } from "typeorm";

// SQLite 不支持直接 ALTER COLUMN 改 NOT NULL，因此走 "新建表 -> copy -> drop -> rename" 流程。
const UP_QUERIES = [
  `CREATE TABLE "cloud_users_new" (
    "id" varchar PRIMARY KEY NOT NULL,
    "phone" varchar,
    "email" text,
    "emailVerifiedAt" datetime,
    "displayName" text,
    "status" varchar NOT NULL DEFAULT ('active'),
    "firstLoginAt" datetime,
    "lastLoginAt" datetime,
    "inviteCodeId" text,
    "invitedByCodeId" text,
    "invitedRewardGranted" boolean NOT NULL DEFAULT (0),
    "registrationIp" text,
    "registrationDeviceFingerprint" text,
    "bannedReason" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  `INSERT INTO "cloud_users_new" (
    "id","phone","email","emailVerifiedAt","displayName","status",
    "firstLoginAt","lastLoginAt","inviteCodeId","invitedByCodeId",
    "invitedRewardGranted","registrationIp","registrationDeviceFingerprint",
    "bannedReason","createdAt","updatedAt"
  ) SELECT
    "id","phone","email","emailVerifiedAt","displayName","status",
    "firstLoginAt","lastLoginAt","inviteCodeId","invitedByCodeId",
    "invitedRewardGranted","registrationIp","registrationDeviceFingerprint",
    "bannedReason","createdAt","updatedAt"
  FROM "cloud_users"`,
  `DROP TABLE "cloud_users"`,
  `ALTER TABLE "cloud_users_new" RENAME TO "cloud_users"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_phone" ON "cloud_users" ("phone") WHERE "phone" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_email" ON "cloud_users" ("email") WHERE "email" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_users_status" ON "cloud_users" ("status")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_users_invitedByCodeId" ON "cloud_users" ("invitedByCodeId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_users_registrationDeviceFingerprint" ON "cloud_users" ("registrationDeviceFingerprint")`,
];

const DOWN_QUERIES = [
  // down 仅恢复 phone 为 NOT NULL（仍保留 email 列）。
  `CREATE TABLE "cloud_users_new" (
    "id" varchar PRIMARY KEY NOT NULL,
    "phone" varchar NOT NULL,
    "displayName" text,
    "status" varchar NOT NULL DEFAULT ('active'),
    "firstLoginAt" datetime,
    "lastLoginAt" datetime,
    "inviteCodeId" text,
    "invitedByCodeId" text,
    "invitedRewardGranted" boolean NOT NULL DEFAULT (0),
    "registrationIp" text,
    "registrationDeviceFingerprint" text,
    "bannedReason" text,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
    "email" text,
    "emailVerifiedAt" datetime
  )`,
  `INSERT INTO "cloud_users_new" SELECT
    "id","phone","displayName","status",
    "firstLoginAt","lastLoginAt","inviteCodeId","invitedByCodeId",
    "invitedRewardGranted","registrationIp","registrationDeviceFingerprint",
    "bannedReason","createdAt","updatedAt","email","emailVerifiedAt"
  FROM "cloud_users" WHERE "phone" IS NOT NULL`,
  `DROP TABLE "cloud_users"`,
  `ALTER TABLE "cloud_users_new" RENAME TO "cloud_users"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_phone" ON "cloud_users" ("phone")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_users_email" ON "cloud_users" ("email") WHERE "email" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_users_status" ON "cloud_users" ("status")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_users_invitedByCodeId" ON "cloud_users" ("invitedByCodeId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_users_registrationDeviceFingerprint" ON "cloud_users" ("registrationDeviceFingerprint")`,
];

export class MakeCloudUsersPhoneNullable1776654600000
  implements MigrationInterface
{
  name = "MakeCloudUsersPhoneNullable1776654600000";

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
