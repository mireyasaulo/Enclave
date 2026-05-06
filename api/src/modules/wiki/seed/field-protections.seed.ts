import type { DeepPartial } from 'typeorm';
import { WikiFieldProtectionEntity } from '../entities/wiki-field-protection.entity';

/**
 * 默认全局字段保护：与 isHighRiskRecipeChange 互补。
 * isHighRiskRecipeChange 决定"该字段需 patroller 审核才能发布"，
 * 字段级保护决定"newcomer 根本不能改这个字段（连 pending 都不允许）"。
 */
export const WIKI_FIELD_PROTECTION_SEEDS: Array<
  DeepPartial<WikiFieldProtectionEntity>
> = [
  {
    characterId: '*',
    fieldPath: 'prompting.coreLogic',
    minRoleToEdit: 'autoconfirmed',
    reason: '直接注入 system prompt 的核心逻辑',
    createdBy: 'system_seed',
  },
  {
    characterId: '*',
    fieldPath: 'prompting.scenePrompts.chat',
    minRoleToEdit: 'autoconfirmed',
    reason: '聊天场景 prompt',
    createdBy: 'system_seed',
  },
  {
    characterId: '*',
    fieldPath: 'memorySeed.coreMemory',
    minRoleToEdit: 'autoconfirmed',
    reason: '角色长期记忆，影响后续所有对话',
    createdBy: 'system_seed',
  },
  {
    characterId: '*',
    fieldPath: 'realityLink',
    minRoleToEdit: 'patroller',
    reason: '真实世界数据接入开关，平台口径敏感',
    createdBy: 'system_seed',
  },
];
