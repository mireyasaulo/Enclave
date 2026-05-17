import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { FriendshipEntity } from './friendship.entity';

export type FriendRemarkMap = Map<string, string>;

@Injectable()
export class FriendRemarkResolver {
  constructor(
    @InjectRepository(FriendshipEntity)
    private readonly friendshipRepo: Repository<FriendshipEntity>,
  ) {}

  async getOwnerRemarkMap(ownerId: string): Promise<FriendRemarkMap> {
    const rows = await this.friendshipRepo.find({
      where: { ownerId, status: Not(In(['blocked', 'removed'])) },
      select: ['characterId', 'remarkName'],
    });
    const map: FriendRemarkMap = new Map();
    for (const row of rows) {
      const remark = row.remarkName?.trim();
      if (remark) {
        map.set(row.characterId, remark);
      }
    }
    return map;
  }

  // 走查新 R1：朋友圈"我不看 TA 的朋友圈"开关此前在前端能勾、后端能存到
  // friendship.momentsHiddenFromMe，但 moments.service 没有任何路径会读它——
  // canOwnerViewPost 只检查 blocked + isFriend，TA 过去/将来发的 moment 仍然
  // 原样返回给前端。复用 resolver 已经持有的 friendshipRepo，一次性把
  // owner 标了 hidden 的 characterId 集合返回，moments/feed 可以挂到
  // avatarContext 上做 Set.has() 过滤。
  async getMomentsHiddenFromMeCharacterIds(
    ownerId: string,
  ): Promise<Set<string>> {
    const rows = await this.friendshipRepo.find({
      where: {
        ownerId,
        status: Not(In(['blocked', 'removed'])),
        momentsHiddenFromMe: true,
      },
      select: ['characterId'],
    });
    return new Set(rows.map((row) => row.characterId));
  }

  // 走查 R2 复检：跟 momentsHiddenFromMe 对称。
  // friendship.momentsHiddenFromThem=true 表示用户在朋友权限里勾了「TA 看不到
  // 我的朋友圈」。但 npc autonomy tick / feed engagement 一直没读这个 flag，
  // 这位角色照样把用户最新 moment 点赞+评论。把这部分 char 从能看到用户
  // moment 的候选池里拿掉，让 UI 开关真的起作用。
  async getMomentsHiddenFromThemCharacterIds(
    ownerId: string,
  ): Promise<Set<string>> {
    const rows = await this.friendshipRepo.find({
      where: {
        ownerId,
        status: Not(In(['blocked', 'removed'])),
        momentsHiddenFromThem: true,
      },
      select: ['characterId'],
    });
    return new Set(rows.map((row) => row.characterId));
  }

  applyCharacterRemark(
    authorType: string | null | undefined,
    authorId: string | null | undefined,
    originalName: string,
    map: FriendRemarkMap | null | undefined,
  ): string {
    if (!map || !authorId) return originalName;
    if (authorType !== 'character') return originalName;
    return map.get(authorId) ?? originalName;
  }
}
