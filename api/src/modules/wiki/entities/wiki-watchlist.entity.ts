import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('wiki_watchlist')
export class WikiWatchlistEntity {
  @PrimaryColumn()
  userId: string;

  @PrimaryColumn()
  characterId: string;

  @Column({ default: true })
  notifyOnEdit: boolean;

  @Column({ default: true })
  notifyOnTalk: boolean;

  @CreateDateColumn()
  addedAt: Date;
}
