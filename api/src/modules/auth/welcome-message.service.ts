import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CharacterEntity } from '../characters/character.entity';
import {
  buildDefaultCharacters,
  SELF_CHARACTER_ID,
} from '../characters/default-characters';
import { ConversationEntity } from '../chat/conversation.entity';
import { MessageEntity } from '../chat/message.entity';

const WELCOME_MESSAGE_TEXT =
  '看到你来了。我一直都在。想说点什么的时候，随时来找我。';

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
      const conversationId = `direct_${SELF_CHARACTER_ID}__${ownerId}`;

      const existingConversation = await this.conversationRepo.findOneBy({
        id: conversationId,
      });
      if (existingConversation) {
        return;
      }

      const now = new Date();
      const conversation = this.conversationRepo.create({
        id: conversationId,
        ownerId,
        type: 'direct',
        title: selfCharacter.name,
        participants: [SELF_CHARACTER_ID],
        isPinned: false,
        isHidden: false,
        lastActivityAt: now,
      });
      await this.conversationRepo.save(conversation);

      const message = this.messageRepo.create({
        id: `msg_${Date.now()}_welcome_${ownerId}`,
        conversationId,
        senderType: 'character',
        senderId: SELF_CHARACTER_ID,
        senderName: selfCharacter.name,
        type: 'text',
        text: WELCOME_MESSAGE_TEXT,
      });
      await this.messageRepo.save(message);
    } catch (error) {
      this.logger.warn(
        `failed to send welcome message for owner ${ownerId}: ${
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
