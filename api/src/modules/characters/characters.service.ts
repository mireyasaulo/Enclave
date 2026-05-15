import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/app-error.exception';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CharacterEntity } from './character.entity';
import { PersonalityProfile } from '../ai/ai.types';
import { applyPersistentNaturalDialogueProfile } from '../ai/prompt-naturalness';
import { ConversationEntity } from '../chat/conversation.entity';
import { MessageEntity } from '../chat/message.entity';
import { GroupEntity } from '../chat/group.entity';
import { GroupMemberEntity } from '../chat/group-member.entity';
import { GroupMessageEntity } from '../chat/group-message.entity';
import { FriendshipEntity } from '../social/friendship.entity';
import { FriendRequestEntity } from '../social/friend-request.entity';
import { AIRelationshipEntity } from '../social/ai-relationship.entity';
import { NarrativeArcEntity } from '../narrative/narrative-arc.entity';
import { CharacterBlueprintEntity } from './character-blueprint.entity';
import { CharacterBlueprintRevisionEntity } from './character-blueprint-revision.entity';
import { CharacterBlueprintService } from './character-blueprint.service';
import type { CharacterBlueprintRecipeValue } from './character-blueprint.types';
import { MomentPostEntity } from '../moments/moment-post.entity';
import { MomentCommentEntity } from '../moments/moment-comment.entity';
import { MomentLikeEntity } from '../moments/moment-like.entity';
import { FeedPostEntity } from '../feed/feed-post.entity';
import { FeedCommentEntity } from '../feed/feed-comment.entity';
import { VideoChannelFollowEntity } from '../feed/video-channel-follow.entity';
import { UserFeedInteractionEntity } from '../analytics/user-feed-interaction.entity';
import { AIBehaviorLogEntity } from '../analytics/ai-behavior-log.entity';
import { ModerationReportEntity } from '../moderation/moderation-report.entity';
import { WorldOwnerService } from '../auth/world-owner.service';
import { NeedDiscoveryCandidateEntity } from '../need-discovery/need-discovery-candidate.entity';
import { RealWorldRuntimeProfileService } from '../real-world-sync/real-world-runtime-profile.service';
import {
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
  buildDefaultCharacters,
  DEFAULT_CHARACTER_IDS,
} from './default-characters';
import {
  getCelebrityCharacterPresetGroup,
} from './celebrity-character-presets';
import {
  BUILT_IN_CHARACTER_PRESETS,
  getBuiltInCharacterPreset,
} from './built-in-character-presets';
import { maybeGetCharacterAvatarBySourceKey } from './character-avatar-assets';

export type Character = CharacterEntity;

@Injectable()
export class CharactersService implements OnModuleInit {
  constructor(
    @InjectRepository(CharacterEntity)
    private repo: Repository<CharacterEntity>,
    @InjectRepository(FriendshipEntity)
    private readonly friendshipRepo: Repository<FriendshipEntity>,
    private readonly worldOwnerService: WorldOwnerService,
    private readonly dataSource: DataSource,
    private readonly realWorldRuntimeProfile: RealWorldRuntimeProfileService,
    private readonly blueprintService: CharacterBlueprintService,
  ) {}

  async onModuleInit() {
    await this.backfillCharacterAvatarAssets();
  }

  async findAll(): Promise<CharacterEntity[]> {
    const characters = await this.repo.find({ order: { name: 'ASC' } });
    return this.normalizeCharacterAvatars(characters);
  }

  async findById(id: string): Promise<CharacterEntity | null> {
    const character = await this.repo.findOneBy({ id });
    return this.normalizeCharacterAvatar(character);
  }

  async findAllVisibleToOwner(ownerId?: string): Promise<CharacterEntity[]> {
    const characters = await this.findAll();
    return this.filterNeedGeneratedVisibility(characters, ownerId);
  }

  async isVisibleToOwner(
    characterId: string,
    ownerId?: string,
  ): Promise<boolean> {
    const character = await this.findById(characterId);
    if (!character) {
      return false;
    }

    if (character.sourceType !== 'need_generated') {
      return true;
    }

    const activeFriendCharacterIds =
      await this.getActiveFriendCharacterIdSet(ownerId);
    return activeFriendCharacterIds.has(characterId);
  }

