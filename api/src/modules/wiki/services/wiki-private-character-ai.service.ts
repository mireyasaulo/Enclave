// i18n-ignore-start: backend service, errors are domain codes (no user-facing zh strings).
import { Injectable, Logger } from '@nestjs/common';
import type { CharacterBlueprintRecipeValue as CharacterBlueprintRecipe } from '../../characters/character-blueprint.types';
import { AiOrchestratorService } from '../../ai/ai-orchestrator.service';
import type { AiUsageContext } from '../../ai/ai.types';
import type { PrivateCharacterDto } from './wiki-private-character.service';
import {
  SECTION_PROMPTS,
  type SectionKey,
  buildTemplateVars,
  renderPromptTemplate,
} from './wiki-private-character-ai.prompts';

const VALID_RELATIONSHIP_TYPES = new Set([
  'friend',
  'family',
  'mentor',
  'expert',
  'custom',
]);
const VALID_EMOJI_USAGE = new Set(['none', 'occasional', 'frequent']);
const VALID_RESPONSE_LENGTH = new Set(['short', 'medium', 'long']);
const VALID_ACTIVITY_FREQUENCY = new Set(['occasional', 'normal', 'frequent']);

/**
 * AI 生成的返回结构：扁平化后再交给前端。
 * 用 Partial 因为只填空字段，sacred 和已填字段不在结果里。
 *
 * 用嵌套 recipe 结构方便前端按 section 匹配 useState。
 */
export type AiGeneratedDraft = {
  // 顶层 DTO 字段
  bio?: string;
  personality?: string;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  triggerScenes?: string[];
  // 嵌套 recipe
  recipe?: {
    identity?: Partial<CharacterBlueprintRecipe['identity']>;
    expertise?: Partial<CharacterBlueprintRecipe['expertise']>;
    tone?: Partial<CharacterBlueprintRecipe['tone']>;
    prompting?: Partial<CharacterBlueprintRecipe['prompting']>;
    memorySeed?: Partial<CharacterBlueprintRecipe['memorySeed']>;
    reasoning?: Partial<CharacterBlueprintRecipe['reasoning']>;
    lifeStrategy?: Partial<CharacterBlueprintRecipe['lifeStrategy']>;
  };
};

@Injectable()
export class WikiPrivateCharacterAiService {
  private readonly logger = new Logger(WikiPrivateCharacterAiService.name);

  constructor(private readonly orchestrator: AiOrchestratorService) {}

  async generateForSection(input: {
    section: SectionKey;
    currentDraft: PrivateCharacterDto;
    ownerId: string;
  }): Promise<AiGeneratedDraft> {
    const template = SECTION_PROMPTS[input.section];
    const vars = buildTemplateVars(input.currentDraft);
    const userPrompt = renderPromptTemplate(template.userPromptTemplate, vars);
    const combinedPrompt = `${template.systemPrompt}\n\n---\n\n${userPrompt}`;

    const usageContext: AiUsageContext = {
      // 'wiki' 不在 AiUsageSurface 枚举里；私有角色 AI 生成是用户从 wiki UI 触发，
      // 用 'app' 最贴近（用户主动行为，非 cron 任务）。
      surface: 'app',
      scene: `wiki_private_character_generate_${input.section}`,
      scopeType: 'character',
      scopeLabel: input.currentDraft.name?.trim() || 'wiki-private-character',
      ownerId: input.ownerId,
    };

    let raw = await this.orchestrator.generateJsonObject({
      prompt: combinedPrompt,
      usageContext,
      temperature: template.temperature,
      maxTokens: template.maxTokens,
      fallback: template.fallback,
    });

    // 兜底：generateJsonObject 内部的 extractJsonFromModelOutput 用"first { 到
    // last }"启发式抓 JSON。reasoning 模型（GLM 系列）会输出 <think>...</think>
    // 块，里面可能包含 { 字符（举例、复述 schema），让抓取的范围错误，最终
    // JSON.parse 失败返回 fallback {}。
    //
    // 这里检测到 raw 几乎为空时，改用 generatePlainText 自己处理：strip <think>
    // 后再 extract JSON。
    if (!raw || Object.keys(raw).length === 0) {
      this.logger.warn(
        `generateJsonObject returned empty for section=${input.section}; retrying via plain text + manual extraction`,
      );
      const text = await this.orchestrator.generatePlainText({
        prompt: combinedPrompt,
        usageContext,
        temperature: template.temperature,
        maxTokens: template.maxTokens,
        fallback: '',
      });
      const parsed = parseJsonAfterThink(text);
      if (parsed) raw = parsed;
    }

    return normalizeAiOutput(input.section, raw, input.currentDraft);
  }
}

