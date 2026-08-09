import { describe, it, expect, vi } from 'vitest';
import { SQL } from 'drizzle-orm';
import { DrizzleLeagueRepo } from '../drizzle-league-repo.js';
import { DrizzleTeamRepo } from '../drizzle-team-repo.js';
import { League } from '../../../domain/entities/league.js';
import { Team } from '../../../domain/entities/team.js';
import {
  LeagueNotFoundError,
  LeagueNameAlreadyExistsError,
  TeamNotFoundError,
  TeamNameAlreadyExistsError,
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

/**
 * Build a fake PostgresJsDatabase covering the query chains the league and
 * team repos use. Terminal links return real promises (bare `await` on a
 * link) while also exposing the chained tails (`.where(...).orderBy(...)`,
 * `.values(...).returning()`), so both `await q.where(...)` and
 * `q.where(...).orderBy(...)` work without SQL execution.
 */
function createMockDb() {
  const mocks = {
    selectWhere: vi.fn(),       // select().from().where(...)
    selectOrderBy: vi.fn(),     // select().from().orderBy(...)
    selectJoinOrderBy: vi.fn(), // ...innerJoin().where(...).orderBy(...)
    insertReturning: vi.fn(),   // insert().values(...).returning()
    updateReturning: vi.fn(),   // update().set(...).where(...).returning()
    deleteReturning: vi.fn(),   // delete().where(...).returning()
  };

  // Bare `select().from()` (memberships read in findAll) is awaited directly:
  // the from-builder is a promise that the test resolves via resolveBare.
  let resolveBare: (v: unknown) => void = () => {};
  const bare = new Promise((res) => { resolveBare = res; });
  const joinWhere: any = Object.assign(Promise.resolve([]), {
    orderBy: mocks.selectJoinOrderBy,
  });
  const fromBuilder: any = Object.assign(bare, {
    where: mocks.selectWhere,
    orderBy: mocks.selectOrderBy,
    innerJoin: vi.fn(() => ({ where: vi.fn(() => joinWhere) })),
  });

  const valuesBuilder: any = vi.fn();
  valuesBuilder.returning = mocks.insertReturning;

  const setBuilder: any = vi.fn();
  setBuilder.where = vi.fn(() => ({ returning: mocks.updateReturning }));

  const deleteWhere: any = vi.fn();
  deleteWhere.returning = mocks.deleteReturning;

  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => fromBuilder) })),
    insert: vi.fn(() => ({ values: vi.fn(() => valuesBuilder) })),
    update: vi.fn(() => ({ set: vi.fn(() => setBuilder) })),
    delete: vi.fn(() => ({ where: vi.fn(() => deleteWhere) })),
  };
  return { db, mocks, resolveBare };
}

/**
 * Fake db whose `transaction` runs the callback against a tx client and
 * returns the callback's value — matching drizzle's postgres-js behavior.
 * The tx covers the chains the team repo uses inside save/update.
 */
function createMockDbWithTransaction() {
  const mocks = {
    txInsertValues: vi.fn(),    // tx.insert().values(...) — bare insert (memberships)
    txInsertReturning: vi.fn(), // tx.insert().values(...).returning()
    txUpdateReturning: vi.fn(), // tx.update().set(...).where(...).returning()
    txDeleteWhere: vi.fn(),     // tx.delete().where(...) — bare await
  };

  // values() must return a thenable that also exposes .returning().
  const txValuesBuilder: any = Object.assign(Promise.resolve(undefined), {
    returning: mocks.txInsertReturning,
  });
  mocks.txInsertValues.mockReturnValue(txValuesBuilder);

  const txSetBuilder: any = vi.fn();
  txSetBuilder.where = vi.fn(() => ({ returning: mocks.txUpdateReturning }));

  const tx = {
    insert: vi.fn(() => ({ values: mocks.txInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => txSetBuilder) })),
    delete: vi.fn(() => ({ where: mocks.txDeleteWhere })),
  };
  const db = {
    transaction: vi.fn(async (fn: (t: any) => Promise<unknown>) => fn(tx)),
  };
  return { db, mocks };
}

