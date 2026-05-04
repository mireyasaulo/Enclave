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
import { WikiRoleGuard } from './guards/wiki-role.guard';
import { WikiPageService } from './services/wiki-page.service';
import { WikiEditService } from './services/wiki-edit.service';
import { WikiReviewService } from './services/wiki-review.service';
import { WikiBlockService } from './services/wiki-block.service';
import { WikiProtectionService } from './services/wiki-protection.service';
import { WikiRoleService } from './services/wiki-role.service';
import { WikiPageController } from './controllers/wiki-page.controller';
import { WikiReviewController } from './controllers/wiki-review.controller';
import { WikiRevertController } from './controllers/wiki-revert.controller';
import { WikiBlockController } from './controllers/wiki-block.controller';
import { WikiProtectionController } from './controllers/wiki-protection.controller';
import { WikiUserController } from './controllers/wiki-user.controller';

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
    ]),
  ],
  controllers: [
    WikiPageController,
    WikiReviewController,
    WikiRevertController,
    WikiBlockController,
    WikiProtectionController,
    WikiUserController,
  ],
  providers: [
    WikiPageService,
    WikiEditService,
    WikiReviewService,
    WikiBlockService,
    WikiProtectionService,
    WikiRoleService,
    WikiRoleGuard,
  ],
  exports: [
    WikiPageService,
    WikiEditService,
    WikiReviewService,
    WikiBlockService,
    WikiProtectionService,
    WikiRoleService,
  ],
})
export class WikiModule {}
