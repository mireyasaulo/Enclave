import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  CloudFeedbackSummary,
  ListCloudFeedbacksResponse,
} from "@yinjie/contracts";
import { AdminGuard, type AdminRequest } from "../auth/admin.guard";
import {
  ListCloudFeedbacksDto,
  UpdateCloudFeedbackStatusDto,
} from "./feedback.dto";
import { FeedbackService } from "./feedback.service";

@Controller("admin/cloud/feedback")
@UseGuards(AdminGuard)
export class FeedbackAdminController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(
    @Query() query: ListCloudFeedbacksDto,
  ): Promise<ListCloudFeedbacksResponse> {
    return this.feedback.list(query);
  }

  @Get(":id")
  get(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<CloudFeedbackSummary> {
    return this.feedback.getById(id);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCloudFeedbackStatusDto,
    @Req() request: AdminRequest,
  ): Promise<CloudFeedbackSummary> {
    const actor = request.cloudAdminSessionId
      ? `cloud-admin:${request.cloudAdminSessionId}`
      : "cloud-admin:secret";
    return this.feedback.updateStatus(id, dto, actor);
  }
}
