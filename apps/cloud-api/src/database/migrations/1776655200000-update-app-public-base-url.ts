import type { MigrationInterface, QueryRunner } from "typeorm";

const PLACEHOLDER = '"https://app.example.com"';
const REAL = '"https://1gw06751dd053.vicp.fun"';

// 把存量 cloud_configs.app.publicBaseUrl 从占位符升级到真实部署域名。
// 仅在当前值仍是占位符时改写，避免覆盖运营手工配置过的值。
export class UpdateAppPublicBaseUrl1776655200000 implements MigrationInterface {
  name = "UpdateAppPublicBaseUrl1776655200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "cloud_configs" SET "value" = ? WHERE "key" = 'app.publicBaseUrl' AND "value" = ?`,
      [REAL, PLACEHOLDER],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "cloud_configs" SET "value" = ? WHERE "key" = 'app.publicBaseUrl' AND "value" = ?`,
      [PLACEHOLDER, REAL],
    );
  }
}
