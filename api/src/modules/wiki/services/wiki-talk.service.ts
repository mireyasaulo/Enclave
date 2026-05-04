import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { WikiTalkPostEntity } from '../entities/wiki-talk-post.entity';
import { WikiTalkThreadEntity } from '../entities/wiki-talk-thread.entity';
import { rankOf } from '../guards/wiki-role.guard';
import { WikiBlockService } from './wiki-block.service';

@Injectable()
export class WikiTalkService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(WikiTalkThreadEntity)
    private readonly threadRepo: Repository<WikiTalkThreadEntity>,
    @InjectRepository(WikiTalkPostEntity)
    private readonly postRepo: Repository<WikiTalkPostEntity>,
    private readonly blocks: WikiBlockService,
  ) {}

  async listThreads(characterId: string): Promise<WikiTalkThreadEntity[]> {
    return this.threadRepo.find({
      where: { characterId },
      order: { lastReplyAt: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
  }

  async getThreadOrThrow(threadId: string): Promise<WikiTalkThreadEntity> {
    const t = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!t) throw new NotFoundException('讨论串不存在');
    return t;
  }

  async listPosts(threadId: string): Promise<WikiTalkPostEntity[]> {
    return this.postRepo.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
      take: 1000,
    });
  }

  async createThread(
    characterId: string,
    user: AuthenticatedUser,
    input: { title: string; body: string },
  ): Promise<{ thread: WikiTalkThreadEntity; firstPost: WikiTalkPostEntity }> {
    await this.assertCanTalk(user, characterId);
    const title = (input.title ?? '').trim();
    const body = (input.body ?? '').trim();
    if (!title) throw new BadRequestException('标题不能为空');
    if (!body) throw new BadRequestException('内容不能为空');
    if (title.length > 200) {
      throw new BadRequestException('标题最长 200 字');
    }

    return this.dataSource.transaction(async (manager) => {
      const thread = manager.create(WikiTalkThreadEntity, {
        characterId,
        title,
        authorId: user.id,
        isLocked: false,
        isResolved: false,
        postCount: 1,
        lastReplyAt: new Date(),
      });
      const savedThread = await manager.save(thread);
      const firstPost = manager.create(WikiTalkPostEntity, {
        threadId: savedThread.id,
        parentPostId: null,
        authorId: user.id,
        body,
      });
      const savedPost = await manager.save(firstPost);
      return { thread: savedThread, firstPost: savedPost };
    });
  }

  async createPost(
    threadId: string,
    user: AuthenticatedUser,
    input: { body: string; parentPostId?: string | null },
  ): Promise<WikiTalkPostEntity> {
    const thread = await this.getThreadOrThrow(threadId);
    if (thread.isLocked) {
      throw new ForbiddenException('讨论串已锁定');
    }
    await this.assertCanTalk(user, thread.characterId);
    const body = (input.body ?? '').trim();
    if (!body) throw new BadRequestException('回复内容不能为空');
    if (input.parentPostId) {
      const parent = await this.postRepo.findOne({
        where: { id: input.parentPostId },
      });
      if (!parent || parent.threadId !== threadId) {
        throw new BadRequestException('parentPostId 无效');
      }
    }
    return this.dataSource.transaction(async (manager) => {
      const post = manager.create(WikiTalkPostEntity, {
        threadId,
        parentPostId: input.parentPostId ?? null,
        authorId: user.id,
        body,
      });
      const saved = await manager.save(post);
      await manager.update(
        WikiTalkThreadEntity,
        { id: threadId },
        {
          postCount: thread.postCount + 1,
          lastReplyAt: new Date(),
        },
      );
      return saved;
    });
  }

  async setThreadFlags(
    threadId: string,
    actor: AuthenticatedUser,
    input: { isLocked?: boolean; isResolved?: boolean },
  ): Promise<WikiTalkThreadEntity> {
    if (rankOf(actor.role) < rankOf('patroller')) {
      throw new ForbiddenException('需要巡查员及以上权限');
    }
    const thread = await this.getThreadOrThrow(threadId);
    const patch: Partial<WikiTalkThreadEntity> = {};
    if (typeof input.isLocked === 'boolean') patch.isLocked = input.isLocked;
    if (typeof input.isResolved === 'boolean')
      patch.isResolved = input.isResolved;
    if (Object.keys(patch).length === 0) return thread;
    await this.threadRepo.update({ id: threadId }, patch);
    return (await this.threadRepo.findOne({ where: { id: threadId } }))!;
  }

  async deletePost(
    postId: string,
    actor: AuthenticatedUser,
  ): Promise<WikiTalkPostEntity> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('回复不存在');
    if (post.deletedAt) return post;
    const isOwner = post.authorId === actor.id;
    if (!isOwner && rankOf(actor.role) < rankOf('patroller')) {
      throw new ForbiddenException('只能删除自己的回复（巡查员及以上可删除任意）');
    }
    await this.postRepo.update(
      { id: postId },
      { deletedAt: new Date(), deletedBy: actor.id, body: '[已删除]' },
    );
    return (await this.postRepo.findOne({ where: { id: postId } }))!;
  }

  private async assertCanTalk(
    user: AuthenticatedUser,
    characterId: string,
  ): Promise<void> {
    const blocks = await this.blocks.list({ active: true, userId: user.id });
    for (const b of blocks) {
      if (b.scope === 'global') {
        throw new ForbiddenException(`你已被全站封禁：${b.reason}`);
      }
      if (b.scope === 'talk' && !b.targetCharacterId) {
        throw new ForbiddenException(`你已被禁言：${b.reason}`);
      }
      if (
        b.scope === 'page' &&
        b.targetCharacterId === characterId
      ) {
        throw new ForbiddenException(`你被禁止参与此词条：${b.reason}`);
      }
    }
  }
}
