import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLedgerEntity } from '../analytics/ai-usage-ledger.entity';
import { ConversationEntity } from '../chat/conversation.entity';
import { GroupEntity } from '../chat/group.entity';
import { CharacterRevisionEntity } from '../wiki/entities/character-revision.entity';
import { EditSubmissionEntity } from '../wiki/entities/edit-submission.entity';
import { AiModule } from '../ai/ai.module';
import { CloudRuntimeReportingService } from './cloud-runtime-reporting.service';
import { CloudTokenUsageSyncService } from './cloud-token-usage-sync.service';

@Module({
  imports: [
    ConfigModule,
    AiModule,
    TypeOrmModule.forFeature([
      AiUsageLedgerEntity,
      ConversationEntity,
      GroupEntity,
      CharacterRevisionEntity,
      EditSubmissionEntity,
    ]),
  ],
  providers: [CloudRuntimeReportingService, CloudTokenUsageSyncService],
})
export class CloudRuntimeModule {}
