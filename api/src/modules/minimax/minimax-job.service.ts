// i18n-ignore-start: provider adapter — log strings only.
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { MinimaxJobEntity } from './minimax-job.entity';
import {
  type MinimaxJobInputPayload,
  type MinimaxJobKind,
  type MinimaxJobStatus,
  type MinimaxJobTargetType,
  type MinimaxVideoJobInputPayload,
  type MinimaxMusicJobInputPayload,
} from './minimax-job.types';
import { MinimaxClient, MinimaxClientError } from './minimax.client';
import { MinimaxAssetStorage } from './minimax-asset.storage';
import { MinimaxQuotaService } from './minimax-quota.service';
import type { MinimaxJobCallback } from './minimax-job.callbacks';
import type { MinimaxVideoModel, MinimaxMusicModel } from './minimax.types';

const VIDEO_POLL_INTERVAL_MS = 30_000;
const VIDEO_MAX_ATTEMPTS = 25; // ~12 minutes at 30s per
const MUSIC_MAX_ATTEMPTS = 8;
const STALE_VIDEO_AFTER_MS = 15 * 60 * 1000;
const STALE_MUSIC_AFTER_MS = 90 * 1000;

interface EnqueueVideoArgs {
  model: MinimaxVideoModel;
  prompt: string;
  firstFrameImageUrl?: string;
  resolution?: '768P' | '1080P';
  characterId: string;
  characterName: string;
  characterAvatar?: string | null;
  targetType: MinimaxJobTargetType;
}

interface EnqueueMusicArgs {
  model: MinimaxMusicModel;
  prompt?: string;
  lyrics?: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string | null;
  targetType: MinimaxJobTargetType;
}

@Injectable()
export class MinimaxJobService {
  private readonly logger = new Logger(MinimaxJobService.name);
  private readonly callbacks = new Map<MinimaxJobTargetType, MinimaxJobCallback>();
  private processingVideo = false;
  private processingMusic = false;

  constructor(
    @InjectRepository(MinimaxJobEntity)
    private readonly repo: Repository<MinimaxJobEntity>,
    private readonly client: MinimaxClient,
    private readonly storage: MinimaxAssetStorage,
    private readonly quota: MinimaxQuotaService,
  ) {}

  registerCallback(targetType: MinimaxJobTargetType, cb: MinimaxJobCallback) {
    this.callbacks.set(targetType, cb);
    this.logger.log(`registered callback for ${targetType}`);
  }

  async enqueueVideoJob(args: EnqueueVideoArgs): Promise<MinimaxJobEntity | null> {
    if (!this.client.isConfigured()) {
      this.logger.warn('enqueueVideoJob skipped: MINIMAX_API_KEY missing');
      return null;
    }
    const reserved = await this.quota.tryReserve(args.model);
    if (!reserved) {
      this.logger.warn(`enqueueVideoJob skipped: ${args.model} quota exhausted`);
      return null;
    }
    const payload: MinimaxVideoJobInputPayload = {
      kind: 'video',
      prompt: args.prompt,
      firstFrameImageUrl: args.firstFrameImageUrl,
      resolution: args.resolution,
    };
    const job = this.repo.create({
      kind: 'video',
      status: 'pending',
      inputPayload: JSON.stringify(payload),
      model: args.model,
      targetType: args.targetType,
      targetId: null,
      characterId: args.characterId,
      characterName: args.characterName,
      characterAvatar: args.characterAvatar ?? null,
      executeAfter: new Date(),
      attemptCount: 0,
    });
    const saved = await this.repo.save(job);
    setTimeout(() => void this.processVideoJobs(), 0);
    return saved;
  }

