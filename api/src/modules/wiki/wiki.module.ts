import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CharacterEntity } from '../characters/character.entity';
import { UserEntity } from '../auth/user.entity';
import { CharacterPageEntity } from './entities/character-page.entity';
import { CharacterRevisionEntity } from './entities/character-revision.entity';
import { EditSubmissionEntity } from './entities/edit-submission.entity';
import { UserWikiProfileEntity } from './entities/user-wiki-profile.entity';
import { WikiBlockEntity } from './entities/wiki-block.entity';
import { WikiProtectionLogEntity } from './entities/wiki-protection-log.entity';
import { WikiTalkThreadEntity } from './entities/wiki-talk-thread.entity';
import { WikiTalkPostEntity } from './entities/wiki-talk-post.entity';
import { WikiWatchlistEntity } from './entities/wiki-watchlist.entity';
import { WikiRoleGuard } from './guards/wiki-role.guard';
import { WikiPageService } from './services/wiki-page.service';
import { WikiEditService } from './services/wiki-edit.service';
import { WikiReviewService } from './services/wiki-review.service';
import { WikiBlockService } from './services/wiki-block.service';
import { WikiProtectionService } from './services/wiki-protection.service';
import { WikiRoleService } from './services/wiki-role.service';
import { WikiTalkService } from './services/wiki-talk.service';
import { WikiWatchlistService } from './services/wiki-watchlist.service';
import { WikiPageController } from './controllers/wiki-page.controller';
import { WikiReviewController } from './controllers/wiki-review.controller';
import { WikiRevertController } from './controllers/wiki-revert.controller';
import { WikiBlockController } from './controllers/wiki-block.controller';
import { WikiProtectionController } from './controllers/wiki-protection.controller';
import { WikiUserController } from './controllers/wiki-user.controller';
import { WikiTalkController } from './controllers/wiki-talk.controller';
import { WikiWatchlistController } from './controllers/wiki-watchlist.controller';
import { WikiSoftDeleteController } from './controllers/wiki-soft-delete.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CharacterEntity,
      UserEntity,
      CharacterPageEntity,
      CharacterRevisionEntity,
      EditSubmissionEntity,
      UserWikiProfileEntity,
      WikiBlockEntity,
      WikiProtectionLogEntity,
      WikiTalkThreadEntity,
      WikiTalkPostEntity,
      WikiWatchlistEntity,
    ]),
  ],
  controllers: [
    WikiPageController,
    WikiReviewController,
    WikiRevertController,
    WikiBlockController,
    WikiProtectionController,
    WikiUserController,
    WikiTalkController,
    WikiWatchlistController,
    WikiSoftDeleteController,
  ],
  providers: [
    WikiPageService,
    WikiEditService,
    WikiReviewService,
    WikiBlockService,
    WikiProtectionService,
    WikiRoleService,
    WikiTalkService,
    WikiWatchlistService,
    WikiRoleGuard,
  ],
  exports: [
    WikiPageService,
    WikiEditService,
    WikiReviewService,
    WikiBlockService,
    WikiProtectionService,
    WikiRoleService,
    WikiTalkService,
    WikiWatchlistService,
  ],
})
export class WikiModule {}
