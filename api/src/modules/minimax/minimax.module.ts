import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinimaxClient } from './minimax.client';
import { MinimaxAssetStorage } from './minimax-asset.storage';
import { MinimaxQuotaEntity } from './minimax-quota.entity';
import { MinimaxQuotaService } from './minimax-quota.service';
import { MinimaxJobEntity } from './minimax-job.entity';
import { MinimaxJobService } from './minimax-job.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([MinimaxQuotaEntity, MinimaxJobEntity]),
  ],
  providers: [
    MinimaxClient,
    MinimaxAssetStorage,
    MinimaxQuotaService,
    MinimaxJobService,
  ],
  exports: [
    MinimaxClient,
    MinimaxAssetStorage,
    MinimaxQuotaService,
    MinimaxJobService,
  ],
})
export class MinimaxModule {}
