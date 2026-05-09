// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { resolvePrimaryMomentMediaStorageDir } from '../moments/moment-media.storage';

export interface PersistedAsset {
  fileName: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class MinimaxAssetStorage {
  private readonly logger = new Logger(MinimaxAssetStorage.name);
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const raw = (
      config.get<string>('PUBLIC_API_BASE_URL') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
    this.publicBaseUrl = raw;
  }

  async persist(input: {
    buffer: Buffer;
    mimeType: string;
    kind: 'video' | 'music' | 'image';
    suffix?: string;
  }): Promise<PersistedAsset> {
    const dir = resolvePrimaryMomentMediaStorageDir();
    await mkdir(dir, { recursive: true });
    const ext = pickExtension(input.mimeType, input.kind);
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-minimax-${input.kind}${input.suffix ?? ''}.${ext}`;
    const target = path.join(dir, fileName);
    await writeFile(target, input.buffer);
    return {
      fileName,
      publicUrl: `${this.publicBaseUrl}/api/moments/media/${fileName}`,
      size: input.buffer.length,
      mimeType: input.mimeType,
    };
  }
}

function pickExtension(mimeType: string, kind: 'video' | 'music' | 'image'): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('mpeg') && kind === 'music') return 'mp3';
  if (lower.includes('audio/mp3')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (kind === 'video') return 'mp4';
  if (kind === 'music') return 'mp3';
  return 'bin';
}

// i18n-ignore-end
