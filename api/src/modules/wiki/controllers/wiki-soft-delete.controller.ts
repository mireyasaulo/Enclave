import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { RequireRole } from '../decorators/require-role.decorator';
import { WikiRoleGuard } from '../guards/wiki-role.guard';
import { WikiPageService } from '../services/wiki-page.service';

@Controller('wiki/pages')
@UseGuards(JwtAuthGuard, WikiRoleGuard)
export class WikiSoftDeleteController {
  constructor(private readonly pages: WikiPageService) {}

  @Post(':id/delete')
  @RequireRole('admin')
  delete(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pages.setDeletedFlag(id, actor.id, true);
  }

  @Post(':id/restore')
  @RequireRole('admin')
  restore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pages.setDeletedFlag(id, actor.id, false);
  }
}
