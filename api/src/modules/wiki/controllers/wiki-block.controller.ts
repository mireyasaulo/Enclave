import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { RequireRole } from '../decorators/require-role.decorator';
import { WikiRoleGuard } from '../guards/wiki-role.guard';
import { WikiBlockService } from '../services/wiki-block.service';

@Controller('wiki')
@UseGuards(JwtAuthGuard, WikiRoleGuard)
export class WikiBlockController {
  constructor(private readonly blocks: WikiBlockService) {}

  @Get('blocks')
  @RequireRole('admin')
  list(
    @Query('active', new DefaultValuePipe('1')) active: string,
    @Query('userId') userId?: string,
  ) {
    return this.blocks.list({ active: active !== '0', userId });
  }

  @Post('users/:id/block')
  @RequireRole('admin')
  create(
    @Param('id') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      scope: 'global' | 'page' | 'talk';
      targetCharacterId?: string;
      reason: string;
      expiresAt?: string | null;
    },
  ) {
    return this.blocks.create(actor, { userId, ...body });
  }

  @Delete('blocks/:blockId')
  @RequireRole('admin')
  async revoke(
    @Param('blockId') blockId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.blocks.revoke(blockId, actor);
    return { success: true };
  }
}
