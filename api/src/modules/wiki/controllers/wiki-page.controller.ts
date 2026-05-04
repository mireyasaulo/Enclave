import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { WikiEditService } from '../services/wiki-edit.service';
import { WikiPageService } from '../services/wiki-page.service';

@Controller('wiki')
export class WikiPageController {
  constructor(
    private readonly pages: WikiPageService,
    private readonly edits: WikiEditService,
  ) {}

  @Get('recent-changes')
  recentChanges(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('onlyUnpatrolled') onlyUnpatrolled?: string,
  ) {
    return this.pages.listRecentChanges({
      limit,
      onlyUnpatrolled:
        onlyUnpatrolled === '1' || onlyUnpatrolled === 'true',
    });
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.pages.search(q ?? '', limit);
  }

  @Get('pages')
  listPages() {
    return this.pages.listPages();
  }

  @Post('pages')
  @UseGuards(JwtAuthGuard)
  createPage(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      characterId?: string | null;
      recipeSnapshot?: Record<string, unknown> | null;
      contentSnapshot?: Record<string, unknown> | null;
      editSummary?: string | null;
    },
  ) {
    return this.edits.createPage(user, body);
  }

  @Get('pages/:id')
  view(@Param('id') id: string) {
    return this.pages.getPageView(id);
  }

  @Get('pages/:id/history')
  history(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.pages.getHistory(id, limit);
  }

  @Get('pages/:id/pending')
  pending(@Param('id') id: string) {
    return this.pages.getPending(id);
  }

  @Get('pages/:id/diff')
  diff(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    return this.pages.getDiff(id, from, to);
  }

  @Get('pages/:id/revisions/:revisionId')
  revision(@Param('revisionId') revisionId: string) {
    return this.pages.getRevisionOrThrow(revisionId);
  }

  @Post('pages/:id/edits')
  @UseGuards(JwtAuthGuard)
  submit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      contentSnapshot: Record<string, unknown>;
      baseRevisionId?: string | null;
      editSummary?: string;
      isMinor?: boolean;
    },
  ) {
    return this.edits.submit(id, user, body);
  }
}
