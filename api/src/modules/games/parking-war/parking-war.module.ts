import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { CharactersModule } from '../../characters/characters.module';
import { FeedModule } from '../../feed/feed.module';
import { ParkingWarController } from './parking-war.controller';
import { ParkingWarEventService } from './parking-war-event.service';
import { ParkingWarStateService } from './parking-war-state.service';
import { ParkingWarEventLogEntity } from './entities/parking-war-event-log.entity';
import { ParkingWarNpcStateEntity } from './entities/parking-war-npc-state.entity';
import { ParkingWarOccupancyEntity } from './entities/parking-war-occupancy.entity';
import { ParkingWarPlayerStateEntity } from './entities/parking-war-player-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParkingWarPlayerStateEntity,
      ParkingWarNpcStateEntity,
      ParkingWarOccupancyEntity,
      ParkingWarEventLogEntity,
    ]),
    AuthModule,
    CharactersModule,
    FeedModule,
  ],
  controllers: [ParkingWarController],
  providers: [ParkingWarStateService, ParkingWarEventService],
  exports: [ParkingWarStateService, ParkingWarEventService],
})
export class ParkingWarModule {}
