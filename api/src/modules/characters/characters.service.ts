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
    const installedCharacters = await this.repo.find({
      where: { sourceType: 'preset_catalog' },
    });
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
      const installedCharacter = installedBySourceKey.get(preset.presetKey);
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
   * - 按 name 在 characters 表里 upsert（同名→覆盖；不存在→新建）
   * - 自动给 world-owner 建 friendship（已存在则保留 intimacy/status）
   * - sourceType 写 'private_import'，sourceKey 记录原 name
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
    profile?: PersonalityProfile | null;
  }): Promise<{ character: CharacterEntity; overwrote: boolean }> {
    const trimmedName = (input.name ?? '').trim();
    if (!trimmedName) {
      throw new AppError('PRIVATE_IMPORT_INVALID', {
        status: HttpStatus.BAD_REQUEST,
        legacyMessage: '导入文件缺少 name 字段。',
      });
    }

    const existing = await this.repo.findOne({
      where: { name: trimmedName },
    });

    // 不允许覆盖受保护角色（如 default_seed 的「我自己」）— 避免破坏系统角色
    if (existing && existing.deletionPolicy === 'protected') {
      throw new AppError('PRIVATE_IMPORT_NAME_RESERVED', {
        status: HttpStatus.CONFLICT,
        legacyMessage: `世界里已存在受保护的同名角色 "${trimmedName}"，无法覆盖。请改用其他名字。`,
      });
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
    if (input.profile !== undefined && input.profile !== null) {
      patch.profile = input.profile;
    }

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
// i18n-ignore-end
