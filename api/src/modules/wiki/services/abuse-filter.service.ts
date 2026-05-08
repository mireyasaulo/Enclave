// i18n-ignore-start: data / seed / preset content — not user-facing UI.
import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppError } from '../../../common/app-error.exception';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import type { CharacterBlueprintRecipeValue } from '../../characters/character-blueprint.types';
import type { WikiContentSnapshot } from '../entities/character-revision.entity';
import { CharacterRevisionEntity } from '../entities/character-revision.entity';
import {
  AbuseFilterEntity,
  type AbuseFilterAction,
  type AbuseFilterPattern,
  type AbuseFilterScope,
} from '../entities/abuse-filter.entity';
import { AbuseFilterHitEntity } from '../entities/abuse-filter-hit.entity';
import { ABUSE_FILTER_SEEDS } from '../seed/abuse-filters.seed';

export type AbuseFilterCheckInput = {
  user: AuthenticatedUser;
  characterId: string;
  contentSnapshot?: WikiContentSnapshot | null;
  recipeSnapshot?: CharacterBlueprintRecipeValue | null;
  beforeContent?: WikiContentSnapshot | null;
  beforeRecipe?: CharacterBlueprintRecipeValue | null;
  operation: string;
  isCreate?: boolean;
};

export type AbuseFilterCheckResult = {
  action: 'pass' | AbuseFilterAction;
  hits: Array<{
    filterId: string;
    filterName: string;
    actionTaken: AbuseFilterAction;
    matchedText: string;
  }>;
  warnings: string[];
};

const ACTION_ORDER: Record<AbuseFilterAction | 'pass', number> = {
  pass: 0,
  log: 1,
  warn: 2,
  tag_high_risk: 3,
  block: 4,
};

const DEFAULT_REGEX_FIELDS = [
  'content.name',
  'content.bio',
  'content.personality',
  'content.relationship',
  'recipe.identity.name',
  'recipe.identity.bio',
  'recipe.identity.background',
  'recipe.identity.motivation',
  'recipe.identity.worldview',
  'recipe.tone.emotionalTone',
];

@Injectable()
export class AbuseFilterService implements OnModuleInit {
  private readonly logger = new Logger(AbuseFilterService.name);
  private cache: AbuseFilterEntity[] = [];

  constructor(
    @InjectRepository(AbuseFilterEntity)
    private readonly filterRepo: Repository<AbuseFilterEntity>,
    @InjectRepository(AbuseFilterHitEntity)
    private readonly hitRepo: Repository<AbuseFilterHitEntity>,
    @InjectRepository(CharacterRevisionEntity)
    private readonly revisionRepo: Repository<CharacterRevisionEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    this.cache = await this.filterRepo.find({ where: { enabled: true } });
  }

