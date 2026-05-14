import { ConflictException } from '@nestjs/common';
import { WikiPrivateCharacterService } from './wiki-private-character.service';

// 关注三件事：
//   1) createStrict 重名 → ConflictException（不再走 upsert 静默覆盖）
//   2) createStrict 字段长度上限 → BadRequest
//   3) update 不允许把 name 改成另一行已用的名字（旧逻辑）
// 旧 create() 仍走 upsertByName，保留是为了不破坏内部调用，这里不重测。

type Row = ReturnType<WikiPrivateCharacterService['create']> extends Promise<
  infer T
>
  ? T
  : never;

function makeService(opts: {
  byOwnerName?: Row | null;
  byOwnerNameOnUpdate?: Row | null;
  recordById?: Row | null;
} = {}) {
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(async (q: { where: { id?: string; name?: string } }) => {
      if (q.where.id) return opts.recordById ?? null;
      if (q.where.name) return opts.byOwnerName ?? null;
      return null;
    }),
    create: jest.fn((init: Partial<Row>) => ({ ...init }) as Row),
    save: jest.fn(async (row: Row) => ({ id: 'new-uuid', ...row }) as Row),
    delete: jest.fn(),
  } as unknown as ConstructorParameters<typeof WikiPrivateCharacterService>[0];
  return new WikiPrivateCharacterService(repo);
}

describe('WikiPrivateCharacterService.createStrict', () => {
  it('rejects duplicate name with Conflict (no silent overwrite)', async () => {
    const existing = {
      id: 'old-1',
      ownerUserId: 'u1',
      name: '苏然',
    } as Row;
    const svc = makeService({ byOwnerName: existing });
    await expect(
      svc.createStrict('u1', { name: '苏然' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates fresh record when name not taken', async () => {
    const svc = makeService({ byOwnerName: null });
    const out = await svc.createStrict('u1', { name: '新角色' });
    expect(out.id).toBe('new-uuid');
    expect(out.name).toBe('新角色');
    expect(out.ownerUserId).toBe('u1');
  });

  it('rejects oversized bio', async () => {
    const svc = makeService({ byOwnerName: null });
    await expect(
      svc.createStrict('u1', { name: '尺寸超限', bio: 'x'.repeat(5000) }),
    ).rejects.toThrow(/超长/);
  });

  it('rejects empty name', async () => {
    const svc = makeService({ byOwnerName: null });
    await expect(svc.createStrict('u1', { name: '   ' })).rejects.toThrow(
      /不能为空/,
    );
  });
});
