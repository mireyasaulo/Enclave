import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuthService } from "../auth/admin-auth.service";
import { AdminGuard } from "../auth/admin.guard";
import { CloudAdminSessionEntity } from "../entities/cloud-admin-session.entity";
import { CloudTokenPricingCatalogEntity } from "../entities/cloud-token-pricing-catalog.entity";
import { CloudTokenUsageBreakdownDailyEntity } from "../entities/cloud-token-usage-breakdown-daily.entity";
import { CloudTokenUsageBudgetEntity } from "../entities/cloud-token-usage-budget.entity";
import { CloudTokenUsageDailyEntity } from "../entities/cloud-token-usage-daily.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import { N1nPricingSyncService } from "./n1n-pricing-sync.service";
import { TokenUsageAdminController } from "./token-usage-admin.controller";
import { TokenUsageRuntimeController } from "./token-usage-runtime.controller";
import { TokenUsageService } from "./token-usage.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CloudAdminSessionEntity,
      CloudWorldEntity,
      CloudTokenUsageDailyEntity,
      CloudTokenUsageBreakdownDailyEntity,
      CloudTokenUsageBudgetEntity,
      CloudTokenPricingCatalogEntity,
    ]),
  ],
  controllers: [TokenUsageAdminController, TokenUsageRuntimeController],
  providers: [
    TokenUsageService,
    N1nPricingSyncService,
    AdminGuard,
    AdminAuthService,
  ],
  exports: [TokenUsageService],
})
export class TokenUsageModule {}
