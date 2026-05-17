// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharactersService } from '../../characters/characters.service';
import { ParkingWarNpcStateEntity } from './entities/parking-war-npc-state.entity';
import { ParkingWarPlayerStateEntity } from './entities/parking-war-player-state.entity';
import { PARKING_WAR_LEADERBOARD_TOTAL_WEIGHT_BP } from './parking-war.constants';
import type {
  ParkingWarCarTier,
  ParkingWarLeaderboardRow,
  ParkingWarOwnedCar,
  ParkingWarRarity,
} from './parking-war.types';

@Injectable()
export class ParkingWarLeaderboardService {
  constructor(
    @InjectRepository(ParkingWarPlayerStateEntity)
    private readonly playerRepo: Repository<ParkingWarPlayerStateEntity>,
    @InjectRepository(ParkingWarNpcStateEntity)
    private readonly npcRepo: Repository<ParkingWarNpcStateEntity>,
    private readonly charactersService: CharactersService,
  ) {}

  /**
   * scope:
   *   'global'  — 所有玩家 + 所有 NPC（按 score 排）
   *   'friends' — 当前玩家 + 自己 world 里的 NPC（默认 50 行）
   */
  async getRichBoard(
    ownerId: string,
    scope: 'global' | 'friends',
    limit: number = 50,
  ): Promise<ParkingWarLeaderboardRow[]> {
    const players = await this.playerRepo.find(
      scope === 'global' ? undefined : { where: { ownerId } },
    );
    const npcs = await this.npcRepo.find(
      scope === 'global' ? undefined : { where: { ownerId } },
    );

    const rows: Array<ParkingWarLeaderboardRow & { score: number }> = [];

    for (const p of players) {
      rows.push({
        rank: 0,
        actorKind: 'player',
        actorId: p.ownerId,
        actorName: scope === 'friends' ? '我' : `世界主人 ${p.ownerId.slice(-4)}`,
        actorAvatar: null,
        balanceCents: p.balanceCents,
        totalEarnedCents: p.totalEarnedCents,
        topCarTier: topCarTier(p.ownedCarsPayload),
        topCarRarity: topCarRarity(p.ownedCarsPayload),
        score: scoreOf(p.balanceCents, p.totalEarnedCents),
      });
    }

    if (npcs.length > 0) {
      const charIds = Array.from(new Set(npcs.map((n) => n.characterId)));
      const charsRaw = await this.charactersService.findManyByIds(charIds);
      const charMap = new Map(charsRaw.map((c) => [c.id, c]));
      for (const n of npcs) {
        const ch = charMap.get(n.characterId);
        rows.push({
          rank: 0,
          actorKind: 'npc',
          actorId: n.characterId,
          actorName: ch?.name ?? n.characterId,
          actorAvatar: ch?.avatar ?? null,
          balanceCents: n.balanceCents,
          totalEarnedCents: n.totalEarnedCents,
          topCarTier: topCarTier(n.ownedCarsPayload),
          topCarRarity: topCarRarity(n.ownedCarsPayload),
          score: scoreOf(n.balanceCents, n.totalEarnedCents),
        });
      }
    }

    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, limit).map((r, idx) => {
      const { score: _drop, ...rest } = r;
      return { ...rest, rank: idx + 1 };
    });
  }
}

function scoreOf(balanceCents: number, totalEarnedCents: number): number {
  return balanceCents + (totalEarnedCents * PARKING_WAR_LEADERBOARD_TOTAL_WEIGHT_BP) / 10_000;
}

function topCarTier(
  cars: ParkingWarOwnedCar[] | null | undefined,
): ParkingWarCarTier | null {
  const top = sortCarsByValue(cars)[0];
  return top?.tier ?? null;
}

function topCarRarity(
  cars: ParkingWarOwnedCar[] | null | undefined,
): ParkingWarRarity | null {
  const top = sortCarsByValue(cars)[0];
  return top?.rarity ?? null;
}

function sortCarsByValue(
  cars: ParkingWarOwnedCar[] | null | undefined,
): ParkingWarOwnedCar[] {
  if (!cars || cars.length === 0) return [];
  const tierRank = (t: ParkingWarCarTier) =>
    ['starter', 'family', 'business', 'performance', 'luxury', 'super'].indexOf(t);
  const rarityRank = (r: ParkingWarRarity) =>
    ['common', 'rare', 'epic', 'legend'].indexOf(r);
  return [...cars].sort(
    (a, b) =>
      rarityRank(b.rarity) - rarityRank(a.rarity) ||
      tierRank(b.tier) - tierRank(a.tier) ||
      b.level - a.level,
  );
}
// i18n-ignore-end