const leagueRow = {
  id: 1,
  name: 'Primera División',
  country: 'Argentina',
  format: 'liga' as const,
  createdAt: new Date(),
};

const teamRow = {
  id: 7,
  name: 'River Plate',
  aliases: ['El Millonario'],
  logo: null,
  createdAt: new Date(),
};

// ── DrizzleLeagueRepo ──────────────────────────────────────────────

describe('DrizzleLeagueRepo', () => {
  it('maps a normalized-name 23505 on save to LeagueNameAlreadyExistsError', async () => {
    const { db, mocks } = createMockDb();
    mocks.insertReturning.mockRejectedValue({
      code: '23505',
      constraint: 'idx_leagues_name_normalized_unique',
    });

    const repo = new DrizzleLeagueRepo(db as any);
    await expect(repo.save(
      League.new({ id: 0, name: 'Primera División', country: 'Argentina', format: 'liga' }),
    )).rejects.toBeInstanceOf(LeagueNameAlreadyExistsError);
  });

  it('omits the id: 0 sentinel on save so the serial PK assigns it', async () => {
    const { db, mocks } = createMockDb();
    mocks.insertReturning.mockResolvedValue([leagueRow]);

    const repo = new DrizzleLeagueRepo(db as any);
    await repo.save(League.new({ id: 0, name: 'Primera', country: 'AR', format: 'copa' }));

    const insertValues = db.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertValues).not.toHaveProperty('id');
    expect(insertValues.name).toBe('Primera');
  });

  it('findAll orders leagues by name', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectOrderBy.mockResolvedValue([leagueRow]);

    const repo = new DrizzleLeagueRepo(db as any);
    const leagues = await repo.findAll();

    expect(leagues).toHaveLength(1);
    const orderBy = db.select.mock.results[0].value.from.mock.results[0].value.orderBy;
    expect(orderBy.mock.calls[0][0].name).toBe('name');
  });

  it('findByName compares both sides through the normalized key', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([leagueRow]);

    const repo = new DrizzleLeagueRepo(db as any);
    const found = await repo.findByName('primera division');

    const where = db.select.mock.results[0].value.from.mock.results[0].value.where;
    expect(found?.id).toBe(1);
    expect(sqlSignature(where.mock.calls[0][0])).toContain('regexp_replace');
  });

  it('countTeams returns the membership count for the league', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([{ count: 3 }]);

    const repo = new DrizzleLeagueRepo(db as any);
    await expect(repo.countTeams(5)).resolves.toBe(3);
  });

  it('delete throws LeagueNotFoundError when no row is affected', async () => {
    const { db, mocks } = createMockDb();
    mocks.deleteReturning.mockResolvedValue([]);

    const repo = new DrizzleLeagueRepo(db as any);
    await expect(repo.delete(99)).rejects.toBeInstanceOf(LeagueNotFoundError);
  });

  it('update maps a rename collision to LeagueNameAlreadyExistsError', async () => {
    const { db, mocks } = createMockDb();
    mocks.updateReturning.mockRejectedValue({
      code: '23505',
      constraint: 'idx_leagues_name_normalized_unique',
    });

    const repo = new DrizzleLeagueRepo(db as any);
    await expect(repo.update(
      League.create({ ...leagueRow, name: 'copa argentina' }),
    )).rejects.toBeInstanceOf(LeagueNameAlreadyExistsError);
  });
});

// ── DrizzleTeamRepo ────────────────────────────────────────────────

