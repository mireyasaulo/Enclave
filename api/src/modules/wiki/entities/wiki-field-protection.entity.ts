import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 字段级保护策略：用 ('*' | characterId, fieldPath) 元组指定一个最小可编辑等级。
 * 优先级：单 character 覆盖 > 全局 '*'。多条记录（同 character + 同 path）取最高 minRole。
 *
 * 与 page-level protectionLevel 是正交的：即便页面 protectionLevel='none'，
 * 敏感字段（如 prompting.coreLogic）仍可独立要求 patroller+。
 */
@Entity('wiki_field_protections')
@Index(['characterId', 'fieldPath'])
export class WikiFieldProtectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '*' })
  characterId: string; // '*' 表示全局策略

  @Column()
  fieldPath: string; // 'prompting.coreLogic' 'prompting.scenePrompts.chat' 等

  @Column()
  minRoleToEdit: string; // 'autoconfirmed' | 'patroller' | 'admin'

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'text', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