  async enqueueMusicJob(args: EnqueueMusicArgs): Promise<MinimaxJobEntity | null> {
    if (!this.client.isConfigured()) {
      this.logger.warn('enqueueMusicJob skipped: MINIMAX_API_KEY missing');
      return null;
    }
    const reserved = await this.quota.tryReserve(args.model);
    if (!reserved) {
      this.logger.warn(`enqueueMusicJob skipped: ${args.model} quota exhausted`);
      return null;
    }
    const payload: MinimaxMusicJobInputPayload = {
      kind: 'music',
      prompt: args.prompt,
      lyrics: args.lyrics,
    };
    const job = this.repo.create({
      kind: 'music',
      status: 'pending',
      inputPayload: JSON.stringify(payload),
      model: args.model,
      targetType: args.targetType,
      targetId: null,
      characterId: args.characterId,
      characterName: args.characterName,
      characterAvatar: args.characterAvatar ?? null,
      executeAfter: new Date(),
      attemptCount: 0,
    });
    const saved = await this.repo.save(job);
    setTimeout(() => void this.processMusicJobs(), 0);
    return saved;
  }

  async attachTarget(jobId: string, targetId: string): Promise<void> {
    await this.repo.update(jobId, { targetId });
  }

  async getJob(jobId: string): Promise<MinimaxJobEntity | null> {
    return this.repo.findOne({ where: { id: jobId } });
  }

  @Cron('*/30 * * * * *')
  async processVideoJobsCron(): Promise<void> {
    await this.processVideoJobs();
  }

  @Cron('*/5 * * * * *')
  async processMusicJobsCron(): Promise<void> {
    await this.processMusicJobs();
  }

  async processVideoJobs(): Promise<void> {
    if (this.processingVideo) return;
    this.processingVideo = true;
    try {
      await this.requeueStaleJobs('video', STALE_VIDEO_AFTER_MS);
      const now = new Date();
      const jobs = await this.repo.find({
        where: [
          { kind: 'video', status: 'pending', executeAfter: LessThan(now) },
          { kind: 'video', status: 'submitted', executeAfter: LessThan(now) },
          { kind: 'video', status: 'downloading', executeAfter: LessThan(now) },
        ],
        order: { executeAfter: 'ASC' },
        take: 6,
      });
      for (const job of jobs) {
        try {
          await this.advanceVideoJob(job);
        } catch (error) {
          this.logger.error(
            `video job ${job.id} unexpected error: ${(error as Error)?.message}`,
          );
        }
      }
    } finally {
      this.processingVideo = false;
    }
  }

  async processMusicJobs(): Promise<void> {
    if (this.processingMusic) return;
    this.processingMusic = true;
    try {
      await this.requeueStaleJobs('music', STALE_MUSIC_AFTER_MS);
      const now = new Date();
      const jobs = await this.repo.find({
        where: [
          { kind: 'music', status: 'pending', executeAfter: LessThan(now) },
          { kind: 'music', status: 'submitted', executeAfter: LessThan(now) },
          { kind: 'music', status: 'downloading', executeAfter: LessThan(now) },
        ],
        order: { executeAfter: 'ASC' },
        take: 8,
      });
      for (const job of jobs) {
        try {
          await this.advanceMusicJob(job);
        } catch (error) {
          this.logger.error(
            `music job ${job.id} unexpected error: ${(error as Error)?.message}`,
          );
        }
      }
    } finally {
      this.processingMusic = false;
    }
  }

