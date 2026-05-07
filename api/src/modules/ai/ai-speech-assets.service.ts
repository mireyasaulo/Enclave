import { randomUUID } from 'crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  resolveApiPath,
  resolveDataPath,
} from '../../database/database-path';

@Injectable()
export class AiSpeechAssetsService {
  async saveGeneratedSpeech(
    buffer: Buffer,
    options: {
      mimeType: string;
      fileExtension: string;
      baseName?: string;
    },
  ) {
    const storageDir = this.resolvePrimaryStorageDir();
    const safeBaseName = sanitizeSpeechAssetBaseName(options.baseName);
    const extension = normalizeSpeechExtension(options.fileExtension);
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBaseName}.${extension}`;

    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, fileName), buffer);

    return {
      fileName,
      audioUrl: `${this.resolvePublicApiBaseUrl()}/api/ai/speech/${fileName}`,
      mimeType: options.mimeType,
    };
  }

  getStorageDir() {
    return this.resolvePrimaryStorageDir();
  }

  resolveReadablePath(fileName: string) {
    const normalized = this.normalizeFileName(fileName);
    const candidates = [
      path.join(this.resolvePrimaryStorageDir(), normalized),
      path.join(this.resolveLegacyStorageDir(), normalized),
    ];
    return candidates.find((candidatePath) => existsSync(candidatePath)) ?? candidates[0];
  }

  normalizeFileName(fileName: string) {
    const normalized = path.basename(fileName).trim();
    if (!normalized) {
      throw new NotFoundException('Speech asset not found');
    }

    return normalized;
  }

  private resolvePrimaryStorageDir() {
    return resolveDataPath('ai-speech');
  }

  private resolveLegacyStorageDir() {
    return resolveApiPath('storage', 'ai-speech');
  }

  private resolvePublicApiBaseUrl() {
    return (
      process.env.PUBLIC_API_BASE_URL?.trim() ||
      `http://localhost:${process.env.PORT ?? '3000'}`
    );
  }
}

function sanitizeSpeechAssetBaseName(value?: string) {
  const normalized = (value ?? 'speech')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'speech';
}

function normalizeSpeechExtension(value: string) {
  const normalized = value.trim().replace(/^\./, '').toLowerCase();
  return normalized || 'mp3';
}
