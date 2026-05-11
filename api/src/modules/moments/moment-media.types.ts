export type MomentContentType =
  | 'text'
  | 'image_album'
  | 'video'
  | 'live_photo'
  | 'audio_card';

export interface MomentLivePhotoMetadata {
  enabled: boolean;
  motionUrl?: string;
}

export interface MomentImageAsset {
  id: string;
  kind: 'image';
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  livePhoto?: MomentLivePhotoMetadata;
}

export interface MomentVideoAsset {
  id: string;
  kind: 'video';
  url: string;
  posterUrl?: string;
  mimeType: string;
  fileName: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface MomentAudioAsset {
  id: string;
  kind: 'audio';
  url: string;
  posterUrl?: string;
  mimeType: string;
  fileName: string;
  size: number;
  durationMs?: number;
  title?: string;
  lyrics?: string;
}

export type MomentMediaAsset =
  | MomentImageAsset
  | MomentVideoAsset
  | MomentAudioAsset;

export type MomentVisibility = 'public' | 'friends' | 'private';

export type CreateMomentInput = {
  text?: string;
  location?: string;
  contentType?: MomentContentType;
  media?: MomentMediaAsset[];
  visibility?: MomentVisibility;
};
