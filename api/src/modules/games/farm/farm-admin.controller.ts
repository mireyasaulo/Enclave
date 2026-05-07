import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../admin/admin.guard';
import { FarmNpcTickService } from './farm-npc-tick.service';
import { FarmTickSummary } from './farm.types';

@Controller('admin/games/farm')
@UseGuards(AdminGuard)
export class FarmAdminController {
  constructor(private readonly tickService: FarmNpcTickService) {}

  @Post('run-tick')
  async runTick(): Promise<FarmTickSummary> {
    return this.tickService.runTick();
  }
}