  private async advanceVideoJob(job: MinimaxJobEntity): Promise<void> {
    const payload = JSON.parse(job.inputPayload) as MinimaxJobInputPayload;
    if (payload.kind !== 'video') {
      await this.markFailed(job, 'BAD_PAYLOAD', 'expected video payload');
      return;
    }

    if (job.status === 'pending') {
      try {
        let firstFrameImageUrl = payload.firstFrameImageUrl ?? job.coverUrl ?? undefined;
        let coverFileName = job.coverFileName ?? undefined;
        const needsFirstFrame =
          job.model === 'MiniMax-Hailuo-2.3-Fast' && !firstFrameImageUrl;
        if (needsFirstFrame) {
          const reservedCover = await this.quota.tryReserve('image-01');
          if (!reservedCover) {
            await this.markFailed(
              job,
              'COVER_QUOTA',
              'Fast model needs first_frame_image but image-01 quota exhausted',
            );
            return;
          }
          try {
            const img = await this.client.generateImage({
              model: 'image-01',
              prompt: `Cinematic 9:16 portrait still — ${payload.prompt.slice(0, 200)}`,
              aspectRatio: '9:16',
            });
            const persisted = await this.storage.persist({
              buffer: img.buffer,
              mimeType: img.mimeType,
              kind: 'image',
              suffix: '-firstframe',
            });
            firstFrameImageUrl = persisted.publicUrl;
            coverFileName = persisted.fileName;
            await this.quota.commit('image-01');
            await this.repo.update(job.id, {
              coverUrl: persisted.publicUrl,
              coverFileName: persisted.fileName,
            });
          } catch (err) {
            await this.quota.release('image-01');
            this.logger.warn(
              `cover gen failed for job ${job.id}: ${(err as Error)?.message}`,
            );
            // Demote: drop Fast and retry with HD.
            await this.maybeDemoteFastToHd(job);
            return;
          }
        }

        const submit = await this.client.submitVideo({
          model: job.model as MinimaxVideoModel,
          prompt: payload.prompt,
          firstFrameImageUrl,
          resolution: payload.resolution ?? '768P',
        });
        await this.repo.update(job.id, {
          status: 'submitted',
          taskId: submit.taskId,
          attemptCount: job.attemptCount + 1,
          lastAttemptAt: new Date(),
          executeAfter: new Date(Date.now() + VIDEO_POLL_INTERVAL_MS),
          coverFileName,
        });
        this.logger.log(
          `video job ${job.id} submitted: model=${job.model} task=${submit.taskId}`,
        );
      } catch (error) {
        await this.handleClientError(job, error, 'submit video');
      }
      return;
    }

    if (job.status === 'submitted') {
      if (!job.taskId) {
        await this.markFailed(job, 'NO_TASK_ID', 'submitted job missing taskId');
        return;
      }
      if (job.attemptCount >= VIDEO_MAX_ATTEMPTS) {
        await this.markFailed(
          job,
          'POLL_EXHAUSTED',
          `polled ${job.attemptCount} times without success`,
        );
        return;
      }
      try {
        const q = await this.client.queryVideo(job.taskId);
        if (q.status === 'Success' && q.fileId) {
          await this.repo.update(job.id, {
            status: 'downloading',
            fileId: q.fileId,
            attemptCount: job.attemptCount + 1,
            lastAttemptAt: new Date(),
            executeAfter: new Date(),
          });
          this.logger.log(
            `video job ${job.id} succeeded on minimax: file=${q.fileId}`,
          );
          // Cascade: try downloading immediately in this tick.
          const refreshed = await this.repo.findOneByOrFail({ id: job.id });
          await this.advanceVideoJob(refreshed);
        } else if (q.status === 'Fail') {
          await this.markFailed(
            job,
            'PROVIDER_FAIL',
            q.failReason ?? 'video task reported Fail',
          );
        } else {
          await this.repo.update(job.id, {
            attemptCount: job.attemptCount + 1,
            lastAttemptAt: new Date(),
            executeAfter: new Date(Date.now() + VIDEO_POLL_INTERVAL_MS),
          });
          this.logger.debug(
            `video job ${job.id} status=${q.status} attempt=${job.attemptCount + 1}`,
          );
        }
      } catch (error) {
        await this.handleClientError(job, error, 'query video');
      }
      return;
    }

    if (job.status === 'downloading') {
      if (!job.fileId) {
        await this.markFailed(job, 'NO_FILE_ID', 'downloading without fileId');
        return;
      }
      try {
        const file = await this.client.retrieveFile(job.fileId);
        const dl = await this.client.downloadBinary(file.downloadUrl);
        const persisted = await this.storage.persist({
          buffer: dl.buffer,
          mimeType: dl.mimeType,
          kind: 'video',
        });
        await this.repo.update(job.id, {
          status: 'completed',
          remoteDownloadUrl: file.downloadUrl,
          localFileName: persisted.fileName,
          localUrl: persisted.publicUrl,
          localMimeType: persisted.mimeType,
          localSize: persisted.size,
          completedAt: new Date(),
          lastAttemptAt: new Date(),
        });
        await this.quota.commit(job.model);
        this.logger.log(
          `video job ${job.id} downloaded -> ${persisted.fileName} (${persisted.size}B)`,
        );
        const finalJob = await this.repo.findOneByOrFail({ id: job.id });
        await this.fireOnCompleted(finalJob);
      } catch (error) {
        await this.handleClientError(job, error, 'download video');
      }
    }
  }

