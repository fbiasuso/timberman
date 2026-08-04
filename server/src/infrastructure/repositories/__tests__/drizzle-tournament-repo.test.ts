import { describe, it, expect, vi } from 'vitest';
import { SQL } from 'drizzle-orm';
import { DrizzleTournamentRepo } from '../drizzle-tournament-repo.js';
import { Tournament } from '../../../domain/entities/tournament.js';
import { MatchDate } from '../../../domain/entities/match-date.js';
import {
  TournamentNotFoundError,
  MatchDateNotFoundError,
} from '../../../domain/errors/index.js';

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
      status: 'active',
      finishedAt: null,
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

  it('strips the id: 0 sentinel from save() so the serial PK assigns it', async () => {
    const { db, mocks } = createMockDb();
    mocks.insertReturning.mockResolvedValue([
      {
        id: 1,
        name: 'Torneo',
        commission: '15.00',
        status: 'active',
        finishedAt: null,
        carryover: 0,
        createdAt: new Date(),
      },
    ]);

    const repo = new DrizzleTournamentRepo(db as any);
    const saved = await repo.save(Tournament.new({ id: 0, name: 'Torneo' }));

    // The snapshot's hardcoded id must never reach the SQL — inserting an
    // explicit 0 into the serial PK would collide on the second tournament.
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: expect.anything() }),
    );
    expect(saved.id).toBe(1);
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
      status: 'active',
      finishedAt: null,
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

  it('findActive() filters on status = active and maps the row to an active Tournament', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([
      {
        id: 1,
        name: 'Torneo',
        commission: '15.00',
        status: 'active',
        finishedAt: null,
        carryover: 0,
        createdAt: new Date(),
      },
    ]);

    const repo = new DrizzleTournamentRepo(db as any);
    const tournament = await repo.findActive();

    // The condition is built with eq(tournaments.status, 'active')
    const signature = sqlSignature(mocks.selectWhere.mock.calls[0][0]);
    expect(signature).toContain('col:status');
    expect(signature).toContain('val:active');
    expect(tournament?.status).toBe('active');
    expect(tournament?.finishedAt).toBeNull();
  });

  it('findOpenMatchDates() filters on status = open only when no tournament is given', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([]);

    const repo = new DrizzleTournamentRepo(db as any);
    await repo.findOpenMatchDates();

    const signature = sqlSignature(mocks.selectWhere.mock.calls[0][0]);
    expect(signature).toContain('col:status');
    expect(signature).toContain('val:open');
    expect(signature).not.toContain('col:tournament_id');
  });

  it('findOpenMatchDates(tournamentId) also filters on tournament_id', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([]);

    const repo = new DrizzleTournamentRepo(db as any);
    await repo.findOpenMatchDates(7);

    // and(eq(status, 'open'), eq(tournamentId, 7)) — both conditions in the SQL
    const signature = sqlSignature(mocks.selectWhere.mock.calls[0][0]);
    expect(signature).toContain('col:status');
    expect(signature).toContain('val:open');
    expect(signature).toContain('col:tournament_id');
    expect(signature).toContain('val:7');
  });

  it('update() maps status and finishedAt into the SET clause', async () => {
    const { db, mocks } = createMockDb();
    const finishedAt = new Date('2025-06-01');
    mocks.updateReturning.mockResolvedValue([
      {
        id: 1,
        name: 'Torneo',
        commission: '15.00',
        status: 'archived',
        finishedAt,
        carryover: 0,
        createdAt: new Date(),
      },
    ]);

    const repo = new DrizzleTournamentRepo(db as any);
    const tournament = await repo.update(
      Tournament.create({
        id: 1,
        name: 'Torneo',
        commission: 15,
        status: 'archived',
        finishedAt,
        carryover: 0,
        createdAt: new Date(),
      }),
    );

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'archived', finishedAt }),
    );
    expect(tournament.status).toBe('archived');
    expect(tournament.finishedAt).toBe(finishedAt);
  });

  it('findById() maps status and finishedAt from the row to the entity', async () => {
    const { db, mocks } = createMockDb();
    const finishedAt = new Date('2025-06-01');
    mocks.selectWhere.mockResolvedValue([
      {
        id: 1,
        name: 'Torneo',
        commission: '15.00',
        status: 'archived',
        finishedAt,
        carryover: 0,
        createdAt: new Date(),
      },
    ]);

    const repo = new DrizzleTournamentRepo(db as any);
    const tournament = await repo.findById(1);

    expect(tournament?.status).toBe('archived');
    expect(tournament?.finishedAt).toBe(finishedAt);
  });

  it('findAll() maps status and finishedAt from rows to entities', async () => {
    const finishedAt = new Date('2025-06-01');
    const row = {
      id: 1,
      name: 'Torneo',
      commission: '15.00',
      status: 'finished',
      finishedAt,
      carryover: 0,
      createdAt: new Date(),
    };
    // findAll uses select().from(...) with no where clause
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([row]),
      }),
    };

    const repo = new DrizzleTournamentRepo(db as any);
    const tournaments = await repo.findAll();

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].status).toBe('finished');
    expect(tournaments[0].finishedAt).toBe(finishedAt);
  });
});
