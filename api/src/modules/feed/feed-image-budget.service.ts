// i18n-ignore-start: internal service — no user-facing strings.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedPostEntity } from './feed-post.entity';
import { CharactersService } from '../characters/characters.service';
import { todayInShanghai } from '../minimax/minimax-quota.service';

// 单 world 的"角色朋友圈自动配图"日上限。cloud-api dispatcher 启动 child 时按
// 全 world 数均分 50 张/天注入 env；未注入时回落到 50（视作单 world 部署）。
const FEED_IMAGE_WORLD_DAILY_SHARE_FALLBACK = 50;

function readWorldDailyShare(): number {
  const raw = process.env.FEED_IMAGE_WORLD_DAILY_SHARE;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return FEED_IMAGE_WORLD_DAILY_SHARE_FALLBACK;
}

@Injectable()
export class FeedImageBudgetService {
  private readonly logger = new Logger(FeedImageBudgetService.name);

  constructor(
    @InjectRepository(FeedPostEntity)
    private readonly postRepo: Repository<FeedPostEntity>,
    private readonly characters: CharactersService,
  ) {}

  // 动态优先级均分准入：仅当 `characterId` 今天的配图数 == 候选 NPC 的最小配图数
  // 时才放行。这样保证：配额够用时每个 active NPC 至少 1 张；配额不够时优先
  // 让"今天还没配过图的角色"拿名额；全员各 1 张后才开放第 2 轮。
  //
  // 返回 true 不预留计数——后续 generateImage / createPost 自己串行落盘，
  // 高并发下"准入 + 实际生图"非事务，允许轻微超出 worldShare 1-2 张，可接受。
  async tryAllocate(characterId: string): Promise<boolean> {
    const worldShare = readWorldDailyShare();
    if (worldShare <= 0) return false;

    const dayStart = new Date(`${todayInShanghai()}T00:00:00+08:00`);

    // 今日本 world 各 NPC 已生成的带图 feed post（按 authorId 聚合）
    const cntRows = await this.postRepo
      .createQueryBuilder('post')
      .select('post.authorId', 'authorId')
      .addSelect('COUNT(*)', 'cnt')
      .where('post.authorType = :ct', { ct: 'character' })
      .andWhere('post.surface = :s', { s: 'feed' })
      .andWhere('post.mediaType = :m', { m: 'image' })
      .andWhere('post.createdAt >= :start', { start: dayStart })
      .groupBy('post.authorId')
      .getRawMany<{ authorId: string; cnt: string | number }>();

    const cntByAuthor = new Map<string, number>();
    let totalUsed = 0;
    for (const row of cntRows) {
      const c = Number(row.cnt) || 0;
      cntByAuthor.set(row.authorId, c);
      totalUsed += c;
    }

    if (totalUsed >= worldShare) {
      this.logger.debug?.(
        `feed image budget exhausted: totalUsed=${totalUsed} >= worldShare=${worldShare}`,
      );
      return false;
    }

    const selfCount = cntByAuthor.get(characterId) ?? 0;

    // 候选集 = feedFrequency>0 的 NPC ∪ 今天发过任意 feed_post 的 NPC，
    // 再 ∪ 当前请求的 character 本身（确保被纳入比较）。
    const visibleChars = await this.characters.findAllVisibleToOwner();
    const candidateIds = new Set<string>();
    for (const ch of visibleChars) {
      if (ch.feedFrequency > 0) candidateIds.add(ch.id);
    }
    const todayAuthorRows = await this.postRepo
      .createQueryBuilder('post')
      .select('DISTINCT post.authorId', 'authorId')
      .where('post.authorType = :ct', { ct: 'character' })
      .andWhere('post.surface = :s', { s: 'feed' })
      .andWhere('post.createdAt >= :start', { start: dayStart })
      .getRawMany<{ authorId: string }>();
    for (const row of todayAuthorRows) candidateIds.add(row.authorId);
    candidateIds.add(characterId);

    if (candidateIds.size === 0) return false;

    let minCount = Number.POSITIVE_INFINITY;
    for (const id of candidateIds) {
      const c = cntByAuthor.get(id) ?? 0;
      if (c < minCount) minCount = c;
    }

    return selfCount === minCount;
  }
}
// i18n-ignore-end
