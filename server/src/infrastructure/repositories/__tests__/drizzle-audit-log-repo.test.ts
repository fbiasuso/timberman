import { describe, it, expect, vi } from 'vitest';
import { DrizzleAuditLogRepo } from '../drizzle-audit-log-repo.js';
import { AuditLog } from '../../../domain/entities/audit-log.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Build a fake PostgresJsDatabase with the query-chain shape the repo uses. */
function createMockDb() {
  const mocks = {
    selectWhere: vi.fn(),
    insertValues: vi.fn(),
    insertReturning: vi.fn(),
  };
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: mocks.selectWhere }),
    }),
    insert: vi.fn().mockReturnValue({
      values: mocks.insertValues.mockReturnValue({ returning: mocks.insertReturning }),
    }),
  };
  return { db, mocks };
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    adminId: 'admin-1',
    userId: null,
    action: 'commission_payout',
    amount: 500,
    reason: 'Commission payout for match date 1',
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleAuditLogRepo.save()', () => {
  it('strips the id: 0 sentinel from the insert so the serial PK assigns it', async () => {
    const { db, mocks } = createMockDb();
    mocks.insertReturning.mockResolvedValue([makeRow()]);

    const repo = new DrizzleAuditLogRepo(db as any);
    const saved = await repo.save(
      AuditLog.new({
        id: 0,
        adminId: 'admin-1',
        action: 'commission_payout',
        amount: 500,
        reason: 'Commission payout for match date 1',
      }),
    );

    // The snapshot's hardcoded id must never reach the SQL — inserting an
    // explicit 0 into the serial PK is what collides on the second row.
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: expect.anything() }),
    );
    // The DB-generated id from returning() is still mapped back
    expect(saved.id).toBe(1);
  });

  it('can save a second audit row without re-sending the id (regression for duplicate-key 500)', async () => {
    const { db, mocks } = createMockDb();
    mocks.insertReturning
      .mockResolvedValueOnce([makeRow({ id: 1 })])
      .mockResolvedValueOnce([makeRow({ id: 2 })]);

    const repo = new DrizzleAuditLogRepo(db as any);
    // Two inserts from the same domain flow — the second one used to collide
    // because both snapshots carried the id: 0 sentinel.
    await repo.save(
      AuditLog.new({ id: 0, adminId: 'admin-1', action: 'commission_payout', amount: 500 }),
    );
    await repo.save(
      AuditLog.new({ id: 0, adminId: 'admin-1', action: 'commission_payout', amount: 750 }),
    );

    expect(mocks.insertValues).toHaveBeenCalledTimes(2);
    for (const call of mocks.insertValues.mock.calls) {
      expect(call[0]).not.toHaveProperty('id');
    }
  });
});