  async check(input: AbuseFilterCheckInput): Promise<AbuseFilterCheckResult> {
    const matches: Array<{
      filter: AbuseFilterEntity;
      matchedText: string;
    }> = [];

    for (const filter of this.cache) {
      if (!matchesScope(filter.scope, input)) continue;
      const matchedText = await this.evaluatePattern(filter.pattern, input);
      if (matchedText !== null) {
        matches.push({ filter, matchedText });
      }
    }

    if (matches.length === 0) {
      return { action: 'pass', hits: [], warnings: [] };
    }

    let topAction: AbuseFilterAction = 'log';
    for (const { filter } of matches) {
      if (ACTION_ORDER[filter.action] > ACTION_ORDER[topAction]) {
        topAction = filter.action;
      }
    }

    const hits = matches.map(({ filter, matchedText }) => ({
      filterId: filter.id,
      filterName: filter.name,
      actionTaken: filter.action,
      matchedText: matchedText.slice(0, 500),
    }));

    const warnings = matches
      .filter(({ filter }) => filter.action === 'warn')
      .map(({ filter }) => `命中过滤器 [${filter.name}]：${filter.description}`);

    // Persist hits + bump filter counters (best-effort, don't block on write).
    try {
      for (const { filter, matchedText } of matches) {
        await this.hitRepo.save(
          this.hitRepo.create({
            filterId: filter.id,
            userId: input.user.id,
            characterId: input.characterId ?? null,
            matchedText: matchedText.slice(0, 500),
            actionTaken: filter.action,
            operation: input.operation,
          }),
        );
        await this.filterRepo.update(
          { id: filter.id },
          {
            hitCount: filter.hitCount + 1,
            lastHitAt: new Date(),
          },
        );
        filter.hitCount += 1;
        filter.lastHitAt = new Date();
      }
    } catch (err) {
      this.logger.warn(
        `Failed to persist abuse filter hit: ${(err as Error).message}`,
      );
    }

    if (topAction === 'block') {
      throw new AppError('WIKI_ABUSE_FILTER_TRIGGERED', {
        status: HttpStatus.FORBIDDEN,
        params: {
          filter: matches[0]?.filter.name ?? 'abuse_filter',
          hitCount: hits.length,
        },
        legacyMessage: `编辑被反破坏过滤器拦截：${matches[0]?.filter.name ?? 'abuse_filter'}`,
      });
    }

    return { action: topAction, hits, warnings };
  }

  /**
   * Returns matched text on hit, or null if no match.
   * Public for testability.
   */
  async evaluatePattern(
    pattern: AbuseFilterPattern,
    input: AbuseFilterCheckInput,
  ): Promise<string | null> {
    switch (pattern.type) {
      case 'regex': {
        const fields = pattern.fields ?? DEFAULT_REGEX_FIELDS;
        const re = new RegExp(pattern.regex, pattern.flags ?? 'i');
        for (const path of fields) {
          const value = readPath(input, path);
          if (typeof value === 'string' && re.test(value)) {
            return value.slice(0, 500);
          }
        }
        return null;
      }
      case 'shrink': {
        const before = readPath(input, `before.content.${pattern.field}`);
        const after = readPath(input, `content.${pattern.field}`);
        if (typeof before !== 'string' || typeof after !== 'string') return null;
        const beforeLen = before.length;
        const afterLen = after.length;
        if (beforeLen === 0) return null;
        const ratio = (beforeLen - afterLen) / beforeLen;
        if (ratio > pattern.threshold) {
          return `${pattern.field}: ${beforeLen} -> ${afterLen} (shrink ${(
            ratio * 100
          ).toFixed(0)}%)`;
        }
        return null;
      }
      case 'frequency': {
        if (!input.user?.id) return null;
        const cutoff = new Date(Date.now() - pattern.windowSec * 1000);
        const count = await this.revisionRepo.count({
          where: {
            editorUserId: input.user.id,
            createdAt: MoreThan(cutoff) as unknown as Date,
          },
        });
        if (count >= pattern.maxEdits) {
          return `frequency: ${count} edits in last ${pattern.windowSec}s`;
        }
        return null;
      }
      case 'link_flood': {
        const text = collectAllText(input);
        const matches = text.match(/https?:\/\//gi);
        if (matches && matches.length > pattern.threshold) {
          return `link_flood: ${matches.length} links`;
        }
        return null;
      }
      case 'keyword_list': {
        const text = collectAllText(input);
        const haystack = pattern.caseSensitive ? text : text.toLowerCase();
        for (const kw of pattern.keywords) {
          const needle = pattern.caseSensitive ? kw : kw.toLowerCase();
          if (haystack.includes(needle)) {
            return `keyword: ${kw}`;
          }
        }
        return null;
      }
      default:
        return null;
    }
  }

  // CRUD for admin

  async listFilters(): Promise<AbuseFilterEntity[]> {
    return this.filterRepo.find({ order: { createdAt: 'ASC' } });
  }

  async getFilter(id: string): Promise<AbuseFilterEntity> {
    const f = await this.filterRepo.findOne({ where: { id } });
    if (!f) throw new AppError('WIKI_PAGE_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        legacyMessage: '过滤器不存在',
      });
    return f;
  }