/**
 * 把模型输出里 `<think>...</think>` reasoning 块剥掉，然后从剩余文本里抓
 * 第一个 `{` 到最后一个 `}` 的 JSON 对象。专门处理 reasoning 模型把
 * 思考写在 content 里挤掉/弄乱 JSON 的情况。
 */
function parseJsonAfterThink(text: string): Record<string, unknown> | null {
  if (!text) return null;
  // 移除任意数量的 <think>...</think> 块（贪婪到对应 </think>）。
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // 也支持没闭合的情况：从最后一个 </think> 之后取
  const lastThinkEnd = stripped.lastIndexOf('</think>');
  const body =
    lastThinkEnd >= 0 ? stripped.slice(lastThinkEnd + 8) : stripped;
  const firstBrace = body.indexOf('{');
  const lastBrace = body.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  const candidate = body.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 输出归一化 + 用户已填字段过滤
// ─────────────────────────────────────────────────────────────

function normalizeAiOutput(
  section: SectionKey,
  raw: Record<string, unknown>,
  currentDraft: PrivateCharacterDto,
): AiGeneratedDraft {
  // 'all' 返回 6 个嵌套 section，分发到对应 normalizer。
  if (section === 'all') {
    return mergeDrafts(
      normalizeIdentity(asObj(raw.identity), currentDraft),
      normalizeExpertise(asObj(raw.expertise), currentDraft),
      normalizeTone(asObj(raw.tone), currentDraft),
      normalizePrompting(asObj(raw.prompting), currentDraft),
      normalizeMemory(asObj(raw.memory), currentDraft),
      normalizeRhythm(asObj(raw.rhythm), currentDraft),
    );
  }

  switch (section) {
    case 'identity':
      return normalizeIdentity(raw, currentDraft);
    case 'bioPersonality':
      return normalizeBioPersonality(raw, currentDraft);
    case 'expertise':
      return normalizeExpertise(raw, currentDraft);
    case 'tone':
      return normalizeTone(raw, currentDraft);
    case 'prompting':
      return normalizePrompting(raw, currentDraft);
    case 'memory':
      return normalizeMemory(raw, currentDraft);
    case 'rhythm':
      return normalizeRhythm(raw, currentDraft);
    default:
      return {};
  }
}

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function mergeDrafts(...parts: AiGeneratedDraft[]): AiGeneratedDraft {
  const out: AiGeneratedDraft = {};
  const recipe: AiGeneratedDraft['recipe'] = {};
  for (const p of parts) {
    if (p.bio !== undefined) out.bio = p.bio;
    if (p.personality !== undefined) out.personality = p.personality;
    if (p.relationship !== undefined) out.relationship = p.relationship;
    if (p.relationshipType !== undefined) {
      out.relationshipType = p.relationshipType;
    }
    if (p.expertDomains !== undefined) out.expertDomains = p.expertDomains;
    if (p.triggerScenes !== undefined) out.triggerScenes = p.triggerScenes;
    if (p.recipe) {
      if (p.recipe.identity) {
        recipe.identity = { ...(recipe.identity ?? {}), ...p.recipe.identity };
      }
      if (p.recipe.expertise) {
        recipe.expertise = {
          ...(recipe.expertise ?? {}),
          ...p.recipe.expertise,
        };
      }
      if (p.recipe.tone) {
        recipe.tone = { ...(recipe.tone ?? {}), ...p.recipe.tone };
      }
      if (p.recipe.prompting) {
        recipe.prompting = {
          ...(recipe.prompting ?? {}),
          ...p.recipe.prompting,
        };
      }
      if (p.recipe.memorySeed) {
        recipe.memorySeed = {
          ...(recipe.memorySeed ?? {}),
          ...p.recipe.memorySeed,
        };
      }
      if (p.recipe.reasoning) {
        recipe.reasoning = {
          ...(recipe.reasoning ?? {}),
          ...p.recipe.reasoning,
        };
      }
      if (p.recipe.lifeStrategy) {
        recipe.lifeStrategy = {
          ...(recipe.lifeStrategy ?? {}),
          ...p.recipe.lifeStrategy,
        };
      }
    }
  }
  if (Object.keys(recipe).length > 0) out.recipe = recipe;
  return out;
}

// ───── per-section normalizers ─────

function normalizeIdentity(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const out: AiGeneratedDraft = {};
  const id: Partial<CharacterBlueprintRecipe['identity']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curId = (curRecipe.identity ?? {}) as Partial<
    CharacterBlueprintRecipe['identity']
  >;

  const occupation = trimStr(raw.occupation);
  if (occupation && !curId.occupation?.trim()) id.occupation = occupation;

  const background = trimStr(raw.background);
  if (background && !curId.background?.trim()) id.background = background;

  // relationship 既存在 recipe.identity.relationship 又有顶层 dto.relationship；
  // 以顶层 dto 为准（用户在表单里改的是顶层）。
  const relationship = trimStr(raw.relationship);
  if (relationship && !current.relationship?.trim()) {
    out.relationship = relationship;
  }

  const relationshipType = trimStr(raw.relationshipType);
  if (
    relationshipType &&
    VALID_RELATIONSHIP_TYPES.has(relationshipType) &&
    !current.relationshipType?.trim()
  ) {
    out.relationshipType = relationshipType;
  }

  if (Object.keys(id).length > 0) out.recipe = { identity: id };
  return out;
}

function normalizeBioPersonality(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const out: AiGeneratedDraft = {};
  const id: Partial<CharacterBlueprintRecipe['identity']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curId = (curRecipe.identity ?? {}) as Partial<
    CharacterBlueprintRecipe['identity']
  >;

  const bio = trimStr(raw.bio);
  if (bio && !current.bio?.trim()) out.bio = bio;

  const personality = trimStr(raw.personality);
  if (personality && !current.personality?.trim()) out.personality = personality;

  const motivation = trimStr(raw.motivation);
  if (motivation && !curId.motivation?.trim()) id.motivation = motivation;

  const worldview = trimStr(raw.worldview);
  if (worldview && !curId.worldview?.trim()) id.worldview = worldview;

  if (Object.keys(id).length > 0) out.recipe = { identity: id };
  return out;
}

function normalizeExpertise(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const out: AiGeneratedDraft = {};
  const ex: Partial<CharacterBlueprintRecipe['expertise']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curEx = (curRecipe.expertise ?? {}) as Partial<
    CharacterBlueprintRecipe['expertise']
  >;

  // expertDomains 顶层；其它三个都是 recipe.expertise.*
  const expertDomains = cleanStringArray(raw.expertDomains);
  if (expertDomains.length > 0 && (current.expertDomains ?? []).length === 0) {
    out.expertDomains = expertDomains;
  }

  const expertiseDescription = trimStr(raw.expertiseDescription);
  if (expertiseDescription && !curEx.expertiseDescription?.trim()) {
    ex.expertiseDescription = expertiseDescription;
  }

  const knowledgeLimits = trimStr(raw.knowledgeLimits);
  if (knowledgeLimits && !curEx.knowledgeLimits?.trim()) {
    ex.knowledgeLimits = knowledgeLimits;
  }

  const refusalStyle = trimStr(raw.refusalStyle);
  if (refusalStyle && !curEx.refusalStyle?.trim()) {
    ex.refusalStyle = refusalStyle;
  }

  if (Object.keys(ex).length > 0) out.recipe = { expertise: ex };
  return out;
}

function normalizeTone(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const tn: Partial<CharacterBlueprintRecipe['tone']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curTn = (curRecipe.tone ?? {}) as Partial<
    CharacterBlueprintRecipe['tone']
  >;

  // 枚举字段：tone 的 v1 策略是只在"用户从未碰过且当前为默认值之外的空"时填。
  // 但 useState 初始就是 'occasional' / 'medium'。前端会再过一遍"只填空字符串"
  // 过滤；后端这里只做白名单收敛，不判空（无法判断是否用户主动选了默认值）。
  const emojiUsage = trimStr(raw.emojiUsage);
  if (emojiUsage && VALID_EMOJI_USAGE.has(emojiUsage)) {
    tn.emojiUsage = emojiUsage as 'none' | 'occasional' | 'frequent';
  }
  const responseLength = trimStr(raw.responseLength);
  if (responseLength && VALID_RESPONSE_LENGTH.has(responseLength)) {
    tn.responseLength = responseLength as 'short' | 'medium' | 'long';
  }

  const emotionalTone = trimStr(raw.emotionalTone);
  if (emotionalTone && !curTn.emotionalTone?.trim()) {
    tn.emotionalTone = emotionalTone;
  }
  const workStyle = trimStr(raw.workStyle);
  if (workStyle && !curTn.workStyle?.trim()) tn.workStyle = workStyle;
  const socialStyle = trimStr(raw.socialStyle);
  if (socialStyle && !curTn.socialStyle?.trim()) tn.socialStyle = socialStyle;

  const speechPatterns = cleanStringArray(raw.speechPatterns);
  if (speechPatterns.length > 0 && (curTn.speechPatterns ?? []).length === 0) {
    tn.speechPatterns = speechPatterns;
  }
  const catchphrases = cleanStringArray(raw.catchphrases);
  if (catchphrases.length > 0 && (curTn.catchphrases ?? []).length === 0) {
    tn.catchphrases = catchphrases;
  }
  const topicsOfInterest = cleanStringArray(raw.topicsOfInterest);
  if (
    topicsOfInterest.length > 0 &&
    (curTn.topicsOfInterest ?? []).length === 0
  ) {
    tn.topicsOfInterest = topicsOfInterest;
  }
  const taboos = cleanStringArray(raw.taboos);
  if (taboos.length > 0 && (curTn.taboos ?? []).length === 0) {
    tn.taboos = taboos;
  }
  const quirks = cleanStringArray(raw.quirks);
  if (quirks.length > 0 && (curTn.quirks ?? []).length === 0) {
    tn.quirks = quirks;
  }

  return Object.keys(tn).length > 0 ? { recipe: { tone: tn } } : {};
}

function normalizePrompting(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const pr: Partial<CharacterBlueprintRecipe['prompting']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curPr = (curRecipe.prompting ?? {}) as Partial<
    CharacterBlueprintRecipe['prompting']
  >;

  const coreLogic = trimStr(raw.coreLogic);
  if (coreLogic && !curPr.coreLogic?.trim()) pr.coreLogic = coreLogic;

  const sp = asObj(raw.scenePrompts);
  const curSp = (curPr.scenePrompts ?? {}) as Partial<
    CharacterBlueprintRecipe['prompting']['scenePrompts']
  >;
  const scenes: Partial<CharacterBlueprintRecipe['prompting']['scenePrompts']> =
    {};
  const sceneKeys: Array<
    keyof CharacterBlueprintRecipe['prompting']['scenePrompts']
  > = [
    'chat',
    'moments_post',
    'moments_comment',
    'feed_post',
    'channel_post',
    'feed_comment',
    'greeting',
    'proactive',
  ];
  for (const k of sceneKeys) {
    const keyStr = String(k);
    const v = trimStr(sp[keyStr]);
    if (v && !curSp[k]?.trim()) scenes[k] = v;
  }
  if (Object.keys(scenes).length > 0) {
    pr.scenePrompts = {
      chat: '',
      moments_post: '',
      moments_comment: '',
      feed_post: '',
      channel_post: '',
      feed_comment: '',
      greeting: '',
      proactive: '',
      ...scenes,
    };
  }

  return Object.keys(pr).length > 0 ? { recipe: { prompting: pr } } : {};
}

function normalizeMemory(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const ms: Partial<CharacterBlueprintRecipe['memorySeed']> = {};
  const rs: Partial<CharacterBlueprintRecipe['reasoning']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curMs = (curRecipe.memorySeed ?? {}) as Partial<
    CharacterBlueprintRecipe['memorySeed']
  >;

  const memorySummary = trimStr(raw.memorySummary);
  if (memorySummary && !curMs.memorySummary?.trim()) {
    ms.memorySummary = memorySummary;
  }
  const coreMemory = trimStr(raw.coreMemory);
  if (coreMemory && !curMs.coreMemory?.trim()) ms.coreMemory = coreMemory;
  const recentSummarySeed = trimStr(raw.recentSummarySeed);
  if (recentSummarySeed && !curMs.recentSummarySeed?.trim()) {
    ms.recentSummarySeed = recentSummarySeed;
  }

  // recommendedReasoningToggles 是 prompt 设计里要求 LLM 输出建议，
  // 前端会把它当作"如果用户没碰过这三个开关，按建议设"——但 v1 前端
  // 只对字符串字段做"空"判断，所以这里把建议也返回，前端可决定是否应用。
  const toggles = asObj(raw.recommendedReasoningToggles);
  if (typeof toggles.enableCoT === 'boolean') rs.enableCoT = toggles.enableCoT;
  if (typeof toggles.enableReflection === 'boolean') {
    rs.enableReflection = toggles.enableReflection;
  }
  if (typeof toggles.enableRouting === 'boolean') {
    rs.enableRouting = toggles.enableRouting;
  }

  const out: AiGeneratedDraft = {};
  const recipe: AiGeneratedDraft['recipe'] = {};
  if (Object.keys(ms).length > 0) recipe.memorySeed = ms;
  if (Object.keys(rs).length > 0) recipe.reasoning = rs;
  if (Object.keys(recipe).length > 0) out.recipe = recipe;
  return out;
}

function normalizeRhythm(
  raw: Record<string, unknown>,
  current: PrivateCharacterDto,
): AiGeneratedDraft {
  const ls: Partial<CharacterBlueprintRecipe['lifeStrategy']> = {};
  const curRecipe = (current.recipe ?? {}) as Partial<CharacterBlueprintRecipe>;
  const curLs = (curRecipe.lifeStrategy ?? {}) as Partial<
    CharacterBlueprintRecipe['lifeStrategy']
  >;

  const activityFrequency = trimStr(raw.activityFrequency);
  if (
    activityFrequency &&
    VALID_ACTIVITY_FREQUENCY.has(activityFrequency) &&
    !curLs.activityFrequency
  ) {
    ls.activityFrequency = activityFrequency;
  }

  const momentsFrequency = clampInt(raw.momentsFrequency, 0, 5);
  if (momentsFrequency !== null && curLs.momentsFrequency === undefined) {
    ls.momentsFrequency = momentsFrequency;
  }
  const feedFrequency = clampInt(raw.feedFrequency, 0, 3);
  if (feedFrequency !== null && curLs.feedFrequency === undefined) {
    ls.feedFrequency = feedFrequency;
  }
  const activeHoursStart = clampIntOrNull(raw.activeHoursStart, 0, 23);
  if (activeHoursStart !== undefined && curLs.activeHoursStart === undefined) {
    ls.activeHoursStart = activeHoursStart;
  }
  const activeHoursEnd = clampIntOrNull(raw.activeHoursEnd, 0, 23);
  if (activeHoursEnd !== undefined && curLs.activeHoursEnd === undefined) {
    ls.activeHoursEnd = activeHoursEnd;
  }

  const triggerScenes = cleanStringArray(raw.triggerScenes);
  const out: AiGeneratedDraft = {};
  if (triggerScenes.length > 0 && (current.triggerScenes ?? []).length === 0) {
    out.triggerScenes = triggerScenes;
  }

  if (Object.keys(ls).length > 0) out.recipe = { lifeStrategy: ls };
  return out;
}

// ───── helpers ─────

function trimStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function clampInt(v: unknown, min: number, max: number): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(min, Math.min(max, Math.round(v)));
  }
  if (typeof v === 'string' && v.trim()) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  }
  return null;
}

function clampIntOrNull(
  v: unknown,
  min: number,
  max: number,
): number | null | undefined {
  // 返回 undefined 表示"AI 没有给值"；null 表示 AI 明确给 null；数字就 clamp。
  if (v === null) return null;
  if (v === undefined) return undefined;
  return clampInt(v, min, max);
}
// i18n-ignore-end
