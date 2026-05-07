import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { CharactersModule } from '../../characters/characters.module';
import { FarmController } from './farm.controller';
import { FarmEventService } from './farm-event.service';
import { FarmNpcService } from './farm-npc.service';
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
    CharactersModule,
  ],
  controllers: [FarmController],
  providers: [FarmStateService, FarmEventService, FarmNpcService],
  exports: [FarmStateService, FarmEventService, FarmNpcService],
})
export class FarmModule {}
