import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type {
  TelemetryApiHealthResponse,
  TelemetryAppId,
  TelemetryErrorsResponse,
  TelemetryFunnelResponse,
  TelemetryOverviewResponse,
  TelemetryRange,
  TelemetryTimeseriesResponse,
  TelemetryTopEventsResponse,
} from "@yinjie/contracts";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AdminGuard } from "../auth/admin.guard";
import { TelemetryService } from "./telemetry.service";

const RANGE_VALUES = ["24h", "7d", "30d"] as const;
const APP_ID_VALUES = ["app", "site", "wiki"] as const;

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

class RangeQueryDto {
  @Transform(trimString)
  @IsOptional()
  @IsIn(RANGE_VALUES, { message: "range 不合法。" })
  range?: (typeof RANGE_VALUES)[number];

  @Transform(trimString)
  @IsOptional()
  @IsIn(APP_ID_VALUES, { message: "appId 不合法。" })
  appId?: (typeof APP_ID_VALUES)[number];
}

class TimeseriesQueryDto extends RangeQueryDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  eventName: string;

  @Transform(trimString)
  @IsOptional()
  @IsIn(["appId", "none"] as const, { message: "groupBy 不合法。" })
  groupBy?: "appId" | "none";
}

class FunnelQueryDto extends RangeQueryDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  steps: string;
}

@Controller("admin/cloud/telemetry")
@UseGuards(AdminGuard)
export class TelemetryAdminController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get("overview")
  overview(@Query() q: RangeQueryDto): Promise<TelemetryOverviewResponse> {
    return this.telemetry.overview(
      (q.range ?? "7d") as TelemetryRange,
      q.appId as TelemetryAppId | undefined,
    );
  }

  @Get("timeseries")
  timeseries(@Query() q: TimeseriesQueryDto): Promise<TelemetryTimeseriesResponse> {
    return this.telemetry.timeseries(
      q.eventName,
      (q.range ?? "7d") as TelemetryRange,
      q.groupBy ?? "none",
      q.appId as TelemetryAppId | undefined,
    );
  }

  @Get("top-events")
  topEvents(@Query() q: RangeQueryDto): Promise<TelemetryTopEventsResponse> {
    return this.telemetry.topEvents(
      (q.range ?? "7d") as TelemetryRange,
      q.appId as TelemetryAppId | undefined,
    );
  }

  @Get("funnel")
  funnel(@Query() q: FunnelQueryDto): Promise<TelemetryFunnelResponse> {
    const steps = q.steps
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 8);
    return this.telemetry.funnel(
      steps,
      (q.range ?? "7d") as TelemetryRange,
      q.appId as TelemetryAppId | undefined,
    );
  }

  @Get("api-health")
  apiHealth(@Query() q: RangeQueryDto): Promise<TelemetryApiHealthResponse> {
    return this.telemetry.apiHealth(
      (q.range ?? "7d") as TelemetryRange,
      q.appId as TelemetryAppId | undefined,
    );
  }

  @Get("errors")
  errors(@Query() q: RangeQueryDto): Promise<TelemetryErrorsResponse> {
    return this.telemetry.errors(
      (q.range ?? "7d") as TelemetryRange,
      q.appId as TelemetryAppId | undefined,
    );
  }
}
