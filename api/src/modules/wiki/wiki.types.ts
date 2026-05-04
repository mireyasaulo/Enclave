import type { WikiContentSnapshot } from './entities/character-revision.entity';
import type { CharacterBlueprintRecipeValue } from '../characters/character-blueprint.types';

export const WIKI_CONTENT_FIELDS = [
  'name',
  'avatar',
  'bio',
  'personality',
  'expertDomains',
  'triggerScenes',
  'relationship',
  'relationshipType',
] as const;

export type WikiContentField = (typeof WIKI_CONTENT_FIELDS)[number];

export function pickWikiContent(input: Record<string, unknown>): WikiContentSnapshot {
  return {
    name: String(input.name ?? '').trim(),
    avatar: String(input.avatar ?? '').trim(),
    bio: String(input.bio ?? '').trim(),
    personality:
      input.personality === undefined || input.personality === null
        ? undefined
        : String(input.personality),
    expertDomains: Array.isArray(input.expertDomains)
      ? (input.expertDomains as unknown[]).map((v) => String(v))
      : [],
    triggerScenes: Array.isArray(input.triggerScenes)
      ? (input.triggerScenes as unknown[]).map((v) => String(v))
      : undefined,
    relationship: String(input.relationship ?? '').trim(),
    relationshipType: String(input.relationshipType ?? '').trim(),
  };
}

export function snapshotFromCharacter(char: Record<string, unknown>): WikiContentSnapshot {
  return pickWikiContent(char);
}

export function snapshotFromRecipe(
  recipe: CharacterBlueprintRecipeValue,
): WikiContentSnapshot {
  return {
    name: recipe.identity.name,
    avatar: recipe.identity.avatar,
    bio: recipe.identity.bio,
    personality: recipe.tone.emotionalTone,
    expertDomains: [...recipe.expertise.expertDomains],
    triggerScenes: [...recipe.lifeStrategy.triggerScenes],
    relationship: recipe.identity.relationship,
    relationshipType: recipe.identity.relationshipType,
  };
}

