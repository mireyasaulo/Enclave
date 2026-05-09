import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinimaxClient } from './minimax.client';
import { MinimaxAssetStorage } from './minimax-asset.storage';
import { MinimaxQuotaEntity } from './minimax-quota.entity';
import { MinimaxQuotaService } from './minimax-quota.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([MinimaxQuotaEntity])],
  providers: [MinimaxClient, MinimaxAssetStorage, MinimaxQuotaService],
  exports: [MinimaxClient, MinimaxAssetStorage, MinimaxQuotaService],
})
export class MinimaxModule {}