  async findByDomains(domains: string[]): Promise<CharacterEntity[]> {
    const all = await this.findAll();
    return all.filter((c) => c.expertDomains.some((d) => domains.includes(d)));
  }

  async getProfile(id: string): Promise<PersonalityProfile | undefined> {
    const char = await this.repo.findOneBy({ id });
    return this.getRuntimeProfileFromCharacter(char);
  }

  async getRuntimeProfileFromCharacter(
    character: Pick<CharacterEntity, 'id' | 'profile'> | null | undefined,
  ): Promise<PersonalityProfile | undefined> {
    return this.realWorldRuntimeProfile.buildRuntimeProfileFromCharacter(
      character,
    );
  }

  async upsert(character: CharacterEntity): Promise<void> {
    await this.repo.save(character);
  }

  /**
   * 返回世界角色目录中所有内置角色的完整数据（不查 DB）。
   * 默认保底角色和内置目录角色都会包含在内。
   */
  listPresetCatalog(): CharacterEntity[] {
    const seen = new Set<string>();
    const catalogCharacters = [
      ...buildDefaultCharacters(),
      ...BUILT_IN_CHARACTER_PRESETS.map(
        (preset) => preset.character as CharacterEntity,
      ),
    ].filter((character): character is CharacterEntity => {
      if (!character?.id || seen.has(character.id)) {
        return false;
      }

      seen.add(character.id);
      return true;
    });

    return this.normalizeCharacterAvatars(catalogCharacters);
  }

  /**
   * 确保预设角色已写入 DB。
   * - 已存在：直接返回 DB 记录（保留管理员改动）
   * - 不存在但匹配预设：从硬编码安装后返回
   * - 不是预设角色：返回 null（自定义角色应已在 DB）
   */
  async ensurePresetCharacterInstalled(
    characterId: string,
  ): Promise<CharacterEntity | null> {
    const existing = await this.repo.findOneBy({ id: characterId });
    if (existing) return this.normalizeCharacterAvatar(existing);

    const preset = BUILT_IN_CHARACTER_PRESETS.find((p) => p.id === characterId);
    if (!preset) return null;

    return this.materializePresetCharacter(preset);
  }

  async listCelebrityPresets() {
    // 既要看常规 preset_catalog 安装记录，也要看 BUILT_IN 里 autoSeed:false
    // 但 ID 已经在 DB 里的居民（典型代表：林医生 / 简衡 走 default-characters.ts
    // 的 protected default_seed 落库，不是 preset_catalog）。否则这些角色在
    // 目录里会被错误展示成"未安装 + 可安装"按钮。
    const presetIds = BUILT_IN_CHARACTER_PRESETS.map((preset) => preset.id);
    const installedCharacters = await this.repo.find({
      where: [
        { sourceType: 'preset_catalog' },
        { id: In(presetIds) },
      ],
    });
    const installedById = new Map(
      installedCharacters.map((character) => [
        character.id,
        { id: character.id, name: character.name },
      ]),
    );
    const installedBySourceKey = new Map(
      installedCharacters
        .filter((character) => character.sourceKey)
        .map((character) => [
          character.sourceKey as string,
          { id: character.id, name: character.name },
        ]),
    );

    return BUILT_IN_CHARACTER_PRESETS.map((preset) => {
      const group = getCelebrityCharacterPresetGroup(preset.groupKey);
      const installedCharacter =
        installedById.get(preset.id) ??
        installedBySourceKey.get(preset.presetKey);
      return {
        presetKey: preset.presetKey,
        groupKey: group.key,
        autoSeed: preset.autoSeed !== false,
        groupLabel: group.label,
        groupDescription: group.description,
        groupOrder: group.sortOrder,
        id: preset.id,
        name: preset.name,
        avatar: preset.avatar,
        relationship: preset.relationship,
        description: preset.description,
        expertDomains: preset.expertDomains,
        installed: Boolean(installedCharacter),
        installedCharacterId: installedCharacter?.id ?? null,
        installedCharacterName: installedCharacter?.name ?? null,
      };
    });
  }

  async installCelebrityPreset(presetKey: string): Promise<CharacterEntity> {
    const preset = getBuiltInCharacterPreset(presetKey);
    if (!preset) {
      throw new AppError('PRESET_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        params: { presetKey },
        legacyMessage: `Preset ${presetKey} not found`,
      });
    }

