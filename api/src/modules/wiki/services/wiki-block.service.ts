import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { UserEntity } from '../../auth/user.entity';
import { WikiBlockEntity } from '../entities/wiki-block.entity';

const VALID_SCOPES = new Set(['global', 'page', 'talk']);

@Injectable()
export class WikiBlockService {
  constructor(
    @InjectRepository(WikiBlockEntity)
    private readonly blockRepo: Repository<WikiBlockEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: {
      userId: string;
      scope: string;
      targetCharacterId?: string;
      reason: string;
      expiresAt?: string | null;
    },
  ): Promise<WikiBlockEntity> {
    if (!VALID_SCOPES.has(input.scope)) {
      throw new BadRequestException('scope 必须是 global / page / talk');
    }
    if (input.scope === 'page' && !input.targetCharacterId) {
      throw new BadRequestException('scope=page 必须给 targetCharacterId');
    }
    if (!input.reason?.trim()) {
      throw new BadRequestException('封禁必须填写理由');
    }
    if (input.userId === actor.id) {
      throw new BadRequestException('不能封禁自己');
    }
    const target = await this.userRepo.findOne({ where: { id: input.userId } });
    if (!target) {
      throw new NotFoundException('目标用户不存在');
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt 不是有效时间');
    }
    const entity = this.blockRepo.create({
      userId: input.userId,
      scope: input.scope,
      targetCharacterId:
        input.scope === 'page' ? input.targetCharacterId : null,
      reason: input.reason.trim(),
      createdBy: actor.id,
      expiresAt,
    });
    return this.blockRepo.save(entity);
  }

  async revoke(blockId: string, actor: AuthenticatedUser): Promise<void> {
    const block = await this.blockRepo.findOne({ where: { id: blockId } });
    if (!block) throw new NotFoundException('封禁记录不存在');
    if (block.revokedAt) {
      return;
    }
    block.revokedAt = new Date();
    block.revokedBy = actor.id;
    await this.blockRepo.save(block);
  }

  async list(input: { active?: boolean; userId?: string }): Promise<WikiBlockEntity[]> {
    const qb = this.blockRepo.createQueryBuilder('b').orderBy('b.createdAt', 'DESC');
    if (input.userId) {
      qb.andWhere('b.userId = :userId', { userId: input.userId });
    }
    if (input.active) {
      qb.andWhere('b.revokedAt IS NULL').andWhere(
        '(b.expiresAt IS NULL OR b.expiresAt > :now)',
        { now: new Date() },
      );
    }
    return qb.getMany();
  }

  async assertCanEdit(
    user: AuthenticatedUser,
    characterId: string,
  ): Promise<void> {
    const now = new Date();
    const active = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.userId = :uid', { uid: user.id })
      .andWhere('b.revokedAt IS NULL')
      .andWhere('(b.expiresAt IS NULL OR b.expiresAt > :now)', { now })
      .getMany();
    for (const block of active) {
      if (block.scope === 'global') {
        throw new ForbiddenException(
          `你已被全站封禁：${block.reason}${block.expiresAt ? `（到期 ${block.expiresAt.toISOString()}）` : ''}`,
        );
      }
      if (block.scope === 'page' && block.targetCharacterId === characterId) {
        throw new ForbiddenException(
          `你被禁止编辑此词条：${block.reason}${block.expiresAt ? `（到期 ${block.expiresAt.toISOString()}）` : ''}`,
        );
      }
    }
  }

  /** Sweep expired blocks: nothing to do at storage layer (queries already filter expiresAt),
   * but we expose this for visibility in the cron logs. */
  async countActive(): Promise<number> {
    const now = new Date();
    return this.blockRepo
      .createQueryBuilder('b')
      .where('b.revokedAt IS NULL')
      .andWhere('(b.expiresAt IS NULL OR b.expiresAt > :now)', { now })
      .getCount();
  }
}
