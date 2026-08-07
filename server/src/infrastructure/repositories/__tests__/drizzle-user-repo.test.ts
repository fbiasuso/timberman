import { describe, it, expect, vi } from 'vitest';
import { DrizzleUserRepo } from '../drizzle-user-repo.js';
import { User } from '../../../domain/entities/user.js';

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

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    role: 'user',
    balance: 5000,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleUserRepo', () => {
  it('round-trips a user (save → load)', async () => {
    const { db, mocks } = createMockDb();
    const row = makeRow();
    mocks.insertReturning.mockResolvedValue([row]);
    mocks.selectWhere.mockResolvedValue([row]);

    const repo = new DrizzleUserRepo(db as any);
    const saved = await repo.save(
      User.create({ ...row, balance: row.balance } as any),
    );
    const loaded = await repo.findById('user-1');

    expect(saved.balance.cents).toBe(5000);
    expect(loaded?.balance.cents).toBe(5000);
  });

  it('returns null when findById finds no row', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([]);

    const repo = new DrizzleUserRepo(db as any);
    const loaded = await repo.findById('ghost');

    expect(loaded).toBeNull();
  });

  it('locks the user row with FOR UPDATE on findByIdForUpdate', async () => {
    const row = makeRow();
    // Chain shape: select().from().where(...).for('update')
    const forSpy = vi.fn().mockResolvedValue([row]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ for: forSpy }),
        }),
      }),
    };

    const repo = new DrizzleUserRepo(db as any);
    const user = await repo.findByIdForUpdate('user-1');

    expect(forSpy).toHaveBeenCalledWith('update');
    expect(user?.balance.cents).toBe(5000);
    expect(user?.id).toBe('user-1');
  });

  it('returns null when findByIdForUpdate finds no row', async () => {
    const forSpy = vi.fn().mockResolvedValue([]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ for: forSpy }),
        }),
      }),
    };

    const repo = new DrizzleUserRepo(db as any);
    const user = await repo.findByIdForUpdate('ghost');

    expect(forSpy).toHaveBeenCalledWith('update');
    expect(user).toBeNull();
  });

  it('matches usernames case-insensitively via the normalized key', async () => {
    const { db, mocks } = createMockDb();
    const row = makeRow({ username: 'testuser' });
    mocks.selectWhere.mockResolvedValue([row]);

    const repo = new DrizzleUserRepo(db as any);
    const user = await repo.findByUsername('TestUser');

    expect(user?.id).toBe('user-1');
    expect(user?.username).toBe('testuser');
    // The lookup goes through a SQL fragment (lower(...)) rather than a plain
    // column equality, so it can use idx_users_username_normalized_unique.
    const whereArg = mocks.selectWhere.mock.calls[0][0] as any;
    expect(whereArg).toHaveProperty('queryChunks');
    expect(whereArg).not.toBe('TestUser');
  });

  it('returns null when findByUsername finds no row', async () => {
    const { db, mocks } = createMockDb();
    mocks.selectWhere.mockResolvedValue([]);

    const repo = new DrizzleUserRepo(db as any);
    const user = await repo.findByUsername('nobody');

    expect(user).toBeNull();
  });
});
