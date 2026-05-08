// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CloudTokenUsageRangeQueryDto {
  @Transform(trimString)
  @IsOptional()
  @Matches(DATE_RE, { message: "from must be YYYY-MM-DD." })
  from?: string;

  @Transform(trimString)
  @IsOptional()
  @Matches(DATE_RE, { message: "to must be YYYY-MM-DD." })
  to?: string;
}

export class CloudTokenUsageWorldsQueryDto extends CloudTokenUsageRangeQueryDto {
  @Transform(trimString)
  @IsOptional()
  @IsIn(["tokens", "cost", "requests", "failureRate"])
  sort?: "tokens" | "cost" | "requests" | "failureRate";

  @Transform(trimString)
  @IsOptional()
  @IsIn(["asc", "desc"])
  dir?: "asc" | "desc";

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  search?: string;
}

class CloudTokenUsageOverviewBodyDto {
  @IsIn(["CNY", "USD"])
  currency: "CNY" | "USD";

  @Type(() => Number)
  @IsNumber()
  promptTokens: number;

  @Type(() => Number)
  @IsNumber()
  completionTokens: number;

  @Type(() => Number)
  @IsNumber()
  totalTokens: number;

  @Type(() => Number)
  @IsNumber()
  estimatedCost: number;

  @Type(() => Number)
  @IsNumber()
  requestCount: number;

  @Type(() => Number)
  @IsNumber()
  successCount: number;

  @Type(() => Number)
  @IsNumber()
  failedCount: number;

  @Type(() => Number)
  @IsNumber()
  activeCharacterCount: number;
}

class CloudTokenUsageBreakdownPushDto {
  @IsIn(["character", "conversation", "scene", "model", "billingSource"])
  dimension:
    | "character"
    | "conversation"
    | "scene"
    | "model"
    | "billingSource";

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  key: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  label?: string | null;

  @Type(() => Number)
  @IsNumber()
  promptTokens: number;

  @Type(() => Number)
  @IsNumber()
  completionTokens: number;

  @Type(() => Number)
  @IsNumber()
  totalTokens: number;

  @Type(() => Number)
  @IsNumber()
  estimatedCost: number;

  @Type(() => Number)
  @IsNumber()
  requestCount: number;

  @Type(() => Number)
  @IsNumber()
  successCount: number;

  @Type(() => Number)
  @IsNumber()
  failedCount: number;
}

export class CloudTokenUsageDailyPushDto {
  @Transform(trimString)
  @IsString()
  worldId: string;

  @Transform(trimString)
  @Matches(DATE_RE, { message: "bucketDate must be YYYY-MM-DD." })
  bucketDate: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  callbackToken?: string | null;

  @Type(() => CloudTokenUsageOverviewBodyDto)
  @ValidateNested()
  overview: CloudTokenUsageOverviewBodyDto;

  @Type(() => CloudTokenUsageBreakdownPushDto)
  @IsArray()
  @ValidateNested({ each: true })
  breakdowns: CloudTokenUsageBreakdownPushDto[];
}

class CloudTokenUsageBudgetRuleDto {
  @Type(() => Boolean)
  @IsBoolean()
  enabled: boolean;

  @IsIn(["tokens", "cost"])
  metric: "tokens" | "cost";

  @IsOptional()
  @IsIn(["monitor", "downgrade", "block"])
  enforcement?: "monitor" | "downgrade" | "block";

  @Transform(trimString)
  @IsOptional()
  @IsString()
  downgradeModel?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyLimit?: number | null;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  warningRatio?: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class UpdateCloudTokenUsageBudgetDto {
  @Transform(({ value }) =>
    value === null || value === ""
      ? null
      : typeof value === "string"
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  worldId: string | null;

  @Type(() => CloudTokenUsageBudgetRuleDto)
  @ValidateNested()
  rule: CloudTokenUsageBudgetRuleDto;
}

export class UpsertCloudTokenPricingDto {
  @IsIn(["CNY", "USD"])
  currency: "CNY" | "USD";

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  model: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  inputPer1kTokens: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outputPer1kTokens: number;

  @Type(() => Boolean)
  @IsBoolean()
  enabled: boolean;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class DeleteCloudTokenPricingQueryDto {
  @IsIn(["CNY", "USD"])
  currency: "CNY" | "USD";

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  model: string;
}

// i18n-ignore-end
