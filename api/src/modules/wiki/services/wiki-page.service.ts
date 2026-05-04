import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterEntity } from '../../characters/character.entity';
import { CharacterPageEntity } from '../entities/character-page.entity';
import {
  CharacterRevisionEntity,
  type WikiContentSnapshot,
} from '../entities/character-revision.entity';
import { snapshotFromCharacter } from '../wiki.types';

export type WikiPageView = {
  characterId: string;
  page: CharacterPageEntity;
  currentRevision: CharacterRevisionEntity | null;
  content: WikiContentSnapshot;
  exists: boolean;
};

@Injectable()
export class WikiPageService {
  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characterRepo: Repository<CharacterEntity>,
    @InjectRepository(CharacterPageEntity)
    private readonly pageRepo: Repository<CharacterPageEntity>,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
  ) {}

  async getOrInitPage(characterId: string): Promise<CharacterPageEntity> {
    let page = await this.pageRepo.findOne({ where: { characterId } });
    if (page) return page;
    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    if (!character) {
      throw new NotFoundException(`角色 ${characterId} 不存在`);
    }
    page = this.pageRepo.create({
      characterId,
      currentRevisionId: null,
      protectionLevel: character.sourceType === 'ai_generated' ? 'semi' : 'none',
      isPatrolled: false,
      watcherCount: 0,
      editCount: 0,
      isDeleted: false,
    });
    return this.pageRepo.save(page);
  }

  async getPageView(characterId: string): Promise<WikiPageView> {
    const character = await this.characterRepo.findOne({
      where: { id: characterId },
    });
    if (!character) {
      throw new NotFoundException(`角色 ${characterId} 不存在`);
    }
    const page = await this.getOrInitPage(characterId);
    let currentRevision: CharacterRevisionEntity | null = null;
    if (page.currentRevisionId) {
      currentRevision = await this.revisionRepo.findOne({
        where: { id: page.currentRevisionId },
      });
    }
    const content = currentRevision
      ? currentRevision.contentSnapshot
      : snapshotFromCharacter(character as unknown as Record<string, unknown>);
    return {
      characterId,
      page,
      currentRevision,
      content,
      exists: !page.isDeleted,
    };
  }

  async getHistory(
    characterId: string,
    limit = 50,
  ): Promise<CharacterRevisionEntity[]> {
    return this.revisionRepo.find({
      where: { characterId },
      order: { version: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async getRevisionOrThrow(id: string): Promise<CharacterRevisionEntity> {
    const rev = await this.revisionRepo.findOne({ where: { id } });
    if (!rev) throw new NotFoundException(`版本 ${id} 不存在`);
    return rev;
  }

  async listRecentChanges(input: {
    limit?: number;
    onlyUnpatrolled?: boolean;
  }): Promise<CharacterRevisionEntity[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const qb = this.revisionRepo
      .createQueryBuilder('r')
      .leftJoin(
        CharacterPageEntity,
        'p',
        'p.characterId = r.characterId',
      )
      .where('(p.isDeleted = 0 OR p.isDeleted IS NULL)')
      .orderBy('r.createdAt', 'DESC')
      .take(limit);
    if (input.onlyUnpatrolled) {
      qb.andWhere('r.status = :status AND r.isPatrolled = :patrolled', {
        status: 'approved',
        patrolled: false,
      });
    } else {
      qb.andWhere('r.status IN (:...statuses)', {
        statuses: ['approved', 'pending', 'reverted'],
      });
    }
    return qb.getMany();
  }

  async search(query: string, limit = 20): Promise<
    Array<{
      characterId: string;
      name: string;
      bio: string;
      relationship: string;
      score: number;
    }>
  > {
    const q = query.trim();
    if (!q) return [];
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const rows = await this.characterRepo
      .createQueryBuilder('c')
      .leftJoin(
        CharacterPageEntity,
        'p',
        'p.characterId = c.id',
      )
      .where('(p.isDeleted = 0 OR p.isDeleted IS NULL)')
      .andWhere(
        '(c.name LIKE :like ESCAPE \'\\\\\' OR c.bio LIKE :like ESCAPE \'\\\\\' OR c.personality LIKE :like ESCAPE \'\\\\\' OR c.expertDomains LIKE :like ESCAPE \'\\\\\')',
        { like },
      )
      .select([
        'c.id AS id',
        'c.name AS name',
        'c.bio AS bio',
        'c.relationship AS relationship',
        'c.personality AS personality',
        'c.expertDomains AS expertDomains',
      ])
      .limit(Math.min(Math.max(limit, 1), 100))
      .getRawMany<{
        id: string;
        name: string;
        bio: string;
        relationship: string;
        personality: string | null;
        expertDomains: string;
      }>();

    const lower = q.toLowerCase();
    return rows
      .map((r) => {
        let score = 0;
        if (r.name?.toLowerCase().includes(lower)) score += 10;
        if (r.bio?.toLowerCase().includes(lower)) score += 3;
        if (r.personality?.toLowerCase().includes(lower)) score += 2;
        if (r.expertDomains?.toLowerCase().includes(lower)) score += 5;
        return {
          characterId: r.id,
          name: r.name,
          bio: r.bio,
          relationship: r.relationship,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  async setDeletedFlag(
    characterId: string,
    actorId: string,
    isDeleted: boolean,
  ): Promise<CharacterPageEntity> {
    const page = await this.getOrInitPage(characterId);
    if (page.isDeleted === isDeleted) return page;
    await this.pageRepo.update(
      { characterId },
      {
        isDeleted,
        deletedAt: isDeleted ? new Date() : null,
        deletedBy: isDeleted ? actorId : null,
      },
    );
    return (await this.pageRepo.findOne({ where: { characterId } }))!;
  }
}
