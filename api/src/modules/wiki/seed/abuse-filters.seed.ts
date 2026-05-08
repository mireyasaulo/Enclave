import type { DeepPartial } from 'typeorm';
import { AbuseFilterEntity } from '../entities/abuse-filter.entity';

/**
 * 预置反破坏过滤器（首次启动幂等插入）。
 * 后续可在 admin UI 增删改，通过 unique name 防重复。
 */
// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export const ABUSE_FILTER_SEEDS: Array<DeepPartial<AbuseFilterEntity>> = [
  {
    name: 'frequency_60s_5',
    description: '60 秒内同一用户提交 ≥5 次',
    pattern: { type: 'frequency', windowSec: 60, maxEdits: 5 },
    scope: 'all',
    action: 'block',
    severity: 'high',
    enabled: true,
    createdBy: 'system',
  },
  {
    name: 'shrink_bio_80',
    description: 'bio 字段单次缩短超过 80%',
    pattern: { type: 'shrink', field: 'bio', threshold: 0.8 },
    scope: 'content',
    action: 'tag_high_risk',
    severity: 'medium',
    enabled: true,
    createdBy: 'system',
  },
  {
    name: 'shrink_personality_80',
    description: 'personality 字段单次缩短超过 80%',
    pattern: { type: 'shrink', field: 'personality', threshold: 0.8 },
    scope: 'content',
    action: 'tag_high_risk',
    severity: 'medium',
    enabled: true,
    createdBy: 'system',
  },
  {
    name: 'link_flood',
    description: '正文出现超过 5 个链接',
    pattern: { type: 'link_flood', threshold: 5 },
    scope: 'all',
    action: 'tag_high_risk',
    severity: 'medium',
    enabled: true,
    createdBy: 'system',
  },
  {
    name: 'keyword_promotion',
    description: '推广常见关键词（加微信、代购、q群等）',
    pattern: {
      type: 'keyword_list',
      keywords: ['加微信', '代购', 'q群', 'QQ群', '+v', '微信号'],
      caseSensitive: false,
    },
    scope: 'all',
    action: 'tag_high_risk',
    severity: 'high',
    enabled: true,
    createdBy: 'system',
  },
];
// i18n-ignore-end
