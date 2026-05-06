import { Body, Controller, Post, Req } from "@nestjs/common";
import type { SubmitCloudFeedbackResponse } from "@yinjie/contracts";
import type { Request } from "express";
import { SubmitCloudFeedbackDto } from "./feedback.dto";
import { FeedbackService } from "./feedback.service";

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
  if (typeof ua === "string" && ua.trim()) {
    return ua.trim().slice(0, 500);
  }
  return null;
}

@Controller("cloud/feedback")
export class FeedbackPublicController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  async submit(
    @Body() dto: SubmitCloudFeedbackDto,
    @Req() request: Request,
  ): Promise<SubmitCloudFeedbackResponse> {
    const summary = await this.feedback.submit(dto, {
      submitterIp: extractIp(request),
      submitterUserAgent: extractUserAgent(request),
    });
    return { success: true, feedback: summary };
  }
}
