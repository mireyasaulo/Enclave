import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

const TELEMETRY_APP_IDS = ["app", "site", "wiki"] as const;
const TELEMETRY_EVENT_TYPES = [
  "pv",
  "business",
  "api_call",
  "error",
  "performance",
  "session",
] as const;

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function trimNullableString({ value }: { value: unknown }) {
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class TelemetryEventInputDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  eventName: string;

  @Transform(trimString)
  @IsIn(TELEMETRY_EVENT_TYPES, { message: "eventType 不合法。" })
  eventType: (typeof TELEMETRY_EVENT_TYPES)[number];

  @IsISO8601()
  occurredAt: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sessionId: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  anonId: string;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  userId?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pagePath?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string | null;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  release?: string | null;

  @IsOptional()
  @IsObject()
  props?: Record<string, unknown> | null;
}

export class TelemetryBatchDto {
  @Transform(trimString)
  @IsIn(TELEMETRY_APP_IDS, { message: "appId 不合法。" })
  appId: (typeof TELEMETRY_APP_IDS)[number];

  @IsArray()
  @ArrayMinSize(1, { message: "events 至少包含 1 条。" })
  @ArrayMaxSize(100, { message: "events 单批最多 100 条。" })
  @ValidateNested({ each: true })
  @Type(() => TelemetryEventInputDto)
  events: TelemetryEventInputDto[];
}

export const TELEMETRY_APP_ID_VALUES = TELEMETRY_APP_IDS;
export const TELEMETRY_EVENT_TYPE_VALUES = TELEMETRY_EVENT_TYPES;