    return this.materializePresetCharacter(preset);
  }

  private async materializePresetCharacter(
    preset: NonNullable<ReturnType<typeof getBuiltInCharacterPreset>>,
  ): Promise<CharacterEntity> {
    const existing = await this.repo.findOne({
      where: [
        { id: preset.id },
        { sourceType: 'preset_catalog', sourceKey: preset.presetKey },
      ],
    });
    if (existing) {
      return this.normalizeCharacterAvatar(existing) ?? existing;
    }

    return this.repo.save(
      this.repo.create({
        ...preset.character,
        id: preset.id,
        profile: preset.character.profile
          ? applyPersistentNaturalDialogueProfile(preset.character.profile)
          : preset.character.profile,
        sourceType: 'preset_catalog',
        sourceKey: preset.presetKey,
        deletionPolicy: 'archive_allowed',
        isTemplate: false,
      }),
    );
  }

  async installCelebrityPresetBatch(presetKeys: string[]) {
    const normalizedPresetKeys = Array.from(
      new Set(
        presetKeys
          .map((presetKey) => presetKey.trim())
          .filter((presetKey) => presetKey.length > 0),
      ),
    );
    if (normalizedPresetKeys.length === 0) {
      throw new AppError('PRESET_AT_LEAST_ONE', {
        legacyMessage: '至少选择一个预设角色。',
      });
    }

    const missingPresetKeys = normalizedPresetKeys.filter(
      (presetKey) => !getBuiltInCharacterPreset(presetKey),
    );
    if (missingPresetKeys.length > 0) {
      throw new AppError('PRESET_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        params: { presetKey: missingPresetKeys.join(', ') },
        legacyMessage: `Preset ${missingPresetKeys.join(', ')} not found`,
      });
    }

    const installedCharacters = await Promise.all(
      normalizedPresetKeys.map((presetKey) =>
        this.installCelebrityPreset(presetKey),
      ),
    );

    return {
      presetKeys: normalizedPresetKeys,
      installedCount: installedCharacters.length,
      installedCharacters,
    };
  }

  async delete(id: string): Promise<void> {
    const character = await this.repo.findOneBy({ id });
    if (!character) {
      return;
    }

    if (
      character.deletionPolicy === 'protected' ||
      (DEFAULT_CHARACTER_IDS as readonly string[]).includes(id)
    ) {
      throw new AppError('CHARACTER_DEFAULT_NOT_DELETABLE', {
        legacyMessage: '默认保底角色不可删除。',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      const conversationRepo = manager.getRepository(ConversationEntity);
      const messageRepo = manager.getRepository(MessageEntity);
      const groupRepo = manager.getRepository(GroupEntity);
      const groupMemberRepo = manager.getRepository(GroupMemberEntity);
      const groupMessageRepo = manager.getRepository(GroupMessageEntity);
      const friendRequestRepo = manager.getRepository(FriendRequestEntity);
      const friendshipRepo = manager.getRepository(FriendshipEntity);
      const aiRelationshipRepo = manager.getRepository(AIRelationshipEntity);
      const narrativeArcRepo = manager.getRepository(NarrativeArcEntity);
      const blueprintRepo = manager.getRepository(CharacterBlueprintEntity);
      const blueprintRevisionRepo = manager.getRepository(
        CharacterBlueprintRevisionEntity,
      );
      const momentPostRepo = manager.getRepository(MomentPostEntity);
      const momentCommentRepo = manager.getRepository(MomentCommentEntity);
      const momentLikeRepo = manager.getRepository(MomentLikeEntity);
      const feedPostRepo = manager.getRepository(FeedPostEntity);
      const feedCommentRepo = manager.getRepository(FeedCommentEntity);
      const videoChannelFollowRepo = manager.getRepository(
        VideoChannelFollowEntity,
      );
      const feedInteractionRepo = manager.getRepository(
        UserFeedInteractionEntity,
      );
      const aiBehaviorLogRepo = manager.getRepository(AIBehaviorLogEntity);
      const moderationReportRepo = manager.getRepository(
        ModerationReportEntity,
      );
      const needDiscoveryCandidateRepo = manager.getRepository(
        NeedDiscoveryCandidateEntity,
      );
      const characterRepo = manager.getRepository(CharacterEntity);

      const directConversations = (await conversationRepo.find()).filter(
        (conversation) =>
          conversation.type !== 'group' &&
          conversation.participants.includes(id),
      );
      const directConversationIds = directConversations.map(
        (conversation) => conversation.id,
      );

      if (directConversationIds.length > 0) {
        await messageRepo.delete({
          conversationId: In(directConversationIds),
        });
        await conversationRepo.delete({ id: In(directConversationIds) });
      }

      const createdGroups = await groupRepo.find({
        where: { creatorId: id, creatorType: 'character' },
      });
      const createdGroupIds = createdGroups.map((group) => group.id);
      if (createdGroupIds.length > 0) {
        await groupMessageRepo.delete({ groupId: In(createdGroupIds) });
        await groupMemberRepo.delete({ groupId: In(createdGroupIds) });
        await groupRepo.delete({ id: In(createdGroupIds) });
      }

      await groupMessageRepo.delete({ senderId: id, senderType: 'character' });
      await groupMemberRepo.delete({ memberId: id, memberType: 'character' });

      const momentPostIds = (
        await momentPostRepo.find({
          where: { authorId: id, authorType: 'character' },
        })
      ).map((post) => post.id);

      await momentCommentRepo.delete({ authorId: id, authorType: 'character' });
      await momentLikeRepo.delete({ authorId: id, authorType: 'character' });
      if (momentPostIds.length > 0) {
        await momentCommentRepo.delete({ postId: In(momentPostIds) });
        await momentLikeRepo.delete({ postId: In(momentPostIds) });
        await momentPostRepo.delete({ id: In(momentPostIds) });
      }

      const feedPostIds = (
        await feedPostRepo.find({
          where: { authorId: id, authorType: 'character' },
        })
      ).map((post) => post.id);

      await feedCommentRepo.delete({ authorId: id, authorType: 'character' });
      if (feedPostIds.length > 0) {
        await feedCommentRepo.delete({ postId: In(feedPostIds) });
        await feedInteractionRepo.delete({ postId: In(feedPostIds) });
        await feedPostRepo.delete({ id: In(feedPostIds) });
      }

      await friendRequestRepo.delete({ characterId: id });
      await friendshipRepo.delete({ characterId: id });
      await videoChannelFollowRepo.delete({
        authorId: id,
        authorType: 'character',
      });
      await narrativeArcRepo.delete({ characterId: id });
      await aiBehaviorLogRepo.delete({ characterId: id });
      await moderationReportRepo.delete({
        targetType: 'character',
        targetId: id,
      });
      await blueprintRevisionRepo.delete({ characterId: id });
      await blueprintRepo.delete({ characterId: id });
      await aiRelationshipRepo
        .createQueryBuilder()
        .delete()
        .where('characterIdA = :id OR characterIdB = :id', { id })
        .execute();
      await needDiscoveryCandidateRepo
        .createQueryBuilder()
        .update()
        .set({
          status: 'deleted',
          deletedAt: new Date(),
        })
        .where('characterId = :id', { id })
        .andWhere('status NOT IN (:...lockedStatuses)', {
          lockedStatuses: ['declined', 'expired', 'deleted'],
        })
        .execute();
      await characterRepo.delete(id);
    });
  }

  /**
   * 从 wiki 导出的 JSON bundle 导入私有角色到当前 world：
   * - 按 name 找现存：仅当 sourceType='private_import' 才覆盖；
   *   命中其他来源（preset/built-in/admin/seed）抛 Conflict，避免静默改写
   *   全 world 共用的内置角色。
   * - 不存在→新建；新建始终 sourceType='private_import'，sourceKey=name。
   * - 有 recipe 但无 profile 时：用 blueprint service 从 recipe 推 profile，
   *   避免用户写的 prompt 配方被静默丢弃（旧版只取 profile，recipe 直接吃）。
   * - 自动给 world-owner 建 friendship（已存在保留 intimacy/status，软删则激活）。
   *
   * undefined 字段 = "bundle 里没写"，对已存在角色不动；string '' / [] / {} =
   * 显式置空。这样保证 round-trip 后未提供的字段不会被意外清空。
   */
  async importPersonalCharacter(input: {
    name: string;
    avatar?: string;
    bio?: string;
    personality?: string | null;
    relationship?: string;
    relationshipType?: string;
    expertDomains?: string[];
    triggerScenes?: string[] | null;
    recipe?: CharacterBlueprintRecipeValue | null;
    profile?: PersonalityProfile | null;
    isOnline?: boolean;
    onlineMode?: string;
    activityMode?: string;
    currentActivity?: string | null;
    sourceType?: string;
    sourceKey?: string | null;
    deletionPolicy?: string;
    isTemplate?: boolean;
    socialOpenness?: string;
    proactiveBrowseChance?: number;
    intimacyLevel?: number;
    aiRelationships?:
      | { characterId: string; relationshipType: string; strength: number }[]
      | null;
  }): Promise<{ character: CharacterEntity; overwrote: boolean }> {
    const trimmedName = (input.name ?? '').trim();
    if (!trimmedName) {
      throw new AppError('PRIVATE_IMPORT_INVALID', {
        status: HttpStatus.BAD_REQUEST,
        legacyMessage: '导入文件缺少 name 字段。',
      });
    }
    // 防御性长度校验：DB 是 text 列没硬限，但用户填的 bio/persona 直接拼到
    // AI prompt 里，过长会撑爆 context cost；同时 60+KB 的 recipe/profile JSON
    // 几乎一定是误传。在这里挡一道，比上线后被 prompt cost 烧出 P0 强。
    assertPrivateCharacterFieldLimits(input);

    const existing = await this.repo.findOne({
      where: { name: trimmedName },
    });

    if (existing) {
      // protected：默认保底角色（"我自己"等），任何情况都不能覆盖
      if (existing.deletionPolicy === 'protected') {
        throw new AppError('PRIVATE_IMPORT_NAME_RESERVED', {
          status: HttpStatus.CONFLICT,
          legacyMessage: `世界里已存在受保护的同名角色 "${trimmedName}"，无法覆盖。请改用其他名字。`,
        });
      }
      // 非 private_import 来源（preset/built-in/admin 等）：理论上和用户私有
      // 角色无关，但 name 撞上后旧逻辑会静默覆盖、影响全 world。改为拒绝。
      if (existing.sourceType !== 'private_import') {
        throw new AppError('PRIVATE_IMPORT_NAME_RESERVED', {
          status: HttpStatus.CONFLICT,
          legacyMessage: `世界里已存在同名角色 "${trimmedName}"（${existing.sourceType}），不能覆盖。请改用其他名字。`,
        });
      }
    }

    // Patch：只放 input 里"实际提供"的字段；undefined 表示缺失，跳过。
    const patch: Partial<CharacterEntity> = {};
    if (typeof input.avatar === 'string') patch.avatar = input.avatar;
    if (typeof input.bio === 'string') patch.bio = input.bio;
    if (input.personality !== undefined) {
      patch.personality = input.personality ?? undefined;
    }
    if (typeof input.relationship === 'string') {
      patch.relationship = input.relationship;
    }
    if (typeof input.relationshipType === 'string') {
      patch.relationshipType = input.relationshipType;
    }
    if (Array.isArray(input.expertDomains)) {
      patch.expertDomains = input.expertDomains;
    }
    if (input.triggerScenes !== undefined) {
      patch.triggerScenes = input.triggerScenes ?? undefined;
    }
    // profile 优先级最高（用户已经在 wiki 端 finalize 过的 PersonalityProfile）。
    // 没传 profile 但传了 recipe → 实时用 blueprint service 把 recipe → profile，
    // 否则用户花几十字段填的 prompt 配方会被静默丢，世界里 AI 完全没人设。
    if (input.profile !== undefined && input.profile !== null) {
      patch.profile = input.profile;
    } else if (input.recipe) {
      const derived = this.tryDeriveProfileFromRecipe(input.recipe, trimmedName);
      if (derived) patch.profile = derived;
    }

    // —— 2026-05-15 起：wiki 私有角色已和 admin 一一对应到这 11 个字段，
    // 透传到 CharacterEntity；undefined 表示用户没填（保留旧值/默认值）。
    if (typeof input.isOnline === 'boolean') patch.isOnline = input.isOnline;
    if (typeof input.onlineMode === 'string') {
      patch.onlineMode = input.onlineMode as CharacterEntity['onlineMode'];
    }
    if (typeof input.activityMode === 'string') {
      patch.activityMode = input.activityMode as CharacterEntity['activityMode'];
    }
    if (input.currentActivity !== undefined) {
      patch.currentActivity = (input.currentActivity ??
        undefined) as CharacterEntity['currentActivity'];
    }
    if (typeof input.deletionPolicy === 'string') {
      patch.deletionPolicy =
        input.deletionPolicy as CharacterEntity['deletionPolicy'];
    }
    if (typeof input.isTemplate === 'boolean') {
      patch.isTemplate = input.isTemplate;
    }
    if (typeof input.socialOpenness === 'string') {
      patch.socialOpenness =
        input.socialOpenness as CharacterEntity['socialOpenness'];
    }
    if (typeof input.proactiveBrowseChance === 'number') {
      patch.proactiveBrowseChance = input.proactiveBrowseChance;
    }
    if (typeof input.intimacyLevel === 'number') {
      patch.intimacyLevel = input.intimacyLevel;
    }
    if (input.aiRelationships !== undefined) {
      patch.aiRelationships = input.aiRelationships ?? undefined;
    }
    // sourceType / sourceKey 不让 import 路径改写：它们是 import-personal
    // 自身的身份标识（'private_import' + name），用户在 wiki 编辑页改这俩
    // 只对私有角色行本地有效，不应该污染 world 里 CharacterEntity 的 source 标签
    // —— 否则下次 import 时第 485 行的 sourceType 校验会拒绝覆盖。

    let saved: CharacterEntity;
    if (existing) {
      Object.assign(existing, patch);
      existing.name = trimmedName;
      saved = await this.repo.save(existing);
    } else {
      // randomUUID 比 Date.now()+Math.random 更稳，避免极端情况下 PK 冲突 500。
      const newId = `private-${randomUUID()}`;
      saved = await this.repo.save(
        this.repo.create({
          id: newId,
          name: trimmedName,
          avatar: '',
          bio: '',
          relationship: trimmedName,
          relationshipType: 'friend',
          expertDomains: [],
          profile: {} as PersonalityProfile,
          sourceType: 'private_import',
          sourceKey: trimmedName,
          deletionPolicy: 'archive_allowed',
          isTemplate: false,
          isOnline: false,
          onlineMode: 'auto',
          activityFrequency: 'normal',
          momentsFrequency: 1,
          feedFrequency: 1,
          intimacyLevel: 0,
          socialOpenness: 'normal',
          proactiveBrowseChance: 0.3,
          activityMode: 'auto',
          modelRoutingMode: 'inherit_default',
          allowOwnerKeyOverride: true,
          ...patch,
        } as Partial<CharacterEntity>),
      );
    }

    // Ensure friendship with world-owner so the character shows up in the
    // tenant's friends list.
    //   - 无 friendship 行 → 新建（status='friend'）
    //   - 有 friendship 但 status='removed'（软删除）→ 重新激活成 'friend'，
    //     否则用户 import 完角色仍然不出现在好友列表里
    //   - 'blocked' 是用户明确动作，不触碰
    //   - 其它正常状态（friend/close/best）保留 intimacy/星标
    const owner = await this.worldOwnerService.getOwnerOrThrow();
    const existingFriendship = await this.friendshipRepo.findOne({
      where: { ownerId: owner.id, characterId: saved.id },
    });
    if (!existingFriendship) {
      await this.friendshipRepo.save(
        this.friendshipRepo.create({
          ownerId: owner.id,
          characterId: saved.id,
          status: 'friend',
          source: 'private_import',
        }),
      );
    } else if (existingFriendship.status === 'removed') {
      existingFriendship.status = 'friend';
      await this.friendshipRepo.save(existingFriendship);
    }

    return { character: saved, overwrote: !!existing };
  }

  /**
   * 把 wiki 私有角色 bundle 里的 recipe → PersonalityProfile。
   * recipe 是用户手填的、可能字段缺失/类型错乱，这里用 try/catch 兜底，
   * 出错就吞掉（按"recipe 没填"处理），避免一份坏 bundle 直接 500。
   */
  private tryDeriveProfileFromRecipe(
    recipe: CharacterBlueprintRecipeValue,
    characterIdHint: string,
  ): PersonalityProfile | null {
    try {
      return this.blueprintService.buildProfileFromRecipe(
        recipe,
        characterIdHint,
      ) as PersonalityProfile;
    } catch (err) {
      // 不打 ERROR，避免日志噪音；recipe 出错本身就是用户输入问题
      // i18n-ignore-line: backend log line, not user-facing
      console.warn(
        `[importPersonalCharacter] recipe → profile failed for "${characterIdHint}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  private normalizeCharacterAvatars(characters: CharacterEntity[]) {
    return characters.map(
      (character) => this.normalizeCharacterAvatar(character) ?? character,
    );
  }

  private normalizeCharacterAvatar(
    character: CharacterEntity | null | undefined,
  ): CharacterEntity | null {
    if (!character) {
      return null;
    }

    const canonicalAvatar = this.resolveCanonicalCharacterAvatar(character);
    if (
      !canonicalAvatar ||
      !this.shouldReplaceCharacterAvatar(character.avatar, canonicalAvatar)
    ) {
      return character;
    }

    return {
      ...character,
      avatar: canonicalAvatar,
    };
  }

  private resolveCanonicalCharacterAvatar(
    character: Pick<CharacterEntity, 'id' | 'sourceKey'>,
  ) {
    const mappedBySourceKey = maybeGetCharacterAvatarBySourceKey(
      character.sourceKey,
    );
    if (mappedBySourceKey) {
      return mappedBySourceKey;
    }

    const builtInPreset = BUILT_IN_CHARACTER_PRESETS.find(
      (preset) => preset.id === character.id,
    );
    const mappedByBuiltInPreset = maybeGetCharacterAvatarBySourceKey(
      builtInPreset?.character?.sourceKey ?? builtInPreset?.presetKey,
    );
    if (mappedByBuiltInPreset) {
      return mappedByBuiltInPreset;
    }

    const defaultCharacter = buildDefaultCharacters().find(
      (item) => item.id === character.id,
    );
    return (
      maybeGetCharacterAvatarBySourceKey(defaultCharacter?.sourceKey) ??
      builtInPreset?.character?.avatar?.trim() ??
      builtInPreset?.avatar?.trim() ??
      defaultCharacter?.avatar?.trim() ??
      null
    );
  }

  private shouldReplaceCharacterAvatar(
    currentAvatar: string | null | undefined,
    canonicalAvatar: string,
  ) {
    const normalizedAvatar = currentAvatar?.trim() ?? '';
    if (!normalizedAvatar) {
      return true;
    }

    if (normalizedAvatar === canonicalAvatar) {
      return false;
    }

    if (normalizedAvatar.startsWith('/api/character-assets/')) {
      return true;
    }

    return !this.isLikelyImageSource(normalizedAvatar);
  }

  private isLikelyImageSource(value: string) {
    return (
      value.startsWith('/') ||
      value.startsWith('./') ||
      value.startsWith('../') ||
      value.startsWith('blob:') ||
      /^https?:\/\//i.test(value) ||
      /^data:image\//i.test(value) ||
      /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value)
    );
  }

  private async backfillCharacterAvatarAssets() {
    const characters = await this.repo.find();
    const pendingUpdates: CharacterEntity[] = [];

    for (const character of characters) {
      const normalizedCharacter = this.normalizeCharacterAvatar(character);
      if (
        normalizedCharacter &&
        normalizedCharacter.avatar !== character.avatar
      ) {
        pendingUpdates.push(normalizedCharacter);
      }
    }

    if (pendingUpdates.length === 0) {
      return;
    }

    await this.repo.save(pendingUpdates);
  }

  private async filterNeedGeneratedVisibility(
    characters: CharacterEntity[],
    ownerId?: string,
  ) {
    const hasNeedGenerated = characters.some(
      (character) => character.sourceType === 'need_generated',
    );
    if (!hasNeedGenerated) {
      return characters;
    }

    const activeFriendCharacterIds =
      await this.getActiveFriendCharacterIdSet(ownerId);
    return characters.filter(
      (character) =>
        character.sourceType !== 'need_generated' ||
        activeFriendCharacterIds.has(character.id),
    );
  }

  async getActiveFriendCharacterIdSet(ownerId?: string) {
    const resolvedOwnerId =
      ownerId ?? (await this.worldOwnerService.getOwnerOrThrow()).id;
    const friendships = await this.friendshipRepo.find({
      select: ['characterId'],
      where: [
        { ownerId: resolvedOwnerId, status: 'friend' },
        { ownerId: resolvedOwnerId, status: 'close' },
        { ownerId: resolvedOwnerId, status: 'best' },
      ],
    });
    return new Set(friendships.map((item) => item.characterId));
  }
}

// 字段长度上限。后端 entity 是 text/json 列没硬限，但用户填的内容直接进
// AI prompt + 全部存全 world，过长会撑爆 context cost / DB 体积。
// 数字偏宽松，目的是挡住误传（粘整本小说 / GB 级文件），不卡正常使用。
const PRIVATE_CHARACTER_FIELD_LIMITS = {
  name: 80,
  avatar: 2000,
  bio: 2000,
  personality: 2000,
  relationship: 200,
  relationshipType: 80,
  expertDomainItem: 80,
  expertDomainCount: 50,
  triggerSceneItem: 80,
  triggerSceneCount: 50,
  recipeJsonBytes: 64 * 1024,
  profileJsonBytes: 64 * 1024,
} as const;

export function assertPrivateCharacterFieldLimits(input: {
  name?: string;
  avatar?: string;
  bio?: string;
  personality?: string | null;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  triggerScenes?: string[] | null;
  recipe?: unknown;
  profile?: unknown;
}): void {
  const L = PRIVATE_CHARACTER_FIELD_LIMITS;
  const tooLong = (label: string, max: number) =>
    new AppError('PRIVATE_IMPORT_INVALID', {
      status: HttpStatus.BAD_REQUEST,
      legacyMessage: `${label} 超长（上限 ${max}）。`,
    });
  if (input.name && input.name.length > L.name) throw tooLong('name', L.name);
  if (input.avatar && input.avatar.length > L.avatar)
    throw tooLong('avatar', L.avatar);
  if (input.bio && input.bio.length > L.bio) throw tooLong('bio', L.bio);
  if (input.personality && input.personality.length > L.personality)
    throw tooLong('personality', L.personality);
  if (input.relationship && input.relationship.length > L.relationship)
    throw tooLong('relationship', L.relationship);
  if (
    input.relationshipType &&
    input.relationshipType.length > L.relationshipType
  )
    throw tooLong('relationshipType', L.relationshipType);
  if (Array.isArray(input.expertDomains)) {
    if (input.expertDomains.length > L.expertDomainCount)
      throw tooLong('expertDomains 个数', L.expertDomainCount);
    for (const item of input.expertDomains) {
      if (typeof item === 'string' && item.length > L.expertDomainItem)
        throw tooLong('expertDomains 元素', L.expertDomainItem);
    }
  }
  if (Array.isArray(input.triggerScenes)) {
    if (input.triggerScenes.length > L.triggerSceneCount)
      throw tooLong('triggerScenes 个数', L.triggerSceneCount);
    for (const item of input.triggerScenes) {
      if (typeof item === 'string' && item.length > L.triggerSceneItem)
        throw tooLong('triggerScenes 元素', L.triggerSceneItem);
    }
  }
  // JSON.stringify 可能因循环引用炸；try/catch 兜底，不要因 size check 把请求干 500。
  if (input.recipe !== undefined && input.recipe !== null) {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(input.recipe), 'utf8');
      if (bytes > L.recipeJsonBytes)
        throw tooLong(
          `recipe JSON (${(bytes / 1024).toFixed(1)} KB)`,
          L.recipeJsonBytes,
        );
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('PRIVATE_IMPORT_INVALID', {
        status: HttpStatus.BAD_REQUEST,
        legacyMessage: `recipe JSON 不可序列化：${(err as Error).message}`,
      });
    }
  }
  if (input.profile !== undefined && input.profile !== null) {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(input.profile), 'utf8');
      if (bytes > L.profileJsonBytes)
        throw tooLong(
          `profile JSON (${(bytes / 1024).toFixed(1)} KB)`,
          L.profileJsonBytes,
        );
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('PRIVATE_IMPORT_INVALID', {
        status: HttpStatus.BAD_REQUEST,
        legacyMessage: `profile JSON 不可序列化：${(err as Error).message}`,
      });
    }
  }
}
// i18n-ignore-end
