import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { AbuseFilterService } from '../services/abuse-filter.service';
import type {
  AbuseFilterAction,
  AbuseFilterPattern,
  AbuseFilterScope,
} from '../entities/abuse-filter.entity';

@Controller('wiki/admin/abuse-filters')
@UseGuards(JwtAuthGuard, WikiRoleGuard)
@RequireRole('admin')
export class AbuseFilterController {
  constructor(private readonly filters: AbuseFilterService) {}

  @Get()
  list() {
    return this.filters.listFilters();
  }

  @Get('hits')
  listHits(
    @Query('filterId') filterId?: string,
    @Query('userId') userId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.filters.listHits({ filterId, userId, limit });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.filters.getFilter(id);
  }

  @Get(':id/hits')
  hitsByFilter(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.filters.listHits({ filterId: id, limit });
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      name: string;
      description?: string;
      enabled?: boolean;
      pattern: AbuseFilterPattern;
      scope?: AbuseFilterScope;
      action: AbuseFilterAction;
      severity?: 'low' | 'medium' | 'high';
    },
  ) {
    return this.filters.createFilter({
      name: body.name,
      description: body.description ?? '',
      enabled: body.enabled ?? true,
      pattern: body.pattern,
      scope: body.scope ?? 'all',
      action: body.action,
      severity: body.severity ?? 'medium',
      createdBy: actor.id,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    patch: Partial<{
      name: string;
      description: string;
      enabled: boolean;
      pattern: AbuseFilterPattern;
      scope: AbuseFilterScope;
      action: AbuseFilterAction;
      severity: 'low' | 'medium' | 'high';
    }>,
  ) {
    return this.filters.updateFilter(id, patch);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.filters.deleteFilter(id);
  }
}
