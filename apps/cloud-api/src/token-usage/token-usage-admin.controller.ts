import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  CloudTokenPricingCatalogResponse,
  CloudTokenPricingItem,
  CloudTokenUsageBudgetItem,
  CloudTokenUsageBudgetResponse,
  CloudTokenUsageOverviewResponse,
  CloudTokenUsageWorldListResponse,
  TokenUsageBreakdownResponse,
  TokenUsageTrendPoint,
} from "@yinjie/contracts";
import { AdminGuard } from "../auth/admin.guard";
import {
  CloudTokenUsageRangeQueryDto,
  CloudTokenUsageWorldsQueryDto,
  DeleteCloudTokenPricingQueryDto,
  UpdateCloudTokenUsageBudgetDto,
  UpsertCloudTokenPricingDto,
} from "./token-usage.dto";
import { TokenUsageService } from "./token-usage.service";

@Controller("admin/cloud/token-usage")
@UseGuards(AdminGuard)
export class TokenUsageAdminController {
  constructor(private readonly tokenUsage: TokenUsageService) {}

  @Get("overview")
  getOverview(
    @Query() query: CloudTokenUsageRangeQueryDto,
  ): Promise<CloudTokenUsageOverviewResponse> {
    return this.tokenUsage.getOverview({ from: query.from, to: query.to });
  }

  @Get("trends")
  getTrends(
    @Query() query: CloudTokenUsageRangeQueryDto,
  ): Promise<TokenUsageTrendPoint[]> {
    return this.tokenUsage.getTrends({ from: query.from, to: query.to });
  }

  @Get("worlds")
  listWorlds(
    @Query() query: CloudTokenUsageWorldsQueryDto,
  ): Promise<CloudTokenUsageWorldListResponse> {
    return this.tokenUsage.listWorlds({
      from: query.from,
      to: query.to,
      sort: query.sort,
      dir: query.dir,
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
    });
  }

  @Get("worlds/:worldId/breakdown")
  getWorldBreakdown(
    @Param("worldId") worldId: string,
    @Query() query: CloudTokenUsageRangeQueryDto,
  ): Promise<TokenUsageBreakdownResponse> {
    return this.tokenUsage.getWorldBreakdown(worldId, {
      from: query.from,
      to: query.to,
    });
  }

  @Get("worlds/:worldId/daily")
  getWorldDaily(
    @Param("worldId") worldId: string,
    @Query() query: CloudTokenUsageRangeQueryDto,
  ) {
    return this.tokenUsage.getWorldDaily(worldId, {
      from: query.from,
      to: query.to,
    });
  }

  @Get("budgets")
  getBudgets(): Promise<CloudTokenUsageBudgetResponse> {
    return this.tokenUsage.getBudgets();
  }

  @Put("budgets")
  upsertBudget(
    @Body() body: UpdateCloudTokenUsageBudgetDto,
  ): Promise<CloudTokenUsageBudgetItem> {
    return this.tokenUsage.upsertBudget({
      worldId: body.worldId,
      rule: body.rule,
    });
  }

  @Delete("budgets/:worldId")
  deleteBudget(@Param("worldId") worldId: string) {
    return this.tokenUsage.deleteBudget(worldId);
  }

  @Get("pricing")
  getPricing(): Promise<CloudTokenPricingCatalogResponse> {
    return this.tokenUsage.getPricingCatalog();
  }

  @Post("pricing")
  upsertPricing(
    @Body() body: UpsertCloudTokenPricingDto,
  ): Promise<CloudTokenPricingItem> {
    return this.tokenUsage.upsertPricing(body);
  }

  @Delete("pricing")
  deletePricing(@Query() query: DeleteCloudTokenPricingQueryDto) {
    return this.tokenUsage.deletePricing(query.currency, query.model);
  }
}
