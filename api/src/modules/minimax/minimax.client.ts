// i18n-ignore-start: provider adapter — error/log strings only.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type MinimaxBaseResp,
  type MinimaxBinary,
  type MinimaxFileRetrieveResult,
  type MinimaxImageInput,
  type MinimaxImageResult,
  type MinimaxLyricsInput,
  type MinimaxLyricsResult,
  type MinimaxMusicInput,
  type MinimaxMusicResult,
  type MinimaxVideoQueryResult,
  type MinimaxVideoStatus,
  type MinimaxVideoSubmitInput,
  type MinimaxVideoSubmitResult,
} from './minimax.types';

const DEFAULT_BASE_URL = 'https://api.minimaxi.com';
const DOWNLOAD_MAX_BYTES = 256 * 1024 * 1024; // 256 MB

export class MinimaxClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retriable: boolean,
    public readonly httpStatus?: number,
    public readonly providerStatusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MinimaxClient {
  private readonly logger = new Logger(MinimaxClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = (config.get<string>('MINIMAX_API_KEY') ?? '').trim();
    this.baseUrl = (
      config.get<string>('MINIMAX_BASE_URL') ?? DEFAULT_BASE_URL
    )
      .replace(/\/+$/, '')
      // 路径都自带 /v1 前缀，base 末尾若也带 /v1 会拼成 /v1/v1/... → 404
      .replace(/\/v1$/, '');
    if (!this.apiKey) {
      this.logger.warn(
        'MINIMAX_API_KEY missing — token-plan video/music generation disabled',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async submitVideo(
    input: MinimaxVideoSubmitInput,
  ): Promise<MinimaxVideoSubmitResult> {
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      duration: input.duration ?? 6,
      resolution: input.resolution ?? '768P',
    };
    if (input.firstFrameImageUrl) {
      body.first_frame_image = input.firstFrameImageUrl;
    }

    const response = await this.postJson<{
      task_id?: string;
      base_resp?: MinimaxBaseResp;
    }>('/v1/video_generation', body);
    this.assertSuccess(response.base_resp, 'video submit');
    const taskId = response.task_id?.trim();
    if (!taskId) {
      throw new MinimaxClientError(
        'MINIMAX_VIDEO_NO_TASK_ID',
        'video submit returned empty task_id',
        true,
      );
    }
    return { taskId };
  }

  async queryVideo(taskId: string): Promise<MinimaxVideoQueryResult> {
    const response = await this.getJson<{
      status?: string;
      file_id?: string;
      base_resp?: MinimaxBaseResp;
    }>(`/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`);
    // 不调用 assertSuccess：query 在任务失败时也会返回 base_resp.status_code != 0，
    // 但 top-level status='Fail' 已经表达了真实状态，应当读 status 而不是抛错。
    const status = (response.status ?? 'Unknown') as MinimaxVideoStatus;
    return {
      status,
      fileId: response.file_id ? String(response.file_id) : undefined,
      failReason: response.base_resp?.status_msg,
    };
  }

  async retrieveFile(fileId: string): Promise<MinimaxFileRetrieveResult> {
    const response = await this.getJson<{
      file?: {
        download_url?: string;
        backup_download_url?: string;
        filename?: string;
        bytes?: number;
      };
      base_resp?: MinimaxBaseResp;
    }>(`/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`);
    this.assertSuccess(response.base_resp, 'file retrieve');
    const url =
      response.file?.download_url ?? response.file?.backup_download_url;
    if (!url) {
      throw new MinimaxClientError(
        'MINIMAX_FILE_NO_URL',
        'file retrieve returned empty download_url',
        true,
      );
    }
    return {
      downloadUrl: url,
      fileName: response.file?.filename,
      size: response.file?.bytes,
    };
  }

  async generateImage(input: MinimaxImageInput): Promise<MinimaxImageResult> {
    const body = {
      model: input.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? '1:1',
      n: input.n ?? 1,
      response_format: 'url',
      prompt_optimizer: false,
    };
    const response = await this.postJson<{
      data?: { image_urls?: string[] };
      base_resp?: MinimaxBaseResp;
    }>('/v1/image_generation', body);
    this.assertSuccess(response.base_resp, 'image generation');
    const url = response.data?.image_urls?.[0];
    if (!url) {
      throw new MinimaxClientError(
        'MINIMAX_IMAGE_EMPTY',
        'image generation returned no urls',
        true,
      );
    }
    const downloaded = await this.downloadBinary(url);
    return downloaded;
  }

  async generateMusic(input: MinimaxMusicInput): Promise<MinimaxMusicResult> {
    const body: Record<string, unknown> = {
      model: input.model,
      audio_setting: {
        sample_rate: input.sampleRate ?? 44100,
        bitrate: input.bitrate ?? 256000,
        format: input.format ?? 'mp3',
      },
    };
    if (input.lyrics) {
      body.lyrics = input.lyrics;
    }
    if (input.prompt) {
      body.prompt = input.prompt;
    }
    if (input.referVoice) {
      body.refer_voice = input.referVoice;
    }

    const response = await this.postJson<{
      data?: { audio?: string; status?: number };
      task_id?: string;
      base_resp?: MinimaxBaseResp;
    }>('/v1/music_generation', body);
    this.assertSuccess(response.base_resp, 'music generation');

    const hex = response.data?.audio?.trim();
    if (hex) {
      const buffer = Buffer.from(hex, 'hex');
      if (!buffer.length) {
        throw new MinimaxClientError(
          'MINIMAX_MUSIC_EMPTY',
          'music generation returned empty buffer',
          true,
        );
      }
      return { kind: 'inline', buffer, mimeType: 'audio/mpeg' };
    }
    if (response.task_id) {
      return { kind: 'task', taskId: response.task_id };
    }
    throw new MinimaxClientError(
      'MINIMAX_MUSIC_EMPTY',
      'music generation returned no audio and no task_id',
      true,
    );
  }

  async generateLyrics(
    input: MinimaxLyricsInput,
  ): Promise<MinimaxLyricsResult> {
    const response = await this.postJson<{
      data?: { lyrics?: string };
      base_resp?: MinimaxBaseResp;
    }>('/v1/lyrics_generation', { prompt: input.prompt });
    this.assertSuccess(response.base_resp, 'lyrics generation');
    const lyrics = response.data?.lyrics?.trim();
    if (!lyrics) {
      throw new MinimaxClientError(
        'MINIMAX_LYRICS_EMPTY',
        'lyrics generation returned empty text',
        true,
      );
    }
    return { lyrics };
  }

  async downloadBinary(
    url: string,
    opts?: { maxBytes?: number },
  ): Promise<MinimaxBinary> {
    const max = opts?.maxBytes ?? DOWNLOAD_MAX_BYTES;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (error) {
      throw new MinimaxClientError(
        'MINIMAX_DOWNLOAD_NETWORK',
        `download network failure: ${(error as Error)?.message}`,
        true,
      );
    }
    if (!res.ok) {
      throw new MinimaxClientError(
        'MINIMAX_DOWNLOAD_HTTP',
        `download http ${res.status}`,
        res.status >= 500 || res.status === 429,
        res.status,
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new MinimaxClientError(
        'MINIMAX_DOWNLOAD_EMPTY',
        'downloaded buffer is empty',
        true,
      );
    }
    if (buffer.length > max) {
      throw new MinimaxClientError(
        'MINIMAX_DOWNLOAD_OVERSIZE',
        `downloaded buffer ${buffer.length} exceeds max ${max}`,
        false,
      );
    }
    const mimeType =
      res.headers.get('content-type') || guessMimeFromUrl(url);
    return { buffer, mimeType };
  }

  private async postJson<T>(pathname: string, body: unknown): Promise<T> {
    return this.requestJson<T>('POST', pathname, body);
  }

  private async getJson<T>(pathname: string): Promise<T> {
    return this.requestJson<T>('GET', pathname);
  }

  private async requestJson<T>(
    method: 'GET' | 'POST',
    pathname: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new MinimaxClientError(
        'MINIMAX_API_KEY_MISSING',
        'MINIMAX_API_KEY not configured',
        false,
      );
    }
    const url = `${this.baseUrl}${pathname}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      });
    } catch (error) {
      throw new MinimaxClientError(
        'MINIMAX_NETWORK',
        `network failure on ${pathname}: ${(error as Error)?.message}`,
        true,
      );
    }
    const text = await response.text();
    if (!response.ok) {
      const retriable = response.status >= 500 || response.status === 429;
      this.logger.warn(
        `minimax http error url=${url} status=${response.status} body=${text.slice(0, 400)}`,
      );
      throw new MinimaxClientError(
        'MINIMAX_HTTP',
        `${pathname} returned ${response.status}: ${text.slice(0, 200)}`,
        retriable,
        response.status,
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new MinimaxClientError(
        'MINIMAX_INVALID_JSON',
        `${pathname} returned non-JSON body`,
        true,
      );
    }
  }

  private assertSuccess(
    resp: MinimaxBaseResp | undefined,
    context: string,
  ): void {
    if (!resp) return;
    if (resp.status_code === 0) return;
    const msg = resp.status_msg ?? `code=${resp.status_code}`;
    this.logger.warn(
      `minimax ${context} failed status_code=${resp.status_code} msg=${resp.status_msg ?? ''}`,
    );
    const retriable = resp.status_code === 1002 || resp.status_code === 1004;
    throw new MinimaxClientError(
      'MINIMAX_PROVIDER',
      `minimax ${context} failed: ${msg}`,
      retriable,
      undefined,
      resp.status_code,
    );
  }
}

function guessMimeFromUrl(url: string): string {
  if (/\.mp4(\?|$)/i.test(url)) return 'video/mp4';
  if (/\.mp3(\?|$)/i.test(url)) return 'audio/mpeg';
  if (/\.wav(\?|$)/i.test(url)) return 'audio/wav';
  if (/\.jpe?g(\?|$)/i.test(url)) return 'image/jpeg';
  if (/\.png(\?|$)/i.test(url)) return 'image/png';
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
  return 'application/octet-stream';
}

// i18n-ignore-end
