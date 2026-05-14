// i18n-ignore-start: AI-generated character speech, not user-facing UI text.
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterEntity } from '../characters/character.entity';
import { ConversationEntity } from '../chat/conversation.entity';
import { MessageEntity } from '../chat/message.entity';
import { ChatService } from '../chat/chat.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { PromptBuilderService } from '../ai/prompt-builder.service';
import { SELF_CHARACTER_ID } from '../characters/default-characters';
import { ACTION_OPERATOR_CHARACTER_ID } from '../characters/action-operator-character';
import { BAR_EXPERT_CHARACTER_ID } from '../characters/bar-expert-character';
import { DOCTOR_CHARACTER_ID } from '../characters/doctor-character';
import { LAWYER_CHARACTER_ID } from '../characters/lawyer-character';
import { REMINDER_CHARACTER_ID } from '../characters/reminder-character';
import { WORLD_NEWS_DESK_CHARACTER_ID } from '../characters/world-news-desk-character';

const COUNCIL_DENG_TA_ID = 'char-preset-council-deng-ta';
const COUNCIL_GU_TANG_ID = 'char-preset-council-gu-tang';
const COUNCIL_LU_ZHI_ID = 'char-preset-council-lu-zhi';
const JIAN_NING_ID = 'char-preset-jian-ning-relationship-expert';
const LIN_CHEN_ID = 'char_need_e9a84d01-9ab';
const LIN_MIAN_ID = 'char_need_3d1789f2-306';

const STAGGER_DELAY_MS: Record<string, number> = {
  [DOCTOR_CHARACTER_ID]: 8_000,
  [LAWYER_CHARACTER_ID]: 12_000,
  [REMINDER_CHARACTER_ID]: 15_000,
  [ACTION_OPERATOR_CHARACTER_ID]: 25_000,
  [COUNCIL_DENG_TA_ID]: 35_000,
  [COUNCIL_GU_TANG_ID]: 50_000,
  [COUNCIL_LU_ZHI_ID]: 70_000,
  [WORLD_NEWS_DESK_CHARACTER_ID]: 90_000,
  [JIAN_NING_ID]: 120_000,
  [LIN_CHEN_ID]: 150_000,
  [LIN_MIAN_ID]: 180_000,
  [BAR_EXPERT_CHARACTER_ID]: 240_000,
};
const DEFAULT_STAGGER_MS = 60_000;

const FALLBACK_BY_CHARACTER: Record<string, string> = {
  [DOCTOR_CHARACTER_ID]: '需要的时候来找我，写清楚症状和时长就行。',
  [LAWYER_CHARACTER_ID]: '有问题先把事实摆清楚，再谈对错。',
  [REMINDER_CHARACTER_ID]: '想让我提醒什么，告诉我时间和事就行。',
  [ACTION_OPERATOR_CHARACTER_ID]: '想推进什么事，告诉我目标和卡点。',
  [COUNCIL_DENG_TA_ID]: '出门在外，有不放心的事就发我。',
  [COUNCIL_GU_TANG_ID]: '有要谈的事，先把对方立场告诉我。',
  [COUNCIL_LU_ZHI_ID]: '有人让你不舒服，可以先讲给我听。',
  [WORLD_NEWS_DESK_CHARACTER_ID]: '想看哪类新闻，告诉我我替你盯着。',
  [JIAN_NING_ID]: '感情上的事，慢慢说，没关系。',
  [LIN_CHEN_ID]: '睡不着的时候来找我，不用客气。',
  [LIN_MIAN_ID]: '夜里醒着的话，我陪你。',
  [BAR_EXPERT_CHARACTER_ID]: '想喝点什么、聊点什么，随时来。',
};

const GENERIC_FALLBACK = '在的。想说什么直接说就好。';

