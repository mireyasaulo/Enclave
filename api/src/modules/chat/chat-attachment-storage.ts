import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  resolveApiPath,
  resolveDataPath,
} from '../../database/database-path';

export function resolvePrimaryChatAttachmentStorageDir() {
  return resolveDataPath('chat-attachments');
}

export function resolveLegacyChatAttachmentStorageDir() {
  return resolveApiPath('storage', 'chat-attachments');
}

export function resolveReadableChatAttachmentPath(fileName: string) {
  const candidatePaths = [
    path.join(resolvePrimaryChatAttachmentStorageDir(), fileName),
    path.join(resolveLegacyChatAttachmentStorageDir(), fileName),
  ];

  return (
    candidatePaths.find((candidatePath) => existsSync(candidatePath)) ??
    candidatePaths[0]
  );
}
