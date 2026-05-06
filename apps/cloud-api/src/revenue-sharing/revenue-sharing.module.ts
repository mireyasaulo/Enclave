import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuthService } from "../auth/admin-auth.service";
import { AdminGuard } from "../auth/admin.guard";
import { CloudAdminSessionEntity } from "../entities/cloud-admin-session.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import { RevenueAllocationLedgerEntity } from "../entities/revenue-allocation-ledger.entity";
import { RevenueContributionEventEntity } from "../entities/revenue-contribution-event.entity";
import { RevenuePayeeEntity } from "../entities/revenue-payee.entity";
import { RevenueSettlementBatchEntity } from "../entities/revenue-settlement-batch.entity";
import { RevenueSharingPolicyEntity } from "../entities/revenue-sharing-policy.entity";
import { RevenueUsageEventEntity } from "../entities/revenue-usage-event.entity";
import { RevenueSharingAdminController } from "./revenue-sharing-admin.controller";
import { RevenueSharingRuntimeController } from "./revenue-sharing-runtime.controller";
import { RevenueSharingService } from "./revenue-sharing.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CloudAdminSessionEntity,
      CloudWorldEntity,
      RevenueSharingPolicyEntity,
      RevenuePayeeEntity,
      RevenueContributionEventEntity,
      RevenueUsageEventEntity,
      RevenueAllocationLedgerEntity,
      RevenueSettlementBatchEntity,
    ]),
  ],
  controllers: [RevenueSharingAdminController, RevenueSharingRuntimeController],
  providers: [RevenueSharingService, AdminGuard, AdminAuthService],
  exports: [RevenueSharingService],
})
export class RevenueSharingModule {}
