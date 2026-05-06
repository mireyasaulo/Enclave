import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { RequireRole } from '../decorators/require-role.decorator';
import { WikiRoleGuard } from '../guards/wiki-role.guard';
import { WikiEditService } from '../services/wiki-edit.service';

@Controller('wiki/pages')
@UseGuards(JwtAuthGuard, WikiRoleGuard)
export class WikiSoftDeleteController {
  constructor(private readonly edits: WikiEditService) {}

  @Post(':id/delete-request')
  requestDelete(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { reason?: string | null },
  ) {
    return this.edits.requestLifecycle(id, actor, 'soft_delete', body?.reason);
  }

  @Post(':id/restore-request')
  requestRestore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { reason?: string | null },
  ) {
    return this.edits.requestLifecycle(id, actor, 'restore', body?.reason);
  }

  @Post(':id/delete')
  @RequireRole('admin')
  delete(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { reason?: string | null },
  ) {
    return this.edits.requestLifecycle(
      id,
      actor,
      'soft_delete',
      body?.reason ?? '管理员直接删除词条',
    );
  }

  @Post(':id/restore')
  @RequireRole('admin')
  restore(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { reason?: string | null },
  ) {
    return this.edits.requestLifecycle(
      id,
      actor,
      'restore',
      body?.reason ?? '管理员直接恢复词条',
    );
  }
}
