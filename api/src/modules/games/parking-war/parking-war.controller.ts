// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { Controller, Get, Query } from '@nestjs/common';
import { ParkingWarEventService } from './parking-war-event.service';
import { ParkingWarStateService } from './parking-war-state.service';
import type {
  ParkingWarEventView,
  ParkingWarPlayerStateView,
} from './parking-war.types';

@Controller('games/parking-war')
export class ParkingWarController {
  constructor(
    private readonly stateService: ParkingWarStateService,
    private readonly eventService: ParkingWarEventService,
  ) {}

  @Get('state')
  async getState(): Promise<ParkingWarPlayerStateView> {
    const ownerId = await this.stateService.resolveOwnerId();
    return this.stateService.getPlayerStateView(ownerId);
  }

  @Get('events')
  async listEvents(
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ): Promise<ParkingWarEventView[]> {
    const ownerId = await this.stateService.resolveOwnerId();
    const sinceDate = since ? new Date(since) : undefined;
    const limitN = limit ? Math.max(1, Math.min(200, Number(limit))) : 50;
    const rows = await this.eventService.listEvents(ownerId, {
      since:
        sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : undefined,
      limit: limitN,
    });
    return rows.map((row) => this.eventService.toEventView(row));
  }
}
// i18n-ignore-end
