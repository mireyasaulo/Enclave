import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinimaxClient } from './minimax.client';
import { MinimaxAssetStorage } from './minimax-asset.storage';

@Module({
  imports: [ConfigModule],
  providers: [MinimaxClient, MinimaxAssetStorage],
  exports: [MinimaxClient, MinimaxAssetStorage],
})
export class MinimaxModule {}
