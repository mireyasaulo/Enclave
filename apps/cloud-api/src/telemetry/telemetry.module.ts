import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuthService } from "../auth/admin-auth.service";
import { AdminGuard } from "../auth/admin.guard";
import { CloudAdminSessionEntity } from "../entities/cloud-admin-session.entity";
import { CloudWorldEntity } from "../entities/cloud-world.entity";
import { ClientTelemetryDailyEntity } from "../entities/client-telemetry-daily.entity";
import { ClientTelemetryEventEntity } from "../entities/client-telemetry-event.entity";
import { TelemetryAdminController } from "./telemetry-admin.controller";
import { TelemetryAggregatorService } from "./telemetry-aggregator.service";
import { TelemetryPublicController } from "./telemetry-public.controller";
import { TelemetryService } from "./telemetry.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientTelemetryEventEntity,
      ClientTelemetryDailyEntity,
      CloudAdminSessionEntity,
      CloudWorldEntity,
    ]),
  ],
  controllers: [TelemetryPublicController, TelemetryAdminController],
  providers: [TelemetryService, TelemetryAggregatorService, AdminGuard, AdminAuthService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
