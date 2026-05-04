import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { WikiProtectionService } from '../services/wiki-protection.service';

@Controller('wiki/pages')
export class WikiProtectionController {
  constructor(private readonly protection: WikiProtectionService) {}

  @Patch(':id/protection')
  @UseGuards(JwtAuthGuard, WikiRoleGuard)
  @RequireRole('admin')
  setProtection(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      level: 'none' | 'semi' | 'full';
      expiresAt?: string | null;
      reason?: string | null;
    },
  ) {
    return this.protection.setProtection(id, actor, body);
  }

  @Get(':id/protection-log')
  history(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.protection.listLogs(id, limit);
  }
}
