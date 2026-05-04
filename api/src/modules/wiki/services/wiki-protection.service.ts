import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Not, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { CharacterPageEntity } from '../entities/character-page.entity';
import { WikiProtectionLogEntity } from '../entities/wiki-protection-log.entity';
import { WikiPageService } from './wiki-page.service';

const VALID_LEVELS = new Set(['none', 'semi', 'full']);

@Injectable()
export class WikiProtectionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(WikiProtectionLogEntity)
    private readonly logRepo: Repository<WikiProtectionLogEntity>,
    private readonly pages: WikiPageService,
  ) {}

  async setProtection(
    characterId: string,
    actor: AuthenticatedUser,
    input: { level: string; expiresAt?: string | null; reason?: string | null },
  ): Promise<CharacterPageEntity> {
    if (!VALID_LEVELS.has(input.level)) {
      throw new BadRequestException('level 必须是 none / semi / full');
    }
    const page = await this.pages.getOrInitPage(characterId);
    const oldLevel = page.protectionLevel;
    const newLevel = input.level;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        CharacterPageEntity,
        { characterId },
        {
          protectionLevel: newLevel,
          protectionExpiresAt: newLevel === 'none' ? null : expiresAt,
          protectionReason: newLevel === 'none' ? null : input.reason ?? null,
        },
      );
      await manager.save(
        manager.create(WikiProtectionLogEntity, {
          characterId,
          oldLevel,
          newLevel,
          changedBy: actor.id,
          reason: input.reason ?? null,
          expiresAt,
        }),
      );
    });

    return (await this.pageRepo.findOne({ where: { characterId } }))!;
  }

  async listLogs(characterId: string, limit = 50): Promise<WikiProtectionLogEntity[]> {
    return this.logRepo.find({
      where: { characterId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Cron-callable: any non-'none' page whose expiresAt has passed gets reset to 'none'. */
  async sweepExpired(): Promise<number> {
    const now = new Date();
    const expired = await this.pageRepo.find({
      where: {
        protectionLevel: Not('none'),
        protectionExpiresAt: LessThan(now),
      },
    });
    if (expired.length === 0) return 0;
    await this.dataSource.transaction(async (manager) => {
      for (const page of expired) {
        await manager.update(
          CharacterPageEntity,
          { characterId: page.characterId },
          {
            protectionLevel: 'none',
            protectionExpiresAt: null,
            protectionReason: null,
          },
        );
        await manager.save(
          manager.create(WikiProtectionLogEntity, {
            characterId: page.characterId,
            oldLevel: page.protectionLevel,
            newLevel: 'none',
            changedBy: 'system_cron_expiry',
            reason: '保护期到期自动解除',
            expiresAt: null,
          }),
        );
      }
    });
    return expired.length;
  }
}
