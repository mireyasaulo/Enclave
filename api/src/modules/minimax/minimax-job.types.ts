// i18n-ignore-start: provider adapter — internal types only.

export type MinimaxJobKind = 'video' | 'music';

export type MinimaxJobStatus =
  | 'pending'
  | 'submitted'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MinimaxJobTargetType = 'channel_post' | 'moment_post';

export interface MinimaxVideoJobInputPayload {
  kind: 'video';
  prompt: string;
  firstFrameImageUrl?: string;
  resolution?: '768P' | '1080P';
}

export interface MinimaxMusicJobInputPayload {
  kind: 'music';
  prompt?: string;
  lyrics?: string;
}

export type MinimaxJobInputPayload =
  | MinimaxVideoJobInputPayload
  | MinimaxMusicJobInputPayload;

// i18n-ignore-end