  private async advanceMusicJob(job: MinimaxJobEntity): Promise<void> {
    const payload = JSON.parse(job.inputPayload) as MinimaxJobInputPayload;
    if (payload.kind !== 'music') {
      await this.markFailed(job, 'BAD_PAYLOAD', 'expected music payload');
      return;
    }

    if (job.status === 'pending') {
      try {
        const result = await this.client.generateMusic({
          model: job.model as MinimaxMusicModel,
          prompt: payload.prompt,
          lyrics: payload.lyrics,
        });
        if (result.kind === 'inline') {
          const persisted = await this.storage.persist({
            buffer: result.buffer,
            mimeType: result.mimeType,
            kind: 'music',
          });
          await this.repo.update(job.id, {
            status: 'completed',
            localFileName: persisted.fileName,
            localUrl: persisted.publicUrl,
            localMimeType: persisted.mimeType,
            localSize: persisted.size,
            localDurationMs: result.durationMs ?? null,
            completedAt: new Date(),
            attemptCount: job.attemptCount + 1,
            lastAttemptAt: new Date(),
          });
          await this.quota.commit(job.model);
          this.logger.log(
            `music job ${job.id} inline -> ${persisted.fileName} (${persisted.size}B)`,
          );
          const finalJob = await this.repo.findOneByOrFail({ id: job.id });
          await this.fireOnCompleted(finalJob);
        } else {
          await this.repo.update(job.id, {
            status: 'submitted',
            taskId: result.taskId,
            attemptCount: job.attemptCount + 1,
            lastAttemptAt: new Date(),
            executeAfter: new Date(Date.now() + 5_000),
          });
          this.logger.log(`music job ${job.id} async task=${result.taskId}`);
        }
      } catch (error) {
        await this.handleClientError(job, error, 'submit music');
      }
      return;
    }

    if (job.status === 'submitted') {
      if (job.attemptCount >= MUSIC_MAX_ATTEMPTS) {
        await this.markFailed(
          job,
          'POLL_EXHAUSTED',
          `music polled ${job.attemptCount} times without inline result`,
        );
        return;
      }
      // The current MiniMax music endpoint typically returns inline audio. If
      // the gateway switches to a true async path the client returns kind='task'
      // and we'd need a query endpoint here. Until then, mark failed after the
      // attempt cap so the job doesn't dangle.
      await this.repo.update(job.id, {
        attemptCount: job.attemptCount + 1,
        lastAttemptAt: new Date(),
        executeAfter: new Date(Date.now() + 10_000),
      });
    }
  }

