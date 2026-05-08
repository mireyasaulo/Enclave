import { AppError } from '../../common/app-error.exception';
import type { ChatBackgroundAsset } from './chat-background.types';

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export function normalizeChatBackgroundAsset(
  input: ChatBackgroundAsset,
): ChatBackgroundAsset {
  const assetId = sanitizeBackgroundAssetId(input.assetId);
  const url = input.url?.trim();

  if (!assetId || !url) {
    throw new AppError('CHAT_BACKGROUND_NOT_SELECTED', {
      legacyMessage: '请先选择一张聊天背景。',
    });
  }

  return {
    source: input.source === 'upload' ? 'upload' : 'preset',
    assetId,
    url,
    thumbnailUrl: normalizeOptionalText(input.thumbnailUrl) ?? url,
    label: normalizeOptionalText(input.label),
    width: normalizeOptionalDimension(input.width),
    height: normalizeOptionalDimension(input.height),
  };
}

export function parseChatBackgroundAsset(
  raw: string | null | undefined,
): ChatBackgroundAsset | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeChatBackgroundAsset(JSON.parse(raw) as ChatBackgroundAsset);
  } catch {
    return null;
  }
}

function sanitizeBackgroundAssetId(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalDimension(value?: number) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}
// i18n-ignore-end
