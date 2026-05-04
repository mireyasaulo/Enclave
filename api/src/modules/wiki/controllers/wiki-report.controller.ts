import {
  Body,
  Controller,
  Get,
  Param,
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
import { WikiReportService } from '../services/wiki-report.service';

@Controller('wiki/reports')
export class WikiReportController {
  constructor(private readonly reports: WikiReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() reporter: AuthenticatedUser,
    @Body()
    body: {
      targetType: string;
      targetId: string;
      reason: string;
      details?: string;
    },
  ) {
    return this.reports.create(reporter, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, WikiRoleGuard)
  @RequireRole('admin')
  list(@Query('status') status?: string) {
    return this.reports.list({ status });
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, WikiRoleGuard)
  @RequireRole('admin')
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.reports.setStatus(id, body.status);
  }
}
