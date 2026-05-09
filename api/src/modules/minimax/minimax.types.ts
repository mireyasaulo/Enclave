// i18n-ignore-start: provider adapter — error/log strings only.

export type MinimaxVideoModel =
  | 'MiniMax-Hailuo-2.3-Fast'
  | 'MiniMax-Hailuo-2.3';

export type MinimaxMusicModel = 'music-2.6' | 'music-2.5';

export type MinimaxImageModel = 'image-01';

export interface MinimaxBaseResp {
  status_code: number;
  status_msg?: string;
}

export interface MinimaxVideoSubmitInput {
  model: MinimaxVideoModel;
  prompt: string;
  firstFrameImageUrl?: string;
  duration?: 6;
  resolution?: '768P' | '1080P';
}

export interface MinimaxVideoSubmitResult {
  taskId: string;
}

export type MinimaxVideoStatus =
  | 'Preparing'
  | 'Queueing'
  | 'Processing'
  | 'Success'
  | 'Fail'
  | 'Unknown';

export interface MinimaxVideoQueryResult {
  status: MinimaxVideoStatus;
  fileId?: string;
  failReason?: string;
}

export interface MinimaxFileRetrieveResult {
  downloadUrl: string;
  fileName?: string;
  size?: number;
}

export interface MinimaxImageInput {
  model: MinimaxImageModel;
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3';
  n?: number;
}

export interface MinimaxImageResult {
  buffer: Buffer;
  mimeType: string;
}

export interface MinimaxMusicInput {
  model: MinimaxMusicModel;
  prompt?: string;
  lyrics?: string;
  referVoice?: string;
  sampleRate?: 32000 | 44100;
  bitrate?: 128000 | 256000;
  format?: 'mp3';
}

export type MinimaxMusicResult =
  | {
      kind: 'inline';
      buffer: Buffer;
      mimeType: 'audio/mpeg';
      durationMs?: number;
    }
  | { kind: 'task'; taskId: string };

export interface MinimaxLyricsInput {
  prompt: string;
}

export interface MinimaxLyricsResult {
  lyrics: string;
}

export interface MinimaxBinary {
  buffer: Buffer;
  mimeType: string;
}

export interface MinimaxClientErrorContext {
  endpoint: string;
  status?: number;
  statusCode?: number;
  retriable: boolean;
  message: string;
}

// i18n-ignore-end
