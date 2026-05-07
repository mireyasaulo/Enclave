import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterFriendshipEntity } from './character-friendship.entity';
import { CharacterEntity } from '../characters/character.entity';

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class CharacterFriendshipService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CharacterFriendshipService.name);

  constructor(
    @InjectRepository(CharacterFriendshipEntity)
    private readonly repo: Repository<CharacterFriendshipEntity>,
    @InjectRepository(CharacterEntity)
    private readonly charRepo: Repository<CharacterEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedFromAiRelationships();
    } catch (error) {
      this.logger.warn(
        `Failed to seed character_friendships from aiRelationships: ${
          (error as Error).message
        }`,
      );
    }
  }

  async seedFromAiRelationships(): Promise<number> {
    const existing = await this.repo.count();
    if (existing > 0) {
      return 0;
    }
    const characters = await this.charRepo.find();
    let inserted = 0;
    for (const char of characters) {
      const rels = char.aiRelationships ?? [];
      for (const rel of rels) {
        if (!rel?.characterId || rel.characterId === char.id) continue;
        const [a, b] = orderPair(char.id, rel.characterId);
        const exists = await this.repo.findOne({
          where: { characterAId: a, characterBId: b },
        });
        if (exists) continue;
        const intimacy = Math.max(
          0,
          Math.min(100, Math.round((rel.strength ?? 0) * 100)),
        );
        const entity = this.repo.create({
          characterAId: a,
          characterBId: b,
          intimacy,
          relationshipType: rel.relationshipType ?? 'friend',
        });
        await this.repo.save(entity);
        inserted += 1;
      }
    }
    if (inserted > 0) {
      this.logger.log(
        `Seeded ${inserted} character_friendships from aiRelationships`,
      );
    }
    return inserted;
  }

  async getFriendsOf(
    characterId: string,
  ): Promise<{ characterId: string; intimacy: number }[]> {
    const rows = await this.repo.find({
      where: [{ characterAId: characterId }, { characterBId: characterId }],
    });
    return rows.map((row) => ({
      characterId:
        row.characterAId === characterId ? row.characterBId : row.characterAId,
      intimacy: row.intimacy,
    }));
  }

  async getIntimacy(a: string, b: string): Promise<number> {
    if (a === b) return 0;
    const [x, y] = orderPair(a, b);
    const row = await this.repo.findOne({
      where: { characterAId: x, characterBId: y },
    });
    return row?.intimacy ?? 0;
  }

  async bumpInteraction(a: string, b: string, delta = 0.5): Promise<void> {
    if (a === b) return;
    const [x, y] = orderPair(a, b);
    const row = await this.repo.findOne({
      where: { characterAId: x, characterBId: y },
    });
    if (row) {
      row.intimacy = Math.max(0, Math.min(100, row.intimacy + delta));
      row.lastInteractedAt = new Date();
      await this.repo.save(row);
    } else {
      const fresh = this.repo.create({
        characterAId: x,
        characterBId: y,
        intimacy: Math.max(0, Math.min(100, delta)),
        relationshipType: 'acquaintance',
        lastInteractedAt: new Date(),
      });
      await this.repo.save(fresh);
    }
  }
}
