import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterEntity } from '../characters/character.entity';
import {
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
  buildDefaultCharacters,
  SELF_CHARACTER_ID,
} from '../characters/default-characters';
import { ConversationEntity } from '../chat/conversation.entity';
import { MessageEntity } from '../chat/message.entity';

const WELCOME_MESSAGE_TEXT =
  '你来了。欢迎来到这个世界——慢慢看，慢慢说，我都在。';

@Injectable()
export class WelcomeMessageService {
  private readonly logger = new Logger(WelcomeMessageService.name);

  constructor(
    @InjectRepository(CharacterEntity)
    private readonly characterRepo: Repository<CharacterEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
  ) {}

  async sendWelcomeMessage(ownerId: string): Promise<void> {
    if (!ownerId) {
      return;
    }

    try {
      const selfCharacter = await this.ensureSelfCharacter();
      const conversationId = `direct_${SELF_CHARACTER_ID}`;
      const welcomeMessageId = `msg_welcome_self_${ownerId}`;

      const existingWelcome = await this.messageRepo.findOneBy({
        id: welcomeMessageId,
      });
      if (existingWelcome) {
        return;
      }

      const now = new Date();
      const existingConversation = await this.conversationRepo.findOneBy({
        id: conversationId,
      });
      if (!existingConversation) {
        await this.conversationRepo.save(
          this.conversationRepo.create({
            id: conversationId,
            ownerId,
            type: 'direct',
            title: selfCharacter.name,
            participants: [SELF_CHARACTER_ID],
            isPinned: false,
            isHidden: false,
            lastActivityAt: now,
          }),
        );
      }

      await this.messageRepo.save(
        this.messageRepo.create({
          id: welcomeMessageId,
          conversationId,
          senderType: 'character',
          senderId: SELF_CHARACTER_ID,
          senderName: selfCharacter.name,
          type: 'text',
          text: WELCOME_MESSAGE_TEXT,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `failed to send welcome message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async ensureSelfCharacter(): Promise<CharacterEntity> {
    const existing = await this.characterRepo.findOneBy({
      id: SELF_CHARACTER_ID,
    });
    if (existing) {
      return existing;
    }

    const seed = buildDefaultCharacters().find(
      (character) => character.id === SELF_CHARACTER_ID,
    );
    if (!seed) {
      throw new Error('SELF character seed missing from buildDefaultCharacters');
    }

    return this.characterRepo.save(this.characterRepo.create(seed));
  }
}
// i18n-ignore-end
