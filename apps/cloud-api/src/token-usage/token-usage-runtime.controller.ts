import { Body, Controller, Get, Headers, Post, Query } from "@nestjs/common";
import { CloudTokenUsageDailyPushDto } from "./token-usage.dto";
import { TokenUsageService } from "./token-usage.service";

@Controller("internal/cloud/token-usage")
export class TokenUsageRuntimeController {
  constructor(private readonly tokenUsage: TokenUsageService) {}

  @Post("daily")
  pushDaily(
    @Headers("x-world-callback-token") callbackToken: string | undefined,
    @Body() body: CloudTokenUsageDailyPushDto,
  ) {
    return this.tokenUsage.ingestDaily(body, callbackToken);
  }

  @Get("config")
  getWorldConfig(
    @Headers("x-world-callback-token") callbackToken: string | undefined,
    @Query("worldId") worldId: string,
  ) {
    return this.tokenUsage.getWorldConfigSnapshot(worldId, callbackToken);
  }
}
