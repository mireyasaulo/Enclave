import { Body, Controller, Post, Req } from "@nestjs/common";
import type { TelemetryBatchResponse } from "@yinjie/contracts";
import type { Request } from "express";
import { TelemetryBatchDto } from "./telemetry.dto";
import { TelemetryService } from "./telemetry.service";

function extractIp(request: Request): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0].split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return request.ip ?? null;
}

function extractUserAgent(request: Request): string | null {
  const ua = request.headers["user-agent"];
  return typeof ua === "string" && ua.trim() ? ua.trim() : null;
}

@Controller("telemetry")
export class TelemetryPublicController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post("events/batch")
  async ingest(
    @Body() dto: TelemetryBatchDto,
    @Req() request: Request,
  ): Promise<TelemetryBatchResponse> {
    return this.telemetry.ingestBatch(dto.appId, dto.events, {
      ip: extractIp(request),
      userAgent: extractUserAgent(request),
    });
  }
}