export function normalizeWikiRecipe(
  input: Record<string, unknown>,
  fallback?: CharacterBlueprintRecipeValue | null,
): CharacterBlueprintRecipeValue {
  const source = input as Partial<CharacterBlueprintRecipeValue>;
  const base = fallback ?? createDefaultWikiRecipe(input);

  return {
    identity: {
      name: str(source.identity?.name, base.identity.name),
      relationship: str(source.identity?.relationship, base.identity.relationship),
      relationshipType: str(
        source.identity?.relationshipType,
        base.identity.relationshipType,
      ),
      avatar: str(source.identity?.avatar, base.identity.avatar),
      bio: str(source.identity?.bio, base.identity.bio),
      occupation: str(source.identity?.occupation, base.identity.occupation),
      background: str(source.identity?.background, base.identity.background),
      motivation: str(source.identity?.motivation, base.identity.motivation),
      worldview: str(source.identity?.worldview, base.identity.worldview),
    },
    expertise: {
      expertDomains: stringList(
        source.expertise?.expertDomains,
        base.expertise.expertDomains,
      ),
      expertiseDescription: str(
        source.expertise?.expertiseDescription,
        base.expertise.expertiseDescription,
      ),
      knowledgeLimits: str(
        source.expertise?.knowledgeLimits,
        base.expertise.knowledgeLimits,
      ),
      refusalStyle: str(source.expertise?.refusalStyle, base.expertise.refusalStyle),
    },
    tone: {
      speechPatterns: stringList(source.tone?.speechPatterns, base.tone.speechPatterns),
      catchphrases: stringList(source.tone?.catchphrases, base.tone.catchphrases),
      topicsOfInterest: stringList(
        source.tone?.topicsOfInterest,
        base.tone.topicsOfInterest,
      ),
      emotionalTone: str(source.tone?.emotionalTone, base.tone.emotionalTone),
      responseLength: responseLength(
        source.tone?.responseLength,
        base.tone.responseLength,
      ),
      emojiUsage: emojiUsage(source.tone?.emojiUsage, base.tone.emojiUsage),
      workStyle: str(source.tone?.workStyle, base.tone.workStyle),
      socialStyle: str(source.tone?.socialStyle, base.tone.socialStyle),
      taboos: stringList(source.tone?.taboos, base.tone.taboos),
      quirks: stringList(source.tone?.quirks, base.tone.quirks),
      coreDirective: str(source.tone?.coreDirective, base.tone.coreDirective),
      basePrompt: str(source.tone?.basePrompt, base.tone.basePrompt),
      systemPrompt: str(source.tone?.systemPrompt, base.tone.systemPrompt),
    },
    prompting: {
      coreLogic: str(source.prompting?.coreLogic, base.prompting.coreLogic),
      scenePrompts: {
        chat: str(
          source.prompting?.scenePrompts?.chat,
          base.prompting.scenePrompts.chat,
        ),
        moments_post: str(
          source.prompting?.scenePrompts?.moments_post,
          base.prompting.scenePrompts.moments_post,
        ),
        moments_comment: str(
          source.prompting?.scenePrompts?.moments_comment,
          base.prompting.scenePrompts.moments_comment,
        ),
        feed_post: str(
          source.prompting?.scenePrompts?.feed_post,
          base.prompting.scenePrompts.feed_post,
        ),
        channel_post: str(
          source.prompting?.scenePrompts?.channel_post,
          base.prompting.scenePrompts.channel_post,
        ),
        feed_comment: str(
          source.prompting?.scenePrompts?.feed_comment,
          base.prompting.scenePrompts.feed_comment,
        ),
        greeting: str(
          source.prompting?.scenePrompts?.greeting,
          base.prompting.scenePrompts.greeting,
        ),
        proactive: str(
          source.prompting?.scenePrompts?.proactive,
          base.prompting.scenePrompts.proactive,
        ),
      },
    },
    memorySeed: {
      memorySummary: str(source.memorySeed?.memorySummary, base.memorySeed.memorySummary),
      coreMemory: str(source.memorySeed?.coreMemory, base.memorySeed.coreMemory),
      recentSummarySeed: str(
        source.memorySeed?.recentSummarySeed,
        base.memorySeed.recentSummarySeed,
      ),
      forgettingCurve: boundedNumber(
        source.memorySeed?.forgettingCurve,
        base.memorySeed.forgettingCurve,
        0,
        100,
      ),
      recentSummaryPrompt: str(
        source.memorySeed?.recentSummaryPrompt,
        base.memorySeed.recentSummaryPrompt,
      ),
      coreMemoryPrompt: str(
        source.memorySeed?.coreMemoryPrompt,
        base.memorySeed.coreMemoryPrompt,
      ),
    },
    reasoning: {
      enableCoT: bool(source.reasoning?.enableCoT, base.reasoning.enableCoT),
      enableReflection: bool(
        source.reasoning?.enableReflection,
        base.reasoning.enableReflection,
      ),
      enableRouting: bool(
        source.reasoning?.enableRouting,
        base.reasoning.enableRouting,
      ),
    },
    lifeStrategy: {
      activityFrequency: str(
        source.lifeStrategy?.activityFrequency,
        base.lifeStrategy.activityFrequency,
      ),
      momentsFrequency: Math.max(
        0,
        Math.round(num(source.lifeStrategy?.momentsFrequency, base.lifeStrategy.momentsFrequency)),
      ),
      feedFrequency: Math.max(
        0,
        Math.round(num(source.lifeStrategy?.feedFrequency, base.lifeStrategy.feedFrequency)),
      ),
      activeHoursStart: nullableHour(
        source.lifeStrategy?.activeHoursStart,
        base.lifeStrategy.activeHoursStart,
      ),
      activeHoursEnd: nullableHour(
        source.lifeStrategy?.activeHoursEnd,
        base.lifeStrategy.activeHoursEnd,
      ),
      triggerScenes: stringList(
        source.lifeStrategy?.triggerScenes,
        base.lifeStrategy.triggerScenes,
      ),
    },
    publishMapping: {
      isTemplate: bool(source.publishMapping?.isTemplate, base.publishMapping.isTemplate),
      onlineModeDefault:
        source.publishMapping?.onlineModeDefault === 'manual' ? 'manual' : 'auto',
      activityModeDefault:
        source.publishMapping?.activityModeDefault === 'manual' ? 'manual' : 'auto',
      initialOnline: bool(
        source.publishMapping?.initialOnline,
        base.publishMapping.initialOnline,
      ),
      initialActivity:
        source.publishMapping?.initialActivity === null
          ? null
          : str(
              source.publishMapping?.initialActivity,
              base.publishMapping.initialActivity ?? '',
            ) || null,
    },
    realityLink:
      source.realityLink === undefined ? base.realityLink ?? null : source.realityLink ?? null,
  };
}

