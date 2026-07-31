import { describe, it, expect, vi } from 'vitest';
import { DrizzleSystemConfigRepo } from '../drizzle-system-config-repo.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Build a fake PostgresJsDatabase with the query-chain shape the repo uses. */
function createMockDb() {
  const mocks = {
    where: vi.fn(),
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
  };
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: mocks.where }),
    }),
    insert: vi.fn().mockReturnValue({
      values: mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.onConflictDoUpdate }),
    }),
  };
  return { db, mocks };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleSystemConfigRepo', () => {
  it('get() returns null when no row exists', async () => {
    const { db, mocks } = createMockDb();
    mocks.where.mockResolvedValue([]);

    const repo = new DrizzleSystemConfigRepo(db as any);
    await expect(repo.get()).resolves.toBeNull();
  });

  it('get() maps the persisted row to a SystemConfig', async () => {
    const { db, mocks } = createMockDb();
    mocks.where.mockResolvedValue([
      {
        id: 1,
        commission: '15.00',
        allowRegistration: false,
        defaultBetAmount: 1000,
      },
    ]);

    const repo = new DrizzleSystemConfigRepo(db as any);
    await expect(repo.get()).resolves.toEqual({
      commission: 15,
      allowRegistration: false,
      defaultBetAmount: 1000,
    });
  });

  it('upsert() inserts the config with id=1 and onConflictDoUpdate on id', async () => {
    const { db, mocks } = createMockDb();
    mocks.onConflictDoUpdate.mockResolvedValue([]);

    const repo = new DrizzleSystemConfigRepo(db as any);
    await repo.upsert({
      commission: 15,
      allowRegistration: true,
      defaultBetAmount: 1500,
    });

    expect(mocks.values).toHaveBeenCalledWith({
      id: 1,
      commission: '15',
      allowRegistration: true,
      defaultBetAmount: 1500,
    });
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    const [arg] = mocks.onConflictDoUpdate.mock.calls[0];
    expect(arg).toHaveProperty('set');
    expect(arg.set).toEqual({
      commission: '15',
      allowRegistration: true,
      defaultBetAmount: 1500,
    });
  });
});
