// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FeedService } from './feed.service';
import { MinimaxJobService } from '../minimax/minimax-job.service';
import type { MinimaxJobCallback } from '../minimax/minimax-job.callbacks';
import type { MinimaxJobEntity } from '../minimax/minimax-job.entity';

@Injectable()
export class FeedMinimaxCallbacks implements OnModuleInit, MinimaxJobCallback {
  private readonly logger = new Logger(FeedMinimaxCallbacks.name);

  constructor(
    private readonly feed: FeedService,
    private readonly jobs: MinimaxJobService,
  ) {}

  onModuleInit() {
    this.jobs.registerCallback('channel_post', this);
  }

  async onCompleted(job: MinimaxJobEntity): Promise<void> {
    if (!job.targetId || !job.localUrl) {
      this.logger.warn(`channel_post completed without targetId/localUrl: ${job.id}`);
      return;
    }
    if (job.kind === 'video') {
      await this.feed.applyMinimaxVideoToChannelPost(job.targetId, {
        mediaUrl: job.localUrl,
        coverUrl: job.coverUrl ?? null,
        durationMs: job.localDurationMs ?? null,
      });
      return;
    }
    if (job.kind === 'music') {
      await this.feed.applyMinimaxAudioToChannelPost(job.targetId, {
        audioUrl: job.localUrl,
        posterUrl: job.coverUrl ?? null,
        durationMs: job.localDurationMs ?? null,
      });
    }
  }

  async onFailed(job: MinimaxJobEntity): Promise<void> {
    if (!job.targetId) return;
    await this.feed.deleteChannelDraftPost(job.targetId);
    this.logger.warn(
      `channel_post draft ${job.targetId} deleted after job ${job.id} failed`,
    );
  }
}

// i18n-ignore-end
