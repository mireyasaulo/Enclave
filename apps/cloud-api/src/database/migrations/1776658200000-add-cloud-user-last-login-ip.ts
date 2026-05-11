import type { MigrationInterface, QueryRunner } from "typeorm";

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
const UP_QUERIES = [
  `ALTER TABLE "cloud_users" ADD COLUMN "lastLoginIp" text`,
];

const DOWN_QUERIES = [
  `ALTER TABLE "cloud_users" DROP COLUMN "lastLoginIp"`,
];

export class AddCloudUserLastLoginIp1776658200000 implements MigrationInterface {
  name = "AddCloudUserLastLoginIp1776658200000";

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
