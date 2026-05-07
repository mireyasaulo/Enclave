import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClientTelemetryDailyEntity } from "../entities/client-telemetry-daily.entity";
import { ClientTelemetryEventEntity } from "../entities/client-telemetry-event.entity";
import { TelemetryPublicController } from "./telemetry-public.controller";
import { TelemetryService } from "./telemetry.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientTelemetryEventEntity,
      ClientTelemetryDailyEntity,
    ]),
  ],
  controllers: [TelemetryPublicController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