  private async maybeDemoteFastToHd(job: MinimaxJobEntity): Promise<void> {
    if (job.model !== 'MiniMax-Hailuo-2.3-Fast') {
      await this.markFailed(job, 'COVER_FAIL', 'cover gen failed (non-Fast job)');
      return;
    }
    const hdAvailable = await this.quota.availableToday('MiniMax-Hailuo-2.3');
    if (hdAvailable <= 0) {
      await this.markFailed(
        job,
        'COVER_FAIL_NO_HD_FALLBACK',
        'cover gen failed and no HD quota for fallback',
      );
      return;
    }
    const reserved = await this.quota.tryReserve('MiniMax-Hailuo-2.3');
    if (!reserved) {
      await this.markFailed(
        job,
        'COVER_FAIL_HD_RESERVE',
        'cover gen failed and HD reserve race lost',
      );
      return;
    }
    await this.quota.release('MiniMax-Hailuo-2.3-Fast');
    await this.repo.update(job.id, {
      model: 'MiniMax-Hailuo-2.3',
      executeAfter: new Date(),
      attemptCount: job.attemptCount + 1,
      lastAttemptAt: new Date(),
    });
    this.logger.log(`job ${job.id} demoted Fast → HD (cover gen failed)`);
  }

  private async requeueStaleJobs(
    kind: MinimaxJobKind,
    staleMs: number,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - staleMs);
    const stale = await this.repo.find({
      where: {
        kind,
        status: 'submitted',
        lastAttemptAt: LessThan(cutoff),
      },
      take: 5,
    });
    for (const job of stale) {
      this.logger.warn(`requeue stale ${kind} job ${job.id}`);
      await this.repo.update(job.id, {
        status: 'pending',
        executeAfter: new Date(),
      });
    }
  }

  private async handleClientError(
    job: MinimaxJobEntity,
    error: unknown,
    context: string,
  ): Promise<void> {
    const e = error as MinimaxClientError | Error;
    const code =
      e instanceof MinimaxClientError ? e.code : 'UNKNOWN';
    const retriable =
      e instanceof MinimaxClientError ? e.retriable : true;
    const message = e?.message ?? 'unknown error';
    if (!retriable) {
      await this.markFailed(job, code, `${context}: ${message}`);
      return;
    }
    const nextAttempt = job.attemptCount + 1;
    const backoffMs = Math.min(
      VIDEO_POLL_INTERVAL_MS,
      5_000 * Math.pow(2, Math.min(nextAttempt, 5)),
    );
    await this.repo.update(job.id, {
      attemptCount: nextAttempt,
      lastAttemptAt: new Date(),
      executeAfter: new Date(Date.now() + backoffMs),
      errorCode: code,
      errorMessage: message.slice(0, 500),
    });
    this.logger.warn(
      `${context} retry job=${job.id} in ${backoffMs}ms code=${code} msg=${message}`,
    );
  }

  private async markFailed(
    job: MinimaxJobEntity,
    code: string,
    message: string,
  ): Promise<void> {
    await this.repo.update(job.id, {
      status: 'failed',
      errorCode: code,
      errorMessage: message.slice(0, 500),
      completedAt: new Date(),
      lastAttemptAt: new Date(),
    });
    await this.quota.release(job.model);
    this.logger.warn(`job ${job.id} failed code=${code} msg=${message}`);
    const refreshed = await this.repo.findOne({ where: { id: job.id } });
    if (refreshed) await this.fireOnFailed(refreshed);
  }

  private async fireOnCompleted(job: MinimaxJobEntity): Promise<void> {
    const cb = this.callbacks.get(job.targetType);
    if (!cb) {
      this.logger.warn(
        `no callback for ${job.targetType} (job ${job.id})`,
      );
      return;
    }
    try {
      await cb.onCompleted(job);
    } catch (error) {
      this.logger.error(
        `onCompleted callback threw for job ${job.id}: ${(error as Error)?.message}`,
      );
    }
  }

  private async fireOnFailed(job: MinimaxJobEntity): Promise<void> {
    const cb = this.callbacks.get(job.targetType);
    if (!cb) return;
    try {
      await cb.onFailed(job);
    } catch (error) {
      this.logger.error(
        `onFailed callback threw for job ${job.id}: ${(error as Error)?.message}`,
      );
    }
  }
}

// i18n-ignore-end
