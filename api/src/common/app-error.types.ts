/**
 * Mirror of packages/contracts/src/errors.ts. Kept in-tree so the API can
 * import these types without a workspace path mapping (api/tsconfig.json does
 * not configure paths and api/package.json does not depend on @yinjie/contracts;
 * see api/src/modules/admin/wiki-sync.types.ts for the same pattern).
 *
 * Update both files when adding a new error code.
 */
export type KnownAppErrorCode =
  | 'LEGACY_ERROR'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_FAILED'
  | 'FARM_CHARACTER_REQUIRED'
  | 'FARM_INVALID_PLOT_INDEX'
  | 'FARM_UNKNOWN_CROP'
  | 'FARM_CHARACTER_NOT_PARTICIPATING'
  | 'FARM_CHARACTER_NOT_FOUND'
  | 'FARM_CHARACTER_NOT_VISIBLE'
  | 'FARM_LEVEL_TOO_LOW'
  | 'FARM_BUY_LEVEL_TOO_LOW'
  | 'FARM_INSUFFICIENT_COINS'
  | 'FARM_PLOT_NOT_FOUND'
  | 'FARM_PLOT_NOT_PLANTABLE'
  | 'FARM_PLOT_EMPTY'
  | 'FARM_CROP_NOT_RIPE'
  | 'FARM_NPC_OPERATION_NOT_OPEN'
  | 'FARM_QUANTITY_INVALID'
  | 'FARM_WAREHOUSE_INSUFFICIENT'
  | 'FARM_NPC_NO_FARM'
  | 'FARM_ALREADY_STOLEN'
  | 'FARM_ALREADY_WATERED'
  | 'FARM_NO_WEEDS'
  | 'FARM_NO_BUGS'
  | 'FARM_DAILY_STEAL_LIMIT';

export type AppErrorCode = KnownAppErrorCode | (string & {});

export type AppErrorParams = Record<string, string | number | boolean | null>;

export interface AppErrorBody {
  code: AppErrorCode;
  params?: AppErrorParams;
  legacyMessage?: string;
  statusCode?: number;
  message?: string | string[];
  error?: string;
  requestId?: string | null;
  meta?: unknown;
}
