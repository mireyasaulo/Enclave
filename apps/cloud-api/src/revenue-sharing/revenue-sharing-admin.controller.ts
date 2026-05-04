import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type {
  RevenueEventListResponse,
  RevenueLedgerListResponse,
  RevenuePayeeSummary,
  RevenueSettlementBatchSummary,
  RevenueSettlementPreviewResponse,
  RevenueSharingPolicySummary,
  UpdateRevenueSharingPolicyRequest,
} from "@yinjie/contracts";
import { AdminGuard, type AdminRequest } from "../auth/admin.guard";
import {
  ListRevenueEventsQueryDto,
  ListRevenueLedgerQueryDto,
  RevenueSettlementPreviewDto,
  UpdateRevenueSharingPolicyDto,
  UpsertRevenuePayeeDto,
} from "../http-dto/cloud-api.dto";
import { RevenueSharingService } from "./revenue-sharing.service";

@Controller("admin/cloud/revenue-sharing")
@UseGuards(AdminGuard)
export class RevenueSharingAdminController {
  constructor(private readonly revenueSharing: RevenueSharingService) {}

  @Get("policy")
  getPolicy(): Promise<RevenueSharingPolicySummary> {
    return this.revenueSharing.getPolicy();
  }

  @Patch("policy")
  updatePolicy(
    @Body() body: UpdateRevenueSharingPolicyDto,
    @Req() request: AdminRequest,
  ): Promise<RevenueSharingPolicySummary> {
    return this.revenueSharing.updatePolicy(
      body as UpdateRevenueSharingPolicyRequest,
      this.resolveActor(request),
    );
  }

  @Get("payees")
  listPayees(): Promise<RevenuePayeeSummary[]> {
    return this.revenueSharing.listPayees();
  }

  @Post("payees")
  upsertPayee(@Body() body: UpsertRevenuePayeeDto): Promise<RevenuePayeeSummary> {
    return this.revenueSharing.upsertPayee(body);
  }

  @Get("events")
  listEvents(@Query() query: ListRevenueEventsQueryDto): Promise<RevenueEventListResponse> {
    return this.revenueSharing.listEvents({
      worldId: query.worldId,
      characterId: query.characterId,
    });
  }

  @Get("ledger")
  listLedger(@Query() query: ListRevenueLedgerQueryDto): Promise<RevenueLedgerListResponse> {
    return this.revenueSharing.listLedger({
      worldId: query.worldId,
      characterId: query.characterId,
      payeeId: query.payeeId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post("settlements/preview")
  previewSettlement(
    @Body() body: RevenueSettlementPreviewDto,
  ): Promise<RevenueSettlementPreviewResponse> {
    return this.revenueSharing.previewSettlement(body);
  }

  @Post("settlements/generate")
  generateSettlement(
    @Body() body: RevenueSettlementPreviewDto,
    @Req() request: AdminRequest,
  ): Promise<RevenueSettlementBatchSummary> {
    return this.revenueSharing.generateSettlement(
      body,
      this.resolveActor(request),
    );
  }

  private resolveActor(request: AdminRequest) {
    return request.cloudAdminSessionId
      ? `cloud-admin:${request.cloudAdminSessionId}`
      : "cloud-admin:secret";
  }
}
