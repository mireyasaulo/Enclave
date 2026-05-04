import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { WikiWatchlistService } from '../services/wiki-watchlist.service';

@Controller('wiki/watchlist')
@UseGuards(JwtAuthGuard)
export class WikiWatchlistController {
  constructor(private readonly watchlist: WikiWatchlistService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.watchlist.list(user.id);
  }

  @Get('feed')
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query('since') since?: string,
  ) {
    return this.watchlist.feed(user.id, since);
  }

  @Get('status/:characterId')
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('characterId') characterId: string,
  ) {
    return this.watchlist
      .isWatching(user.id, characterId)
      .then((watching) => ({ watching }));
  }

  @Post(':characterId')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('characterId') characterId: string,
    @Body() body: { notifyOnEdit?: boolean; notifyOnTalk?: boolean },
  ) {
    return this.watchlist.add(user.id, characterId, body);
  }

  @Delete(':characterId')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('characterId') characterId: string,
  ) {
    await this.watchlist.remove(user.id, characterId);
    return { success: true };
  }
}
