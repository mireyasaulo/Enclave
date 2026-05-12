// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MomentsService } from './moments.service';
import { MinimaxJobService } from '../minimax/minimax-job.service';
import type { MinimaxJobCallback } from '../minimax/minimax-job.callbacks';
import type { MinimaxJobEntity } from '../minimax/minimax-job.entity';
import type {
  MomentAudioAsset,
  MomentImageAsset,
  MomentVideoAsset,
} from './moment-media.types';
import { FeedService } from '../feed/feed.service';

@Injectable()
export class MomentsMinimaxCallbacks
  implements OnModuleInit, MinimaxJobCallback
{
  private readonly logger = new Logger(MomentsMinimaxCallbacks.name);

  constructor(
    private readonly moments: MomentsService,
    private readonly feed: FeedService,
    private readonly jobs: MinimaxJobService,
  ) {}

  onModuleInit() {
    this.jobs.registerCallback('moment_post', this);
  }

  async onCompleted(job: MinimaxJobEntity): Promise<void> {
    if (!job.targetId || !job.localUrl) {
      this.logger.warn(`moment_post completed without targetId/localUrl: ${job.id}`);
      return;
    }

    if (job.kind === 'music') {
      const seedText = extractMusicSeedText(job.inputPayload);
      // 封面（朋友圈 audio_card posterUrl 必备，1:1）+ 视频号配图（9:16 多张）并发。
      const [cover, pictorials] = await Promise.all([
        this.moments.tryRenderMinimaxMusicCover(job, seedText).catch((err) => {
          this.logger.warn(
            `cover render exception job=${job.id}: ${(err as Error)?.message}`,
          );
          return null;
        }),
        this.moments
          .tryRenderMinimaxMusicPictorials(job, seedText, 3)
          .catch((err) => {
            this.logger.warn(
              `pictorials render exception job=${job.id}: ${(err as Error)?.message}`,
            );
            return [];
          }),
      ]);
      const audio: MomentAudioAsset = {
        id: job.localFileName ?? job.id,
        kind: 'audio',
        url: job.localUrl,
        posterUrl: cover?.url,
        mimeType: job.localMimeType ?? 'audio/mpeg',
        fileName: job.localFileName ?? `${job.id}.mp3`,
        size: job.localSize ?? 0,
        durationMs: job.localDurationMs ?? undefined,
        title: `${job.characterName}·音乐`,
      };
      await this.moments.applyMinimaxMusicToPost(job.targetId, audio);
      // 双发：视频号也落一条音乐贴（用户决策：两边都发），附带多张 9:16 配图做抖音风图文视频。
      const images: MomentImageAsset[] = [];
      if (cover) {
        images.push({
          id: cover.fileName,
          kind: 'image',
          url: cover.url,
          mimeType: 'image/jpeg',
          fileName: cover.fileName,
          size: 0,
        });
      }
      for (const p of pictorials) {
        images.push({
          id: p.fileName,
          kind: 'image',
          url: p.url,
          mimeType: p.mimeType,
          fileName: p.fileName,
          size: p.size,
        });
      }
      try {
        await this.feed.createChannelAudioPost({
          authorId: job.characterId,
          authorName: job.characterName,
          authorAvatar: job.characterAvatar ?? '',
          audioUrl: job.localUrl,
          posterUrl: cover?.url ?? null,
          durationMs: job.localDurationMs ?? null,
          text: audio.title ?? '',
          title: audio.title,
          images,
        });
      } catch (err) {
        this.logger.warn(
          `channel dual-publish failed for music job ${job.id}: ${(err as Error)?.message}`,
        );
      }
      return;
    }

    if (job.kind === 'video') {
      const video: MomentVideoAsset = {
        id: job.localFileName ?? job.id,
        kind: 'video',
        url: job.localUrl,
        posterUrl: job.coverUrl ?? undefined,
        mimeType: job.localMimeType ?? 'video/mp4',
        fileName: job.localFileName ?? `${job.id}.mp4`,
        size: job.localSize ?? 0,
        durationMs: job.localDurationMs ?? undefined,
      };
      await this.moments.applyMinimaxVideoToPost(job.targetId, video);
    }
  }

  async onFailed(job: MinimaxJobEntity): Promise<void> {
    if (!job.targetId) return;
    await this.moments.deleteMinimaxPlaceholderPost(job.targetId);
    this.logger.warn(
      `moment placeholder ${job.targetId} deleted after job ${job.id} failed`,
    );
  }
}

// 从 minimax music job 的 inputPayload 抽取 prompt / lyrics 作为生图 seedText。
// 解析失败或缺字段都退回空串——上游 prompt 模板对空串有兜底。
function extractMusicSeedText(inputPayload: string | null | undefined): string {
  if (!inputPayload) return '';
  try {
    const parsed = JSON.parse(inputPayload) as {
      prompt?: string;
      lyrics?: string;
    };
    const parts: string[] = [];
    if (parsed.prompt) parts.push(parsed.prompt);
    if (parsed.lyrics) parts.push(parsed.lyrics);
    return parts.join(' ').slice(0, 400);
  } catch {
    return '';
  }
}

// i18n-ignore-end
