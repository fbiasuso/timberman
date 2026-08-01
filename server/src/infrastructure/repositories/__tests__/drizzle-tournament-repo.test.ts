import { describe, it, expect, vi } from 'vitest';
import { DrizzleTournamentRepo } from '../drizzle-tournament-repo.js';
import { Tournament } from '../../../domain/entities/tournament.js';
import { MatchDate } from '../../../domain/entities/match-date.js';
import {
  TournamentNotFoundError,
  MatchDateNotFoundError,
} from '../../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Build a fake PostgresJsDatabase with the query-chain shape the repo uses. */
function createMockDb() {
  const mocks = {
    selectWhere: vi.fn(),
    insertValues: vi.fn(),
    insertReturning: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn(),
    updateReturning: vi.fn(),
  };
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: mocks.selectWhere }),
    }),
    insert: vi.fn().mockReturnValue({
      values: mocks.insertValues.mockReturnValue({ returning: mocks.insertReturning }),
    }),
    update: vi.fn().mockReturnValue({
      set: mocks.updateSet.mockReturnValue({
        where: mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning }),
      }),
    }),
  };
  return { db, mocks };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleTournamentRepo', () => {
  it('round-trips carryover on a tournament (save → load)', async () => {
    const { db, mocks } = createMockDb();
    const row = {
      id: 1,
      name: 'Torneo',
      commission: '15.00',
      isActive: true,
      carryover: 2500,
      createdAt: new Date(),
    };
    mocks.insertReturning.mockResolvedValue([row]);
    mocks.selectWhere.mockResolvedValue([row]);

    const repo = new DrizzleTournamentRepo(db as any);
    const saved = await repo.save(
      Tournament.new({ id: 1, name: 'Torneo', commission: 15, carryover: 2500 }),
    );
    const loaded = await repo.findById(1);

    expect(saved.carryover).toBe(2500);
    expect(loaded?.carryover).toBe(2500);
  });

  it('round-trips match date commission (save → load)', async () => {
    const { db, mocks } = createMockDb();
    const row = {
      id: 1,
      tournamentId: 1,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: '12.50',
      createdAt: new Date(),
    };
    mocks.insertReturning.mockResolvedValue([row]);
    mocks.selectWhere.mockResolvedValue([row]);

    const repo = new DrizzleTournamentRepo(db as any);
    const date = MatchDate.new({ id: 1, tournamentId: 1, dateNumber: 1 }).withCommission(12.5);
    const saved = await repo.saveMatchDate(date);
    const loaded = await repo.findMatchDateById(1);

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ commission: '12.5' }),
    );
    expect(saved.commission).toBe(12.5);
    expect(loaded?.commission).toBe(12.5);
  });

  it('throws TournamentNotFoundError when updating a missing tournament', async () => {
    const { db, mocks } = createMockDb();
    mocks.updateReturning.mockResolvedValue([]); // no rows updated

    const repo = new DrizzleTournamentRepo(db as any);
    await expect(
      repo.update(Tournament.new({ id: 999, name: 'Ghost' })),
    ).rejects.toThrow(TournamentNotFoundError);
  });

  it('throws MatchDateNotFoundError when updating a missing match date', async () => {
    const { db, mocks } = createMockDb();
    mocks.updateReturning.mockResolvedValue([]); // no rows updated

    const repo = new DrizzleTournamentRepo(db as any);
    await expect(
      repo.updateMatchDate(MatchDate.new({ id: 999, tournamentId: 1, dateNumber: 1 })),
    ).rejects.toThrow(MatchDateNotFoundError);
  });

  it('locks the tournament row with FOR UPDATE on findByIdForUpdate', async () => {
    const row = {
      id: 1,
      name: 'Torneo',
      commission: '15.00',
      isActive: true,
      carryover: 2500,
      createdAt: new Date(),
    };
    // Chain shape: select().from().where(...).for('update')
    const forSpy = vi.fn().mockResolvedValue([row]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ for: forSpy }),
        }),
      }),
    };

    const repo = new DrizzleTournamentRepo(db as any);
    const tournament = await repo.findByIdForUpdate(1);

    expect(forSpy).toHaveBeenCalledWith('update');
    expect(tournament?.carryover).toBe(2500);
  });

  it('locks the match date row with FOR UPDATE on findMatchDateByIdForUpdate', async () => {
    const row = {
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: '15.00',
      createdAt: new Date(),
    };
    // Chain shape: select().from().where(...).for('update')
    const forSpy = vi.fn().mockResolvedValue([row]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ for: forSpy }),
        }),
      }),
    };

    const repo = new DrizzleTournamentRepo(db as any);
    const date = await repo.findMatchDateByIdForUpdate(10);

    expect(forSpy).toHaveBeenCalledWith('update');
    expect(date?.id).toBe(10);
  });
});
