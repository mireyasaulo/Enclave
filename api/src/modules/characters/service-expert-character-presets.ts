// i18n-ignore-start: data / seed / preset content — not user-facing UI.
//
// 服务业 / 生活专家居民池。
// 这些角色之前以独立 `build*Character()` 形式存在但没人 import，相当于死代码。
// 2026-05-14 起统一拉进 BUILT_IN_CHARACTER_PRESETS，成为正式的世界居民
// （三层模型详见 `built-in-character-presets.ts` 顶部）。
//
// 关于 ID：保留历史 `char-default-*` 形态，避免破坏已硬编码的 ID 引用
// （如 prompt-naturalness.ts 里对 wedding-planner ID 的特殊语气补丁）。
// 这些 ID 在 seed 时会被 sourceType=preset_catalog / deletionPolicy=archive_allowed
// 覆盖，行为上是普通居民，不是默认好友。

import type { CelebrityCharacterPreset } from './celebrity-character-presets';
import {
  buildHotelExpertCharacter,
  HOTEL_EXPERT_CHARACTER_ID,
  HOTEL_EXPERT_SOURCE_KEY,
} from './hotel-expert-character';
import {
  buildWeddingDressExpertCharacter,
  WEDDING_DRESS_EXPERT_CHARACTER_ID,
  WEDDING_DRESS_EXPERT_SOURCE_KEY,
} from './wedding-dress-expert-character';
import {
  buildWeddingPlannerCharacter,
  WEDDING_PLANNER_CHARACTER_ID,
  WEDDING_PLANNER_SOURCE_KEY,
} from './wedding-planner-character';

const HOTEL_EXPERT_CHARACTER = buildHotelExpertCharacter();
const WEDDING_PLANNER_CHARACTER = buildWeddingPlannerCharacter();
const WEDDING_DRESS_EXPERT_CHARACTER = buildWeddingDressExpertCharacter();

export const SERVICE_EXPERT_CHARACTER_PRESETS: CelebrityCharacterPreset[] = [
  {
    presetKey: HOTEL_EXPERT_SOURCE_KEY,
    groupKey: 'business_and_investing',
    id: HOTEL_EXPERT_CHARACTER_ID,
    name: HOTEL_EXPERT_CHARACTER.name ?? '酒店专家',
    avatar: HOTEL_EXPERT_CHARACTER.avatar ?? '🏨',
    relationship:
      HOTEL_EXPERT_CHARACTER.relationship ??
      '帮你把酒店、住宿和会务选择看稳的人',
    description:
      '懂订房、入住、权益、服务补救、宴会会务和酒店经营判断的礼宾经理型居民，先看条款和总成本再下判断。',
    expertDomains: HOTEL_EXPERT_CHARACTER.expertDomains ?? [
      'travel',
      'hospitality',
      'management',
      'general',
    ],
    character: HOTEL_EXPERT_CHARACTER,
  },
  {
    presetKey: WEDDING_PLANNER_SOURCE_KEY,
    groupKey: 'relationships_and_emotions',
    id: WEDDING_PLANNER_CHARACTER_ID,
    name: WEDDING_PLANNER_CHARACTER.name ?? '礼序',
    avatar: WEDDING_PLANNER_CHARACTER.avatar ?? '💍',
    relationship: WEDDING_PLANNER_CHARACTER.relationship ?? '帮你把婚礼落地的人',
    description:
      '帮你把婚礼从模糊愿望翻译成预算、档期、流程和分工的婚礼统筹居民，不鼓动超支。',
    expertDomains: WEDDING_PLANNER_CHARACTER.expertDomains ?? [
      'management',
      'general',
      'wedding_planning',
      'event_planning',
    ],
    character: WEDDING_PLANNER_CHARACTER,
  },
  {
    presetKey: WEDDING_DRESS_EXPERT_SOURCE_KEY,
    groupKey: 'relationships_and_emotions',
    id: WEDDING_DRESS_EXPERT_CHARACTER_ID,
    name: WEDDING_DRESS_EXPERT_CHARACTER.name ?? '纱凝',
    avatar: WEDDING_DRESS_EXPERT_CHARACTER.avatar ?? '👰',
    relationship:
      WEDDING_DRESS_EXPERT_CHARACTER.relationship ??
      '帮你把婚纱选款、试纱和改衣落到上身效果的人',
    description:
      '懂婚纱版型、面料、试纱、改衣和现场体验的礼服顾问居民，先看上身和场地再下判断。',
    expertDomains: WEDDING_DRESS_EXPERT_CHARACTER.expertDomains ?? [
      'fashion',
      'wedding_dress',
      'bridal_styling',
      'wedding_planning',
      'general',
    ],
    character: WEDDING_DRESS_EXPERT_CHARACTER,
  },
];
// i18n-ignore-end
