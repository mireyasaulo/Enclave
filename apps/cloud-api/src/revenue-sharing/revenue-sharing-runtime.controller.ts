import { Body, Controller, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { RevenueEventIngestResponse } from "@yinjie/contracts";
import {
  ReportRevenueContributionEventsDto,
  ReportRevenueUsageEventsDto,
} from "../http-dto/cloud-api.dto";
import { RevenueSharingService } from "./revenue-sharing.service";

@Controller("internal/worlds/:worldId/revenue")
export class RevenueSharingRuntimeController {
  constructor(private readonly revenueSharing: RevenueSharingService) {}

  @Post("contribution-events")
  ingestContributionEvents(
    @Param("worldId", new ParseUUIDPipe()) worldId: string,
    @Headers("x-world-callback-token") callbackToken: string | undefined,
    @Body() body: ReportRevenueContributionEventsDto,
  ): Promise<RevenueEventIngestResponse> {
    return this.revenueSharing.ingestContributionEvents(
      worldId,
      body?.events,
      callbackToken,
    );
  }

  @Post("usage-events")
  ingestUsageEvents(
    @Param("worldId", new ParseUUIDPipe()) worldId: string,
    @Headers("x-world-callback-token") callbackToken: string | undefined,
    @Body() body: ReportRevenueUsageEventsDto,
  ): Promise<RevenueEventIngestResponse> {
    return this.revenueSharing.ingestUsageEvents(
      worldId,
      body?.events,
      callbackToken,
    );
  }
}
