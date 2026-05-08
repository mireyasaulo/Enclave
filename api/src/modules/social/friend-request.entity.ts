import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// i18n-ignore-start: data / seed / preset content — not user-facing UI.
@Entity('friend_requests')
export class FriendRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'userId' })
  ownerId: string;

  @Column()
  characterId: string;

  @Column()
  characterName: string;

  @Column()
  characterAvatar: string;

  @Column({ nullable: true })
  triggerScene?: string; // e.g. 'coffee_shop', 'gym'

  @Column({ nullable: true })
  greeting?: string; // AI's opening message

  @Column({ default: 'pending' })
  status: string; // 'pending' | 'accepted' | 'declined'

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null; // daily expiry

  @Column({ name: 'accept_at', type: 'datetime', nullable: true })
  acceptAt?: Date | null;
}
// i18n-ignore-end
