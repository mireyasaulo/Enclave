import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `CREATE TABLE IF NOT EXISTS "cloud_user_oauth_identities" (
    "id" varchar PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "provider" text NOT NULL,
    "providerSubject" text NOT NULL,
    "providerEmail" text NOT NULL,
    "emailVerified" boolean NOT NULL DEFAULT (0),
    "displayName" text,
    "avatarUrl" text,
    "rawProfile" text,
    "linkedAt" datetime NOT NULL,
    "lastLoginAt" datetime,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "FK_cloud_user_oauth_identities_user"
      FOREIGN KEY ("userId") REFERENCES "cloud_users" ("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_cloud_user_oauth_identities_userId" ON "cloud_user_oauth_identities" ("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_user_oauth_identities_provider_subject" ON "cloud_user_oauth_identities" ("provider", "providerSubject")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cloud_user_oauth_identities_provider_user" ON "cloud_user_oauth_identities" ("provider", "userId")`,
];

const DOWN_QUERIES = [
  `DROP INDEX IF EXISTS "IDX_cloud_user_oauth_identities_provider_user"`,
  `DROP INDEX IF EXISTS "IDX_cloud_user_oauth_identities_provider_subject"`,
  `DROP INDEX IF EXISTS "IDX_cloud_user_oauth_identities_userId"`,
  `DROP TABLE IF EXISTS "cloud_user_oauth_identities"`,
];

export class CreateCloudUserOAuthIdentities1776657600000 implements MigrationInterface {
  name = "CreateCloudUserOAuthIdentities1776657600000";

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
// i18n-ignore-end
