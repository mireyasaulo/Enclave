import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../auth/user.entity';
import { SYSTEM_BOT_ID, WIKI_SYSTEM_USERS } from '../seed/system-users.seed';

@Injectable()
export class WikiSystemUserService implements OnModuleInit {
  private readonly logger = new Logger(WikiSystemUserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const seed of WIKI_SYSTEM_USERS) {
      const existing = await this.userRepo.findOne({
        where: { id: seed.id! },
      });
      if (!existing) {
        await this.userRepo.save(this.userRepo.create(seed));
        this.logger.log(`Seeded wiki system user: ${seed.id}`);
      }
    }
  }

  /** Returns an AuthenticatedUser-shaped object for use as actor in service calls. */
  systemActor(id: string = SYSTEM_BOT_ID): {
    id: string;
    username: string;
    role: string;
    userType: string;
  } {
    return {
      id,
      username: '__system_wiki_antivandal_bot__',
      role: 'admin',
      userType: 'system',
    };
  }
}
