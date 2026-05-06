import { AbuseFilterService } from './abuse-filter.service';
import type {
  AbuseFilterPattern,
} from '../entities/abuse-filter.entity';
import type { AbuseFilterCheckInput } from './abuse-filter.service';

// Build a service instance with stubbed repos so we can exercise the pure
// pattern evaluator in isolation.
function makeService() {
  const filterRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const hitRepo = {
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const revisionRepo = {
    count: jest.fn().mockResolvedValue(0),
  };
  const svc = new AbuseFilterService(
    filterRepo as never,
    hitRepo as never,
    revisionRepo as never,
  );
  return { svc, filterRepo, hitRepo, revisionRepo };
}

const baseInput: AbuseFilterCheckInput = {
  user: { id: 'u1', role: 'newcomer', username: 'u1' } as never,
  characterId: 'char_1',
  operation: 'edit',
  contentSnapshot: {
    name: '甲',
    avatar: '',
    bio: '一段普通介绍',
    relationship: '邻居',
    relationshipType: 'friend',
    expertDomains: [],
  },
};

describe('AbuseFilterService pattern evaluator', () => {
  describe('regex', () => {
    it('matches against default content + recipe text fields', async () => {
      const { svc } = makeService();
      const pattern: AbuseFilterPattern = {
        type: 'regex',
        regex: '违禁词',
      };
      const out = await svc.evaluatePattern(pattern, {
        ...baseInput,
        contentSnapshot: { ...baseInput.contentSnapshot!, bio: '含有违禁词的描述' },
      });
      expect(out).not.toBeNull();
    });

    it('respects explicit fields list', async () => {
      const { svc } = makeService();
      const pattern: AbuseFilterPattern = {
        type: 'regex',
        regex: 'foo',
        fields: ['content.bio'],
      };
      const noMatch = await svc.evaluatePattern(pattern, {
        ...baseInput,
        contentSnapshot: { ...baseInput.contentSnapshot!, name: 'foo' },
      });
      expect(noMatch).toBeNull();

      const match = await svc.evaluatePattern(pattern, {
        ...baseInput,
        contentSnapshot: { ...baseInput.contentSnapshot!, bio: 'has foo' },
      });
      expect(match).not.toBeNull();
    });
  });

  describe('shrink', () => {
    it('hits when content shrinks past threshold', async () => {
      const { svc } = makeService();
      const pattern: AbuseFilterPattern = {
        type: 'shrink',
        field: 'bio',
        threshold: 0.8,
      };
      const out = await svc.evaluatePattern(pattern, {
        ...baseInput,
        beforeContent: {
          ...baseInput.contentSnapshot!,
          bio: '这是一段非常长的内容'.repeat(20),
        },
        contentSnapshot: { ...baseInput.contentSnapshot!, bio: '短' },
      });
      expect(out).toMatch(/shrink/);
    });

    it('does not hit when shrink is below threshold', async () => {
      const { svc } = makeService();
      const out = await svc.evaluatePattern(
        { type: 'shrink', field: 'bio', threshold: 0.8 },
        {
          ...baseInput,
          beforeContent: { ...baseInput.contentSnapshot!, bio: 'abcdef' },
          contentSnapshot: { ...baseInput.contentSnapshot!, bio: 'abcde' },
        },
      );
      expect(out).toBeNull();
    });
  });

  describe('link_flood', () => {
    it('hits when text has > threshold http(s) links', async () => {
      const { svc } = makeService();
      const out = await svc.evaluatePattern(
        { type: 'link_flood', threshold: 5 },
        {
          ...baseInput,
          contentSnapshot: {
            ...baseInput.contentSnapshot!,
            bio: 'https://a.com https://b.com https://c.com https://d.com https://e.com https://f.com',
          },
        },
      );
      expect(out).toMatch(/link_flood/);
    });
  });

  describe('keyword_list', () => {
    it('case-insensitive by default', async () => {
      const { svc } = makeService();
      const out = await svc.evaluatePattern(
        { type: 'keyword_list', keywords: ['加微信'] },
        { ...baseInput, contentSnapshot: { ...baseInput.contentSnapshot!, bio: '想了解请加微信' } },
      );
      expect(out).toBe('keyword: 加微信');
    });
  });

  describe('frequency', () => {
    it('hits when revision count >= maxEdits', async () => {
      const { svc, revisionRepo } = makeService();
      revisionRepo.count.mockResolvedValueOnce(6);
      const out = await svc.evaluatePattern(
        { type: 'frequency', windowSec: 60, maxEdits: 5 },
        baseInput,
      );
      expect(out).toMatch(/frequency/);
    });
  });
});
