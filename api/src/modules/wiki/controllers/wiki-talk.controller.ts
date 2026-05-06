import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { WikiRateLimitGuard } from '../guards/wiki-rate-limit.guard';
import { WikiTalkService } from '../services/wiki-talk.service';

@Controller('wiki/talk')
export class WikiTalkController {
  constructor(private readonly talk: WikiTalkService) {}

  @Get(':characterId/threads')
  listThreads(@Param('characterId') characterId: string) {
    return this.talk.listThreads(characterId);
  }

  @Post(':characterId/threads')
  @UseGuards(JwtAuthGuard, WikiRateLimitGuard)
  createThread(
    @Param('characterId') characterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { title: string; body: string },
  ) {
    return this.talk.createThread(characterId, user, body);
  }

  @Get('threads/:threadId/posts')
  listPosts(@Param('threadId') threadId: string) {
    return this.talk.listPosts(threadId);
  }

  @Post('threads/:threadId/posts')
  @UseGuards(JwtAuthGuard, WikiRateLimitGuard)
  createPost(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { body: string; parentPostId?: string | null },
  ) {
    return this.talk.createPost(threadId, user, body);
  }

  @Patch('threads/:threadId/flags')
  @UseGuards(JwtAuthGuard)
  setFlags(
    @Param('threadId') threadId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { isLocked?: boolean; isResolved?: boolean },
  ) {
    return this.talk.setThreadFlags(threadId, actor, body);
  }

  @Delete('posts/:postId')
  @UseGuards(JwtAuthGuard)
  deletePost(
    @Param('postId') postId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.talk.deletePost(postId, actor);
  }
}
