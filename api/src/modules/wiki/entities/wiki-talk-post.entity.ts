import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('wiki_talk_posts')
@Index(['threadId', 'createdAt'])
export class WikiTalkPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  threadId: string;

  @Column({ type: 'text', nullable: true })
  parentPostId?: string | null;

  @Column()
  authorId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'datetime', nullable: true })
  editedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deletedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  deletedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