describe('DrizzleTeamRepo', () => {
  it('maps a global normalized-name 23505 on save to TeamNameAlreadyExistsError', async () => {
    const { db, mocks } = createMockDbWithTransaction();
    mocks.txInsertReturning.mockRejectedValue({
      code: '23505',
      constraint: 'idx_teams_name_normalized_unique',
    });

    const repo = new DrizzleTeamRepo(db as any);
    await expect(repo.save(
      Team.new({ id: 0, name: 'River Plate', leagueIds: [1] }),
    )).rejects.toBeInstanceOf(TeamNameAlreadyExistsError);
  });

  it('save inserts the team and its memberships in one transaction', async () => {
    const { db, mocks } = createMockDbWithTransaction();
    mocks.txInsertReturning.mockResolvedValue([teamRow]);

    const repo = new DrizzleTeamRepo(db as any);
    const saved = await repo.save(
      Team.new({ id: 0, name: 'River Plate', aliases: ['El Millonario'], leagueIds: [2, 1] }),
    );

    expect(saved.id).toBe(7);
    expect(saved.leagueIds).toEqual([1, 2]); // sorted
    // Memberships inserted in the SAME transaction: one values() per table.
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.txInsertValues).toHaveBeenCalledTimes(2);
  });

  it('update replaces the membership set in one transaction', async () => {
    const { db, mocks } = createMockDbWithTransaction();
    mocks.txUpdateReturning.mockResolvedValue([teamRow]);

    const repo = new DrizzleTeamRepo(db as any);
    const updated = await repo.update(
      Team.create({ ...teamRow, leagueIds: [3] }),
    );

    expect(updated.id).toBe(7);
    expect(mocks.txDeleteWhere).toHaveBeenCalledTimes(1); // old memberships wiped
    expect(mocks.txInsertValues).toHaveBeenCalledTimes(1); // new set written
    expect(updated.leagueIds).toEqual([3]);
  });

  it('update throws TeamNotFoundError when the team is missing', async () => {
    const { db, mocks } = createMockDbWithTransaction();
    mocks.txUpdateReturning.mockResolvedValue([]);

    const repo = new DrizzleTeamRepo(db as any);
    await expect(repo.update(
      Team.create({ ...teamRow, leagueIds: [1] }),
    )).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('findByLeagueId joins the junction filtered by the league, ordered by name', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectJoinOrderBy.mockResolvedValue([{ team: teamRow }]);

    const repo = new DrizzleTeamRepo(db as any);
    const teams = await repo.findByLeagueId(3);

    expect(teams).toHaveLength(1);
    expect(teams[0].leagueIds).toEqual([3]);
    const join = db.select.mock.results[0].value.from.mock.results[0].value.innerJoin;
    expect(join).toHaveBeenCalledTimes(1);
  });

  it('findAll groups memberships in memory', async () => {
    const { db, mocks, resolveBare } = createMockDb();
    mocks.selectOrderBy.mockResolvedValue([teamRow]);
    // The bare select().from() membership read resolves via the from-promise.
    resolveBare([
      { teamId: 7, leagueId: 2 },
      { teamId: 7, leagueId: 1 },
    ]);

    const repo = new DrizzleTeamRepo(db as any);
    const teams = await repo.findAll();

    expect(teams).toHaveLength(1);
    expect(teams[0].leagueIds).toEqual([1, 2]);
  });

  it('delete throws TeamNotFoundError when no row is affected', async () => {
    const { db, mocks } = createMockDb();
    mocks.deleteReturning.mockResolvedValue([]);

    const repo = new DrizzleTeamRepo(db as any);
    await expect(repo.delete(99)).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it('countMatchesReferencing ORs local and visitor team id filters', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([{ count: 1 }]);

    const repo = new DrizzleTeamRepo(db as any);
    await expect(repo.countMatchesReferencing(7)).resolves.toBe(1);

    const where = db.select.mock.results[0].value.from.mock.results[0].value.where;
    const sig = sqlSignature(where.mock.calls[0][0]);
    expect(sig).toContain('col:local_team_id');
    expect(sig).toContain('col:visitor_team_id');
  });
});