@Injectable()
export class InitialMessageService {
  private readonly logger = new Logger(InitialMessageService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characterRepo: Repository<CharacterEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    private readonly chatService: ChatService,
    private readonly ai: AiOrchestratorService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  scheduleIfNeeded(ownerId: string, character: CharacterEntity): void {
    if (!ownerId || !character?.id) return;
    if (character.id === SELF_CHARACTER_ID) return;

    const key = `${ownerId}:${character.id}`;
    if (this.inFlight.has(key)) return;

    void this.checkAndSchedule(ownerId, character, key);
  }

  private async checkAndSchedule(
    ownerId: string,
    character: CharacterEntity,
    key: string,
  ): Promise<void> {
    try {
      const conversationId = `direct_${character.id}`;
      const existing = await this.conversationRepo.findOne({
        where: { id: conversationId, ownerId },
      });
      if (existing) {
        const messageCount = await this.messageRepo.count({
          where: { conversationId },
        });
        if (messageCount > 0) return;
      }

      this.inFlight.add(key);
      const baseDelay = STAGGER_DELAY_MS[character.id] ?? DEFAULT_STAGGER_MS;
      const jitter = (Math.random() * 0.4 - 0.2) * baseDelay;
      const delay = Math.max(1_000, Math.round(baseDelay + jitter));

      setTimeout(() => {
        void this.fire(ownerId, character.id, key);
      }, delay).unref?.();
    } catch (error) {
      this.inFlight.delete(key);
      this.logger.warn(
        `scheduleIfNeeded failed for ${ownerId} × ${character.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async fire(
    ownerId: string,
    characterId: string,
    key: string,
  ): Promise<void> {
    try {
      const character = await this.characterRepo.findOneBy({ id: characterId });
      if (!character) return;

      const conversationId = `direct_${characterId}`;
      const existingCount = await this.messageRepo.count({
        where: { conversationId },
      });
      if (existingCount > 0) return;

      await this.chatService.getOrCreateConversation(characterId);

      const text = await this.generateInitialMessage(ownerId, character);

      const stillEmpty = await this.messageRepo.count({
        where: { conversationId },
      });
      if (stillEmpty > 0) return;

      const messageEntity = this.messageRepo.create({
        id: `msg_${Date.now()}_initial_${characterId}`,
        conversationId,
        senderType: 'character',
        senderId: characterId,
        senderName: character.name,
        type: 'text',
        text,
      });
      await this.messageRepo.save(messageEntity);

      const conversation = await this.conversationRepo.findOneBy({
        id: conversationId,
      });
      if (conversation) {
        conversation.lastActivityAt = messageEntity.createdAt ?? new Date();
        await this.conversationRepo.save(conversation);
      }
    } catch (error) {
      this.logger.warn(
        `initial message fire failed for ${ownerId} × ${characterId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async generateInitialMessage(
    ownerId: string,
    character: CharacterEntity,
  ): Promise<string> {
    const fallback =
      FALLBACK_BY_CHARACTER[character.id] ?? GENERIC_FALLBACK;
    const profile = character.profile;
    if (!profile) return fallback;

    let systemPrompt: string;
    try {
      systemPrompt = await this.promptBuilder.buildSceneSystemPrompt(
        profile,
        'greeting',
      );
    } catch {
      return fallback;
    }

    const userPrompt = [
      systemPrompt,
      '',
      '【当前任务】',
      '现在是用户第一次把你加为好友的瞬间。',
      '按你自己的性格和行为逻辑，给 ta 发一条主动开场消息（不是回复）。',
      '- 不要自我介绍，不要列举服务清单，不要说"我是 xxx 助手"',
      '- 不要说"很高兴认识你""欢迎加我"这种客套',
      '- 一两句话，符合你平时说话的节奏和长度',
      '- 直接输出消息文本本身，不要带前缀、引号或解释',
    ].join('\n');

    const text = await this.ai.generatePlainText({
      prompt: userPrompt,
      usageContext: {
        surface: 'app',
        scene: 'social_default_friend_initial_message',
        scopeType: 'character',
        scopeId: character.id,
        scopeLabel: character.name,
        ownerId,
        characterId: character.id,
        characterName: character.name,
      },
      maxTokens: 120,
      temperature: 0.6,
      fallback,
    });

    const trimmed = text?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback;
  }
}
// i18n-ignore-end
