import { describe, it, expect, vi } from 'vitest';
import { SQL } from 'drizzle-orm';
import { DrizzleTournamentPointsRepo } from '../drizzle-tournament-points-repo.js';
import type { TournamentPoint } from '../../../domain/ports/tournament-points-repo.js';

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Render a drizzle SQL condition to a readable signature: column names and
 * literal values it references. Used to assert the repo builds the where
 * clause with the right filters without executing SQL.
 */
function sqlSignature(cond: unknown): string {
  if (typeof cond === 'string') return cond;
  if (cond instanceof SQL) {
    return cond.queryChunks.map((chunk) => sqlSignature(chunk)).join('');
  }
  if (cond && typeof cond === 'object' && 'name' in cond) {
    return `col:${(cond as { name: string }).name}`;
  }
  if (cond && typeof cond === 'object' && 'value' in cond) {
    return `val:${(cond as { value: unknown }).value}`;
  }
  return String(cond);
}

/**
 * Build a fake PostgresJsDatabase with the query-chain shape the repo uses.
 * The insert chain is `insert().values(...).onConflictDoNothing()`; the
 * select chain is `select().from().where(...)`.
 */
function createMockDb() {
  const mocks = {
    selectWhere: vi.fn(),
    insertValues: vi.fn(),
    onConflictDoNothing: vi.fn(),
  };
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: mocks.selectWhere }),
    }),
    insert: vi.fn().mockReturnValue({
      values: mocks.insertValues.mockReturnValue({
        onConflictDoNothing: mocks.onConflictDoNothing,
      }),
    }),
  };
  return { db, mocks };
}

function makePointRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    userId: 'u1',
    tournamentId: 1,
    matchDateId: 1,
    points: 3,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeWinnerRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    tournamentId: 1,
    userId: 'u1',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleTournamentPointsRepo.savePoints()', () => {
  it('maps TournamentPoint rows to insert values and resolves via ON CONFLICT DO NOTHING', async () => {
    const { db, mocks } = createMockDb();
    mocks.onConflictDoNothing.mockResolvedValue(undefined);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    const rows: TournamentPoint[] = [
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 3 },
      { userId: 'u2', tournamentId: 1, matchDateId: 1, points: 0 },
    ];
    await repo.savePoints(rows);

    // Every row is mapped to the columns the table expects
    expect(mocks.insertValues).toHaveBeenCalledWith([
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 3 },
      { userId: 'u2', tournamentId: 1, matchDateId: 1, points: 0 },
    ]);
    // Idempotency: the insert must use ON CONFLICT DO NOTHING so re-runs skip
    expect(mocks.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('skips the insert entirely when the rows array is empty', async () => {
    const { db, mocks } = createMockDb();

    const repo = new DrizzleTournamentPointsRepo(db as any);
    await repo.savePoints([]);

    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});

describe('DrizzleTournamentPointsRepo.findByTournamentId()', () => {
  it('maps rows back to TournamentPoint[]', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([
      makePointRow({ id: 1, userId: 'u1', points: 3 }),
      makePointRow({ id: 2, userId: 'u2', matchDateId: 2, points: 0 }),
    ]);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    const points = await repo.findByTournamentId(1);

    expect(points).toEqual([
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 3 },
      { userId: 'u2', tournamentId: 1, matchDateId: 2, points: 0 },
    ]);
  });

  it('filters by tournamentId via the where clause', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([makePointRow()]);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    await repo.findByTournamentId(7);

    // The condition is built with eq(tournamentPoints.tournamentId, 7)
    expect(mocks.selectWhere).toHaveBeenCalledTimes(1);
    const signature = sqlSignature(mocks.selectWhere.mock.calls[0][0]);
    expect(signature).toContain('col:tournament_id');
    expect(signature).toContain('val:7');
  });
});

describe('DrizzleTournamentPointsRepo.findByUserAndTournament()', () => {
  it('filters by BOTH userId and tournamentId', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([
      makePointRow({ id: 1, userId: 'u1', tournamentId: 1, points: 5 }),
    ]);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    const points = await repo.findByUserAndTournament('u1', 1);

    // and(eq(userId), eq(tournamentId)) — both columns appear in the SQL
    const signature = sqlSignature(mocks.selectWhere.mock.calls[0][0]);
    expect(signature).toContain('col:user_id');
    expect(signature).toContain('col:tournament_id');
    expect(signature).toContain('val:u1');
    expect(signature).toContain('val:1');
    expect(points).toEqual([
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 5 },
    ]);
  });

  it('returns an empty array when no rows match', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([]);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    const points = await repo.findByUserAndTournament('ghost', 1);

    expect(points).toEqual([]);
  });
});

describe('DrizzleTournamentPointsRepo.saveWinners()', () => {
  it('inserts one winner row per user id and resolves via ON CONFLICT DO NOTHING', async () => {
    const { db, mocks } = createMockDb();
    mocks.onConflictDoNothing.mockResolvedValue(undefined);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    await repo.saveWinners(1, ['u1', 'u2']);

    expect(mocks.insertValues).toHaveBeenCalledWith([
      { tournamentId: 1, userId: 'u1' },
      { tournamentId: 1, userId: 'u2' },
    ]);
    expect(mocks.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('skips the insert entirely when the winner list is empty', async () => {
    const { db } = createMockDb();

    const repo = new DrizzleTournamentPointsRepo(db as any);
    await repo.saveWinners(1, []);

    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('DrizzleTournamentPointsRepo.findWinnersByTournamentId()', () => {
  it('maps rows back to { userId }[]', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([
      makeWinnerRow({ id: 1, userId: 'u1' }),
      makeWinnerRow({ id: 2, userId: 'u2' }),
    ]);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    const winners = await repo.findWinnersByTournamentId(1);

    expect(winners).toEqual([{ userId: 'u1' }, { userId: 'u2' }]);
  });

  it('filters by tournamentId via the where clause', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([makeWinnerRow()]);

    const repo = new DrizzleTournamentPointsRepo(db as any);
    await repo.findWinnersByTournamentId(3);

    expect(mocks.selectWhere).toHaveBeenCalledTimes(1);
    const signature = sqlSignature(mocks.selectWhere.mock.calls[0][0]);
    expect(signature).toContain('col:tournament_id');
    expect(signature).toContain('val:3');
  });
});
