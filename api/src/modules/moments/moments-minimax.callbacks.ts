// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MomentsService } from './moments.service';
import { MinimaxJobService } from '../minimax/minimax-job.service';
import type { MinimaxJobCallback } from '../minimax/minimax-job.callbacks';
import type { MinimaxJobEntity } from '../minimax/minimax-job.entity';
import type {
  MomentAudioAsset,
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
      const cover = await this.moments
        .tryRenderMinimaxMusicCover(job, '')
        .catch((err) => {
          this.logger.warn(
            `cover render exception job=${job.id}: ${(err as Error)?.message}`,
          );
          return null;
        });
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
      // 双发：视频号也落一条音乐贴（用户决策：两边都发）。
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

// i18n-ignore-end
