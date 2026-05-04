import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CharacterBlueprintRecipeValue } from '../../characters/character-blueprint.types';

export type WikiContentSnapshot = {
  name: string;
  avatar: string;
  bio: string;
  personality?: string;
  expertDomains: string[];
  triggerScenes?: string[];
  relationship: string;
  relationshipType: string;
};

@Entity('character_revisions')
@Index(['characterId', 'version'])
@Index(['status', 'createdAt'])
@Index(['isPatrolled', 'status'])
export class CharacterRevisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  characterId: string;

  @Column()
  version: number;

  @Column({ type: 'text', nullable: true })
  parentRevisionId?: string | null;

  @Column({ type: 'text', nullable: true })
  baseRevisionId?: string | null;

  @Column('simple-json')
  contentSnapshot: WikiContentSnapshot;

  @Column('simple-json', { nullable: true })
  recipeSnapshot?: CharacterBlueprintRecipeValue | null;

  @Column('simple-json', { nullable: true })
  diffFromParent?: unknown | null;

  @Column()
  editorUserId: string;

  @Column()
  editorRoleAtTime: string;

  @Column({ length: 500, default: '' })
  editSummary: string;

  @Column()
  status: string; // 'pending' | 'approved' | 'rejected' | 'reverted' | 'superseded'

  @Column({ default: 'content' })
  revisionKind: string; // 'content' | 'recipe' | 'lifecycle'

  @Column({ default: 'edit' })
  operation: string; // 'edit' | 'create' | 'soft_delete' | 'restore' | 'revert'

  @Column({ default: 'low' })
  riskLevel: string; // 'low' | 'high'

  @Column()
  changeSource: string; // 'edit' | 'revert' | 'admin_override' | 'merge' | 'ai_regen'

  @Column({ default: false })
  isMinor: boolean;

  @Column({ default: false })
  isPatrolled: boolean;

  @Column({ type: 'text', nullable: true })
  patrolledBy?: string | null;

  @Column({ type: 'datetime', nullable: true })
  patrolledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  revertedByRevisionId?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