export function createDefaultWikiRecipe(
  input: Record<string, unknown> = {},
): CharacterBlueprintRecipeValue {
  const content = pickWikiContent(input);
  return {
    identity: {
      name: content.name || '未命名角色',
      relationship: content.relationship || '世界角色',
      relationshipType: content.relationshipType || 'custom',
      avatar: content.avatar || '',
      bio: content.bio || '',
      occupation: '',
      background: '',
      motivation: '',
      worldview: '',
    },
    expertise: {
      expertDomains: content.expertDomains.length ? content.expertDomains : ['general'],
      expertiseDescription: '',
      knowledgeLimits: '',
      refusalStyle: '',
    },
    tone: {
      speechPatterns: [],
      catchphrases: [],
      topicsOfInterest: [],
      emotionalTone: content.personality || 'grounded',
      responseLength: 'medium',
      emojiUsage: 'occasional',
      workStyle: '',
      socialStyle: '',
      taboos: [],
      quirks: [],
      coreDirective: '',
      basePrompt: '',
      systemPrompt: '',
    },
    prompting: {
      coreLogic: '',
      scenePrompts: {
        chat: '',
        moments_post: '',
        moments_comment: '',
        feed_post: '',
        channel_post: '',
        feed_comment: '',
        greeting: '',
        proactive: '',
      },
    },
    memorySeed: {
      memorySummary: '',
      coreMemory: '',
      recentSummarySeed: '',
      forgettingCurve: 70,
      recentSummaryPrompt: '',
      coreMemoryPrompt: '',
    },
    reasoning: {
      enableCoT: true,
      enableReflection: true,
      enableRouting: true,
    },
    lifeStrategy: {
      activityFrequency: 'normal',
      momentsFrequency: 1,
      feedFrequency: 1,
      activeHoursStart: 8,
      activeHoursEnd: 23,
      triggerScenes: content.triggerScenes ?? [],
    },
    publishMapping: {
      isTemplate: false,
      onlineModeDefault: 'auto',
      activityModeDefault: 'auto',
      initialOnline: false,
      initialActivity: 'free',
    },
    realityLink: null,
  };
}

export function diffPaths(left: unknown, right: unknown, prefix = ''): string[] {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  const leftObject =
    typeof left === 'object' && left !== null && !Array.isArray(left);
  const rightObject =
    typeof right === 'object' && right !== null && !Array.isArray(right);
  if (!leftObject || !rightObject) return [prefix || 'root'];
  const keys = new Set([
    ...Object.keys(left as Record<string, unknown>),
    ...Object.keys(right as Record<string, unknown>),
  ]);
  const result: string[] = [];
  for (const key of keys) {
    result.push(
      ...diffPaths(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
  }
  return result;
}

export function hasPathOverlap(left: string[], right: string[]): boolean {
  return left.some((leftPath) =>
    right.some(
      (rightPath) =>
        leftPath === rightPath ||
        leftPath.startsWith(`${rightPath}.`) ||
        rightPath.startsWith(`${leftPath}.`),
    ),
  );
}

export function mergeContentSnapshot(
  current: WikiContentSnapshot,
  submitted: WikiContentSnapshot,
  changedFields: WikiContentField[],
): WikiContentSnapshot {
  const merged: WikiContentSnapshot = {
    ...current,
    expertDomains: [...current.expertDomains],
    triggerScenes: current.triggerScenes ? [...current.triggerScenes] : undefined,
  };
  for (const field of changedFields) {
    const value = submitted[field];
    (merged as Record<string, unknown>)[field] = Array.isArray(value)
      ? [...value]
      : value;
  }
  return merged;
}

export function mergeValueByPaths<T>(current: T, submitted: T, paths: string[]): T {
  const merged = structuredCloneFallback(current);
  for (const path of paths) {
    setPathValue(
      merged as Record<string, unknown>,
      path,
      structuredCloneFallback(getPathValue(submitted, path)),
    );
  }
  return merged;
}

export function isHighRiskRecipeChange(paths: string[]): boolean {
  return paths.some((path) =>
    [
      'prompting.',
      'memorySeed.',
      'reasoning.',
      'lifeStrategy.',
      'tone.',
      'expertise.',
      'publishMapping.',
      'realityLink',
    ].some((prefix) => path === prefix.replace(/\.$/, '') || path.startsWith(prefix)),
  );
}

function getPathValue(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object') {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, input);
}

function setPathValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1] ?? path] = value;
}

function structuredCloneFallback<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function diffFields(
  before: WikiContentSnapshot,
  after: WikiContentSnapshot,
): WikiContentField[] {
  const changed: WikiContentField[] = [];
  for (const key of WIKI_CONTENT_FIELDS) {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) changed.push(key);
  }
  return changed;
}

function str(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function stringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return Math.min(Math.max(Math.round(num(value, fallback)), min), max);
}

function nullableHour(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  const parsed = num(value, fallback ?? 0);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 0), 23);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function responseLength(
  value: unknown,
  fallback: 'short' | 'medium' | 'long',
): 'short' | 'medium' | 'long' {
  return value === 'short' || value === 'medium' || value === 'long'
    ? value
    : fallback;
}

function emojiUsage(
  value: unknown,
  fallback: 'none' | 'occasional' | 'frequent',
): 'none' | 'occasional' | 'frequent' {
  return value === 'none' || value === 'occasional' || value === 'frequent'
    ? value
    : fallback;
}
