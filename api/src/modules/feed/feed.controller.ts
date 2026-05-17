import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import type { MomentMediaAsset } from '../moments/moment-media.types';

const MAX_FEED_LIMIT = 100;

function clampPaginationPage(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

function clampPaginationLimit(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 20;
  return Math.min(Math.floor(value), MAX_FEED_LIMIT);
}

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('channels/home')
  getChannelHome(
    @Query('section')
    section: 'recommended' | 'friends' | 'following' | 'live' | undefined,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.feedService.getChannelHome({
      section,
      page: clampPaginationPage(page),
      limit: clampPaginationLimit(limit),
    });
  }

  @Get('channels/home/decorations')
  getChannelHomeDecorations(
    @Query('section')
    section: 'recommended' | 'friends' | 'following' | 'live' | undefined,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.feedService.getChannelHomeDecorations({
      section,
      page: clampPaginationPage(page),
      limit: clampPaginationLimit(limit),
    });
  }

  @Get('channels/authors/:authorId')
  getChannelAuthor(@Param('authorId') authorId: string) {
    return this.feedService.getChannelAuthorProfile(authorId);
  }

  @Post('channels/authors/:authorId/follow')
  followChannelAuthor(@Param('authorId') authorId: string) {
    return this.feedService.followChannelAuthor(authorId);
  }

  @Delete('channels/authors/:authorId/follow')
  unfollowChannelAuthor(@Param('authorId') authorId: string) {
    return this.feedService.unfollowChannelAuthor(authorId);
  }

  @Get()
  getFeed(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('surface') surface: 'feed' | 'channels' | undefined,
  ) {
    // 走查 R1：?limit=abc 直接 Number(NaN) → TypeORM .take(NaN) 抛 "Provided
    // skip value is not a number" → 500，老 client 不会发这种请求但 curl /
    // 反代 / 旧缓存链路一旦塞进来，整条广场就 500；同时 ?limit=999999 这条
    // DoS 路径之前 0 设防（前端硬编码 20，但服务端也得自己兜）。统一 clamp
    // 到 [1, 100]，?page 同样兜 [1, …]。
    return this.feedService.getFeed(
      clampPaginationPage(page),
      clampPaginationLimit(limit),
      surface,
    );
  }

  @Post()
  createPost(
    @Body()
    body: {
      text?: string;
      title?: string;
      media?: MomentMediaAsset[];
      mediaType?: 'text' | 'image' | 'video';
      mediaUrl?: string;
      coverUrl?: string | null;
      durationMs?: number;
      aspectRatio?: number;
      topicTags?: string[];
      surface?: 'feed' | 'channels';
    },
  ) {
    return this.feedService.createOwnerPost(body.text, {
      title: body.title,
      media: body.media,
      mediaType: body.mediaType,
      mediaUrl: body.mediaUrl,
      coverUrl: body.coverUrl,
      durationMs: body.durationMs,
      aspectRatio: body.aspectRatio,
      topicTags: body.topicTags,
      surface: body.surface,
    });
  }

  @Post('channels/generate')
  generateChannelPost() {
    return this.feedService.generateChannelPost();
  }

  @Get(':id/comments')
  getFeedComments(@Param('id') postId: string) {
    return this.feedService.getComments(postId);
  }

  @Get(':id')
  getPost(@Param('id') id: string) {
    return this.feedService.getPostWithComments(id);
  }

  @Post(':id/comment')
  addComment(@Param('id') postId: string, @Body() body: { text: string }) {
    return this.feedService.addOwnerComment(postId, body.text);
  }

  @Post(':id/like')
  likePost(@Param('id') postId: string) {
    return this.feedService.likeOwnerPost(postId);
  }

  @Delete(':id/like')
  unlikePost(@Param('id') postId: string) {
    return this.feedService.unlikeOwnerPost(postId);
  }

  @Post(':id/favorite')
  favoritePost(@Param('id') postId: string) {
    return this.feedService.favoriteOwnerPost(postId);
  }

  @Delete(':id/favorite')
  unfavoritePost(@Param('id') postId: string) {
    return this.feedService.unfavoriteOwnerPost(postId);
  }

  @Post(':id/share')
  sharePost(
    @Param('id') postId: string,
    @Body() body: { channel?: 'native' | 'copy' | 'system' | 'unknown' },
  ) {
    return this.feedService.shareOwnerPost(postId, body.channel);
  }

  @Post(':id/forward-to-chat')
  forwardPostToChat(
    @Param('id') postId: string,
    @Body() body: { targetCharacterId: string; note?: string },
  ) {
    return this.feedService.forwardOwnerChannelPostToChat(postId, body);
  }

  @Post(':id/view')
  viewPost(
    @Param('id') postId: string,
    @Body() body: { progressSeconds?: number; completed?: boolean },
  ) {
    return this.feedService.viewOwnerPost(postId, body);
  }

  @Post(':id/not-interested')
  markNotInterested(@Param('id') postId: string) {
    return this.feedService.markOwnerPostNotInterested(postId);
  }

  @Post('comments/:id/like')
  likeComment(@Param('id') commentId: string) {
    return this.feedService.likeOwnerComment(commentId);
  }

  @Post('comments/:id/reply')
  replyComment(@Param('id') commentId: string, @Body() body: { text: string }) {
    return this.feedService.replyToComment(commentId, body.text);
  }
}
