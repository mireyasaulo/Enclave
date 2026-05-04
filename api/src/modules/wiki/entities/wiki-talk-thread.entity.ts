import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wiki_talk_threads')
@Index(['characterId', 'lastReplyAt'])
export class WikiTalkThreadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  characterId: string;

  @Column({ length: 200 })
  title: string;

  @Column()
  authorId: string;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ default: false })
  isResolved: boolean;

  @Column({ default: 0 })
  postCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastReplyAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
