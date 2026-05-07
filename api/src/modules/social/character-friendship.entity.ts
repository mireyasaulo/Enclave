import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('character_friendships')
@Index('idx_character_friendship_pair', ['characterAId', 'characterBId'], {
  unique: true,
})
export class CharacterFriendshipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  characterAId: string;

  @Column()
  characterBId: string;

  @Column({ type: 'float', default: 0 })
  intimacy: number; // 0-100

  @Column({ default: 'friend' })
  relationshipType: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastInteractedAt?: Date | null;
}
