// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const FEEDBACK_CATEGORIES = [
  "bug",
  "interaction",
  "performance",
  "content",
  "feature",
] as const;
const FEEDBACK_PRIORITIES = ["low", "medium", "high"] as const;
const FEEDBACK_SOURCES = ["desktop", "web", "mobile", "wechat"] as const;
const FEEDBACK_STATUSES = [
  "new",
  "in_progress",
  "resolved",
  "archived",
] as const;

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function trimNullableString({ value }: { value: unknown }) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseInteger({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : value;
}

export class SubmitCloudFeedbackDto {
  @Transform(trimString)
  @IsOptional()
  @IsIn(FEEDBACK_SOURCES, { message: "source 不合法。" })
  source?: (typeof FEEDBACK_SOURCES)[number];

  @Transform(trimString)
  @IsIn(FEEDBACK_CATEGORIES, { message: "category 不合法。" })
  category: (typeof FEEDBACK_CATEGORIES)[number];

  @Transform(trimString)
  @IsIn(FEEDBACK_PRIORITIES, { message: "priority 不合法。" })
  priority: (typeof FEEDBACK_PRIORITIES)[number];

  @Transform(trimString)
  @IsString({ message: "title 必须是字符串。" })
  @MinLength(1, { message: "title 不能为空。" })
  @MaxLength(200, { message: "title 不能超过 200 个字符。" })
  title: string;

  @Transform(trimString)
  @IsString({ message: "detail 必须是字符串。" })
  @MinLength(1, { message: "detail 不能为空。" })
  @MaxLength(8000, { message: "detail 不能超过 8000 个字符。" })
  detail: string;

  @Transform(trimString)
  @IsOptional()
  @IsString({ message: "reproduction 必须是字符串。" })
  @MaxLength(8000, { message: "reproduction 不能超过 8000 个字符。" })
  reproduction?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString({ message: "expected 必须是字符串。" })
  @MaxLength(8000, { message: "expected 不能超过 8000 个字符。" })
  expected?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString({ message: "diagnosticSummary 必须是字符串。" })
  @MaxLength(2000, { message: "diagnosticSummary 不能超过 2000 个字符。" })
  diagnosticSummary?: string;

  @IsOptional()
  @IsBoolean({ message: "includeSystemSnapshot 必须是布尔值。" })
  includeSystemSnapshot?: boolean;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "clientRecordId 必须是字符串。" })
  @MaxLength(120, { message: "clientRecordId 不能超过 120 个字符。" })
  clientRecordId?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "clientSubmittedAt 必须是字符串。" })
  @MaxLength(64, { message: "clientSubmittedAt 不能超过 64 个字符。" })
  clientSubmittedAt?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "appPlatform 必须是字符串。" })
  @MaxLength(60, { message: "appPlatform 不能超过 60 个字符。" })
  appPlatform?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "apiBaseUrl 必须是字符串。" })
  @MaxLength(500, { message: "apiBaseUrl 不能超过 500 个字符。" })
  apiBaseUrl?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "ownerName 必须是字符串。" })
  @MaxLength(120, { message: "ownerName 不能超过 120 个字符。" })
  ownerName?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "ownerSignature 必须是字符串。" })
  @MaxLength(500, { message: "ownerSignature 不能超过 500 个字符。" })
  ownerSignature?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "submitterPhone 必须是字符串。" })
  @MaxLength(40, { message: "submitterPhone 不能超过 40 个字符。" })
  submitterPhone?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "submitterEmail 必须是字符串。" })
  @MaxLength(254, { message: "submitterEmail 不能超过 254 个字符。" })
  submitterEmail?: string | null;
}

export class ListCloudFeedbacksDto {
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: "query 必须是字符串。" })
  @MaxLength(255, { message: "query 不能超过 255 个字符。" })
  query?: string;

  @Transform(trimString)
  @IsOptional()
  @IsIn(FEEDBACK_CATEGORIES, { message: "category 不合法。" })
  category?: (typeof FEEDBACK_CATEGORIES)[number];

  @Transform(trimString)
  @IsOptional()
  @IsIn(FEEDBACK_PRIORITIES, { message: "priority 不合法。" })
  priority?: (typeof FEEDBACK_PRIORITIES)[number];

  @Transform(trimString)
  @IsOptional()
  @IsIn(FEEDBACK_STATUSES, { message: "status 不合法。" })
  status?: (typeof FEEDBACK_STATUSES)[number];

  @Transform(trimString)
  @IsOptional()
  @IsIn(FEEDBACK_SOURCES, { message: "source 不合法。" })
  source?: (typeof FEEDBACK_SOURCES)[number];

  @Transform(parseInteger)
  @IsOptional()
  @IsInt({ message: "page 必须是整数。" })
  @Min(1, { message: "page 最小为 1。" })
  page?: number;

  @Transform(parseInteger)
  @IsOptional()
  @IsInt({ message: "pageSize 必须是整数。" })
  @Min(1, { message: "pageSize 最小为 1。" })
  @Max(100, { message: "pageSize 最大为 100。" })
  pageSize?: number;
}

export class UpdateCloudFeedbackStatusDto {
  @Transform(trimString)
  @IsIn(FEEDBACK_STATUSES, { message: "status 不合法。" })
  status: (typeof FEEDBACK_STATUSES)[number];

  @Transform(trimNullableString)
  @IsOptional()
  @IsString({ message: "handlerNote 必须是字符串。" })
  @MaxLength(2000, { message: "handlerNote 不能超过 2000 个字符。" })
  handlerNote?: string | null;
}

export const CLOUD_FEEDBACK_CATEGORIES = FEEDBACK_CATEGORIES;
export const CLOUD_FEEDBACK_PRIORITIES = FEEDBACK_PRIORITIES;
export const CLOUD_FEEDBACK_SOURCES = FEEDBACK_SOURCES;
export const CLOUD_FEEDBACK_STATUSES = FEEDBACK_STATUSES;
// i18n-ignore-end
