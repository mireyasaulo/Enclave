import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../decorators/require-role.decorator';
import { WikiRoleGuard } from '../guards/wiki-role.guard';
import { WikiStatsService } from '../services/wiki-stats.service';

@Controller('wiki/admin/stats')
@UseGuards(JwtAuthGuard, WikiRoleGuard)
@RequireRole('admin')
export class WikiStatsController {
  constructor(private readonly stats: WikiStatsService) {}

  @Get('daily')
  daily() {
    return this.stats.daily();
  }

  @Get('top-reverted-users')
  top(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.stats.topRevertedUsers(limit);
  }

  @Get('abuse-filters')
  filterStats() {
    return this.stats.filterStats();
  }
}
