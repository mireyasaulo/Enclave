import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../../common/app-error.exception';
import { resolveDataPath } from '../../../database/database-path';

export type UploadedWikiAvatarFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size: number;
};

export type WikiAvatarUploadResult = {
  url: string;
  fileName: string;
  mimeType: string;
};

// 头像图片单文件上限 4 MB —— 写真级别足够，避免 wiki child 内存被恶意大文件打爆。
export const WIKI_AVATAR_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

@Injectable()
export class WikiAvatarService {
  async saveUploadedAvatar(
    file: UploadedWikiAvatarFile,
  ): Promise<WikiAvatarUploadResult> {
    if (!file.mimetype.startsWith('image/')) {
      throw new AppError('WIKI_AVATAR_IMAGE_ONLY', {
        status: HttpStatus.BAD_REQUEST,
        legacyMessage: '头像只支持图片文件（png/jpg/webp/gif）。',
      });
    }

    const originalName = sanitizeFileName(file.originalname ?? 'avatar');
    const extension =
      path.extname(originalName) || guessImageExtension(file.mimetype);
    const baseName = path.basename(originalName, extension) || 'avatar';
    const storedFileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeFileName(baseName)}${extension}`;
    const storageDir = this.resolveStorageDir();

    await mkdir(storageDir, { recursive: true });
    await writeFile(path.join(storageDir, storedFileName), file.buffer);

    return {
      url: `/api/wiki/avatars/${storedFileName}`,
      fileName: storedFileName,
      mimeType: file.mimetype,
    };
  }

  resolveReadablePath(fileName: string) {
    const normalized = this.normalizeFileName(fileName);
    const candidate = path.join(this.resolveStorageDir(), normalized);
    if (!existsSync(candidate)) {
      throw new AppError('WIKI_AVATAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: 'Avatar not found',
      });
    }
    return candidate;
  }

  normalizeFileName(fileName: string) {
    const normalized = path.basename(fileName).trim();
    if (!normalized) {
      throw new AppError('WIKI_AVATAR_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: 'Avatar not found',
      });
    }
    return normalized;
  }

  private resolveStorageDir() {
    return resolveDataPath('wiki-avatars');
  }
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function guessImageExtension(mimeType: string) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}
