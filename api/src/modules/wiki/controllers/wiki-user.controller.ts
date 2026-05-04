import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { RequireRole } from '../decorators/require-role.decorator';
import { WikiRoleGuard } from '../guards/wiki-role.guard';
import { WikiRoleService } from '../services/wiki-role.service';

@Controller('wiki/users')
@UseGuards(JwtAuthGuard, WikiRoleGuard)
export class WikiUserController {
  constructor(private readonly roles: WikiRoleService) {}

  @Get()
  @RequireRole('admin')
  list() {
    return this.roles.listUsers();
  }

  @Post(':id/role')
  @RequireRole('admin')
  setRole(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      role: 'newcomer' | 'autoconfirmed' | 'patroller' | 'admin';
      reason?: string;
    },
  ) {
    return this.roles.setRole(id, actor, body);
  }
}
