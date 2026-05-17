import { CharactersService } from './characters.service';
import type { CharacterEntity } from './character.entity';

// 关注 importPersonalCharacter 在「修复 #1 / #4」后的边界：
//   1) existing.sourceType !== 'private_import' → CONFLICT（拒绝覆盖内置/admin/preset）
//   2) existing.deletionPolicy === 'protected' → CONFLICT
//   3) profile 未给 + recipe 给 → 调 blueprint service 派生 profile，不静默丢
//   4) profile 已给 + recipe 也给 → 用 profile（profile 优先），不调 blueprint
//   5) 字段长度上限触发 → BadRequest

type Char = Partial<CharacterEntity> & { id: string; name: string };

function makeService(opts: {
  existing?: Char | null;
  ownerId?: string;
  buildProfileSpy?: jest.Mock;
} = {}) {
  const repo = {
    findOne: jest.fn(async () => opts.existing ?? null),
    save: jest.fn(async (row: Char) => row),
    create: jest.fn((init: Char) => init),
  };
  const friendshipRepo = {
    findOne: jest.fn(async () => null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((init: unknown) => init),
  };
  const worldOwnerService = {
    getOwnerOrThrow: jest.fn(async () => ({ id: opts.ownerId ?? 'owner-1' })),
  };
  const dataSource = { transaction: jest.fn() };
  const realWorldRuntimeProfile = {};
  const buildProfileSpy =
    opts.buildProfileSpy ?? jest.fn(() => ({ derived: true }));
  const blueprintService = {
    buildProfileFromRecipe: buildProfileSpy,
  };

  // CharactersService 的构造签名：(repo, friendshipRepo, worldOwnerService,
  // dataSource, realWorldRuntimeProfile, blueprintService)
  const svc = new CharactersService(
    repo as never,
    friendshipRepo as never,
    worldOwnerService as never,
    dataSource as never,
    realWorldRuntimeProfile as never,
    blueprintService as never,
  );
  return { svc, repo, buildProfileSpy };
}

describe('CharactersService.importPersonalCharacter', () => {
  it('rejects when existing same-name character is not private_import', async () => {
    const { svc } = makeService({
      existing: {
        id: 'preset-celeb-001',
        name: '苏然',
        sourceType: 'preset_catalog',
        deletionPolicy: 'archive_allowed',
      } as Char,
    });
    await expect(
      svc.importPersonalCharacter({ name: '苏然' }),
    ).rejects.toThrow(/已存在同名角色/);
  });

  it('rejects when existing is protected', async () => {
    const { svc } = makeService({
      existing: {
        id: 'self-id',
        name: '我自己',
        sourceType: 'default_seed',
        deletionPolicy: 'protected',
      } as Char,
    });
    await expect(
      svc.importPersonalCharacter({ name: '我自己' }),
    ).rejects.toThrow(/受保护/);
  });

  it('rejects names containing control characters (\\n, \\t, \\r)', async () => {
    // 走查 R1：原来 name 没卡控制字符，"line1\nline2" 被允许写入，落库后
    // 通讯录单行 title 渲染会撑高列表项，AI prompt 也会被多行指令注入。
    const { svc } = makeService({ existing: null });
    for (const bad of ['line1\nline2', 'tab\there', 'cr\rdone', '\x01start']) {
      await expect(svc.importPersonalCharacter({ name: bad })).rejects.toThrow(
        /换行符或控制字符/,
      );
    }
  });

  it('overwrites when existing is private_import', async () => {
    const { svc, repo } = makeService({
      existing: {
        id: 'private-old',
        name: '苏然',
        sourceType: 'private_import',
        deletionPolicy: 'archive_allowed',
        bio: 'old bio',
      } as Char,
    });
    const out = await svc.importPersonalCharacter({
      name: '苏然',
      bio: 'new bio',
    });
    expect(out.overwrote).toBe(true);
    expect(out.character.bio).toBe('new bio');
    expect(repo.save).toHaveBeenCalled();
  });

  it('derives profile from recipe when profile is missing', async () => {
    const buildProfileSpy = jest.fn(() => ({ derived: true } as never));
    const { svc, buildProfileSpy: spy } = makeService({
      existing: null,
      buildProfileSpy,
    });
    const recipe = {
      identity: {
        name: '新角色',
        relationship: '朋友',
        relationshipType: 'friend',
      },
      // 真 recipe 还有更多字段，但这里只为验证 buildProfileFromRecipe 被调用
    } as never;
    const out = await svc.importPersonalCharacter({
      name: '新角色',
      recipe,
    });
    expect(spy).toHaveBeenCalledWith(recipe, '新角色');
    // saved character 的 profile 应来自派生（characterId 由 import 在 save
    // 之后回填，2026-05-16 修复，对应 saved.id）
    const savedProfile = (out.character as Char).profile as Record<string, unknown>;
    expect(savedProfile).toMatchObject({ derived: true });
    expect(savedProfile.characterId).toBe(out.character.id);
  });

  it('prefers explicit profile over recipe (does not derive)', async () => {
    const buildProfileSpy = jest.fn(() => ({ derived: true } as never));
    const { svc } = makeService({ existing: null, buildProfileSpy });
    const out = await svc.importPersonalCharacter({
      name: '新角色',
      recipe: { foo: 'bar' } as never,
      profile: { explicit: true } as never,
    });
    expect(buildProfileSpy).not.toHaveBeenCalled();
    const savedProfile = (out.character as Char).profile as Record<string, unknown>;
    expect(savedProfile).toMatchObject({ explicit: true });
    // characterId 也会被 import 路径补成 entity.id（非 undefined）
    expect(savedProfile.characterId).toBe(out.character.id);
  });

  it('rejects oversized bio at the validation gate', async () => {
    const { svc } = makeService({ existing: null });
    await expect(
      svc.importPersonalCharacter({
        name: '苏然',
        bio: 'x'.repeat(3000),
      }),
    ).rejects.toThrow(/超长/);
  });

  // 2026-05-16 修复：wiki 早期版本写入路径只填 name/bio，recipe/profile 都是
  // 空；之前导入这种 bundle 时新角色落库 profile={}，chat 路径 system_prompt
  // 渲染出 "你是 undefined" 直接黑掉。现在 import 路径要兜底合成最小可用 profile。
  it('synthesizes baseline profile when bundle has neither profile nor recipe', async () => {
    const buildProfileSpy = jest.fn(() => ({ shouldNotBeCalled: true } as never));
    const { svc, buildProfileSpy: spy } = makeService({
      existing: null,
      buildProfileSpy,
    });
    const out = await svc.importPersonalCharacter({
      name: '小白',
      relationship: '同事',
      bio: '北京的产品经理',
      personality: '理性',
      expertDomains: ['产品', '心理学'],
    });
    expect(spy).not.toHaveBeenCalled();
    const profile = (out.character as Char).profile as Record<string, unknown>;
    expect(profile).toBeTruthy();
    expect(profile.name).toBe('小白');
    expect(profile.relationship).toBe('同事');
    expect(profile.expertDomains).toEqual(['产品', '心理学']);
    expect(profile.basePrompt).toContain('小白');
    expect(profile.basePrompt).toContain('同事');
    expect(profile.basePrompt).toContain('理性');
    expect(profile.basePrompt).toContain('北京的产品经理');
    expect((profile.traits as Record<string, unknown>).emotionalTone).toBe('自然真实');
  });

  // 2026-05-16 修复：tryDeriveProfileFromRecipe 抛出（典型场景：wiki strip 过
  // recipe.tone）时不应让 import 整体 500，而是回落到合成 baseline。
  it('falls back to baseline when recipe derivation throws', async () => {
    const buildProfileSpy = jest.fn(() => {
      throw new Error('Cannot read properties of undefined (reading "coreDirective")');
    });
    const { svc } = makeService({ existing: null, buildProfileSpy });
    const out = await svc.importPersonalCharacter({
      name: '小蓝',
      relationship: '邻居',
      recipe: { identity: { name: '小蓝' } } as never,
    });
    const profile = (out.character as Char).profile as Record<string, unknown>;
    // 合成 baseline 至少要补 name/relationship/traits 三件套，下游 prompt-builder
    // 拿到不会再渲染 "你是 undefined"。
    expect(profile.name).toBe('小蓝');
    expect(profile.relationship).toBe('邻居');
    expect(profile.traits).toBeTruthy();
  });

  // 2026-05-16 修复：同名 re-import 时，bundle 没带 profile/recipe 不能用
  // baseline 把现存 profile 整盘覆盖（会丢 chat memory compression 累积的
  // memory.recentSummary + 用户填的 coreLogic）。
  it('preserves existing meaningful profile on bare re-import', async () => {
    const existingProfile = {
      characterId: 'private-old',
      name: '苏然',
      relationship: '朋友',
      coreLogic: '用户填的 coreLogic',
      memory: { coreMemory: '记得用户喜欢冷笑话', recentSummary: '昨天聊了天气', forgettingCurve: 70 },
      traits: { speechPatterns: [], catchphrases: [], topicsOfInterest: [], emotionalTone: '冷静', responseLength: 'medium', emojiUsage: 'occasional' },
    };
    const { svc, repo } = makeService({
      existing: {
        id: 'private-old',
        name: '苏然',
        sourceType: 'private_import',
        deletionPolicy: 'archive_allowed',
        profile: existingProfile,
      } as Char,
    });
    const out = await svc.importPersonalCharacter({
      name: '苏然',
      bio: '更新一下 bio',
    });
    expect(out.overwrote).toBe(true);
    const profile = (out.character as Char).profile as Record<string, unknown>;
    // memory 和 coreLogic 保留
    expect(profile.coreLogic).toBe('用户填的 coreLogic');
    expect((profile.memory as Record<string, unknown>).coreMemory).toBe('记得用户喜欢冷笑话');
    expect((profile.memory as Record<string, unknown>).recentSummary).toBe('昨天聊了天气');
    // bio 字段已经更新
    expect((out.character as Char).bio).toBe('更新一下 bio');
    expect(repo.save).toHaveBeenCalled();
  });

  // 2026-05-16 修复：re-import 带新 profile 时，旧 memory 子树应 merge 回新 profile，
  // 不能因为用户改了 personality 就把 AI 记忆全冲掉。
  it('merges existing memory into newly imported profile', async () => {
    const existingProfile = {
      characterId: 'private-old',
      name: '苏然',
      memory: { coreMemory: '老的核心记忆', recentSummary: '老的近期记忆', forgettingCurve: 70 },
      traits: { speechPatterns: [], catchphrases: [], topicsOfInterest: [], emotionalTone: '', responseLength: 'medium', emojiUsage: 'occasional' },
    };
    const { svc } = makeService({
      existing: {
        id: 'private-old',
        name: '苏然',
        sourceType: 'private_import',
        deletionPolicy: 'archive_allowed',
        profile: existingProfile,
      } as Char,
    });
    const out = await svc.importPersonalCharacter({
      name: '苏然',
      profile: {
        characterId: 'private-old',
        name: '苏然',
        coreLogic: '新的 coreLogic',
        traits: { speechPatterns: [], catchphrases: [], topicsOfInterest: [], emotionalTone: '活泼', responseLength: 'medium', emojiUsage: 'occasional' },
      } as never,
    });
    const profile = (out.character as Char).profile as Record<string, unknown>;
    expect(profile.coreLogic).toBe('新的 coreLogic');
    expect((profile.memory as Record<string, unknown>)?.coreMemory).toBe('老的核心记忆');
    expect((profile.memory as Record<string, unknown>)?.recentSummary).toBe('老的近期记忆');
  });
});
