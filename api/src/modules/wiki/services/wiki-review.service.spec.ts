import { ForbiddenException } from '@nestjs/common';
import { WikiReviewService } from './wiki-review.service';

// Build a service instance with stubbed deps so we can drive private 3RR
// assertion via the public `revert` entry. We stop early once the 3RR
// branch decides — we don't need to fully simulate the rest of the flow.
function makeReviewService(opts: {
  revertCountIn24h?: number;
} = {}) {
  const dataSource = {
    transaction: jest.fn(),
  };
  const revisionRepo = {
    count: jest.fn().mockResolvedValue(opts.revertCountIn24h ?? 0),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
    })),
  };
  const submissionRepo = { findOne: jest.fn() };
  const pageRepo = { findOne: jest.fn() };
  const profileRepo = {};
  const edits = {
    applyApprovedRevision: jest.fn(),
    applySnapshotToCharacter: jest.fn(),
  };
  const roles = { checkPromotion: jest.fn() };
  const protection = { setProtection: jest.fn() };
  const systemUsers = {
    systemActor: () => ({
      id: 'user_wiki_antivandal_bot',
      role: 'admin',
      username: '__system__',
      userType: 'system',
    }),
  };
  const svc = new WikiReviewService(
    dataSource as never,
    revisionRepo as never,
    submissionRepo as never,
    pageRepo as never,
    profileRepo as never,
    edits as never,
    roles as never,
    protection as never,
    systemUsers as never,
  );
  return { svc, revisionRepo, pageRepo, protection };
}

describe('WikiReviewService.revert 3RR detection', () => {
  it('rejects when patroller has already reverted 3 times in 24h', async () => {
    const { svc } = makeReviewService({ revertCountIn24h: 3 });
    await expect(
      svc.revert(
        'char_x',
        { id: 'u_pat', role: 'patroller', username: 'p' } as never,
        { toRevisionId: 'rev_a', reason: 'test' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('admin is exempt from 3RR', async () => {
    const { svc, revisionRepo } = makeReviewService({ revertCountIn24h: 99 });
    revisionRepo.findOne.mockResolvedValue(null); // bail out at next step (404)
    await expect(
      svc.revert(
        'char_x',
        { id: 'u_admin', role: 'admin', username: 'a' } as never,
        { toRevisionId: 'rev_a', reason: 'test' },
      ),
    ).rejects.not.toThrow(ForbiddenException);
  });

  it('counts only revert operations in last 24h', async () => {
    const { svc, revisionRepo } = makeReviewService({ revertCountIn24h: 2 });
    revisionRepo.findOne.mockResolvedValue(null); // proceed past 3RR, bail at target lookup
    await expect(
      svc.revert(
        'char_x',
        { id: 'u_pat', role: 'patroller', username: 'p' } as never,
        { toRevisionId: 'rev_a', reason: 'test' },
      ),
    ).rejects.not.toThrow(ForbiddenException);
    expect(revisionRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          characterId: 'char_x',
          operation: 'revert',
          editorUserId: 'u_pat',
        }),
      }),
    );
  });
});
