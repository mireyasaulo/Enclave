import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { FarmController } from './farm.controller';
import { FarmEventService } from './farm-event.service';
import { FarmStateService } from './farm-state.service';
import { FarmEventLogEntity } from './entities/farm-event-log.entity';
import { FarmNpcStateEntity } from './entities/farm-npc-state.entity';
import { FarmPlayerStateEntity } from './entities/farm-player-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FarmPlayerStateEntity,
      FarmNpcStateEntity,
      FarmEventLogEntity,
    ]),
    AuthModule,
  ],
  controllers: [FarmController],
  providers: [FarmStateService, FarmEventService],
  exports: [FarmStateService, FarmEventService],
})
export class FarmModule {}