  async createFilter(
    input: Pick<
      AbuseFilterEntity,
      | 'name'
      | 'description'
      | 'enabled'
      | 'pattern'
      | 'scope'
      | 'action'
      | 'severity'
    > & { createdBy?: string | null },
  ): Promise<AbuseFilterEntity> {
    const created = this.filterRepo.create(input);
    const saved = await this.filterRepo.save(created);
    await this.refreshCache();
    return saved;
  }

  async updateFilter(
    id: string,
    patch: Partial<AbuseFilterEntity>,
  ): Promise<AbuseFilterEntity> {
    await this.filterRepo.update({ id }, patch);
    await this.refreshCache();
    return this.getFilter(id);
  }

  async deleteFilter(id: string): Promise<void> {
    await this.filterRepo.delete({ id });
    await this.refreshCache();
  }

  async listHits(opts: {
    filterId?: string;
    userId?: string;
    limit?: number;
  }): Promise<AbuseFilterHitEntity[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const where: Record<string, unknown> = {};
    if (opts.filterId) where.filterId = opts.filterId;
    if (opts.userId) where.userId = opts.userId;
    return this.hitRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async deleteHitsBefore(date: Date): Promise<number> {
    const result = await this.hitRepo.delete({
      createdAt: LessThan(date) as unknown as Date,
    });
    return result.affected ?? 0;
  }

  private async seedDefaults(): Promise<void> {
    for (const seed of ABUSE_FILTER_SEEDS) {
      const existing = await this.filterRepo.findOne({
        where: { name: seed.name },
      });
      if (!existing) {
        await this.filterRepo.save(this.filterRepo.create(seed));
      }
    }
  }
}

function matchesScope(
  scope: AbuseFilterScope,
  input: AbuseFilterCheckInput,
): boolean {
  if (scope === 'all') return true;
  if (scope === 'content') return Boolean(input.contentSnapshot);
  if (scope === 'recipe') return Boolean(input.recipeSnapshot);
  return true;
}

function readPath(input: AbuseFilterCheckInput, path: string): unknown {
  const segments = path.split('.');
  let cursor: unknown = input;
  let head = segments[0];
  if (head === 'content') {
    cursor = input.contentSnapshot;
    segments.shift();
  } else if (head === 'recipe') {
    cursor = input.recipeSnapshot;
    segments.shift();
  } else if (head === 'before') {
    segments.shift();
    head = segments[0];
    if (head === 'content') {
      cursor = input.beforeContent;
      segments.shift();
    } else if (head === 'recipe') {
      cursor = input.beforeRecipe;
      segments.shift();
    }
  }
  for (const segment of segments) {
    if (cursor && typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function collectAllText(input: AbuseFilterCheckInput): string {
  const parts: string[] = [];
  const c = input.contentSnapshot;
  if (c) {
    parts.push(c.name, c.bio, c.personality ?? '', c.relationship);
    if (c.expertDomains) parts.push(...c.expertDomains);
    if (c.triggerScenes) parts.push(...c.triggerScenes);
  }
  const r = input.recipeSnapshot;
  if (r) {
    parts.push(
      r.identity?.name ?? '',
      r.identity?.bio ?? '',
      r.identity?.background ?? '',
      r.identity?.motivation ?? '',
      r.identity?.worldview ?? '',
      r.tone?.emotionalTone ?? '',
      r.tone?.workStyle ?? '',
      r.tone?.socialStyle ?? '',
      r.tone?.coreDirective ?? '',
      r.tone?.basePrompt ?? '',
      r.tone?.systemPrompt ?? '',
      r.prompting?.coreLogic ?? '',
      ...Object.values(r.prompting?.scenePrompts ?? {}),
      r.memorySeed?.memorySummary ?? '',
      r.memorySeed?.coreMemory ?? '',
    );
  }
  return parts.filter((p) => typeof p === 'string').join('\n');
}
// i18n-ignore-end
