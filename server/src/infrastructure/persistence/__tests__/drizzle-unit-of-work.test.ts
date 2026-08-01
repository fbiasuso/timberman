import { describe, it, expect, vi } from 'vitest';
import { DrizzleUnitOfWork } from '../drizzle-unit-of-work.js';
import { DrizzleTournamentRepo } from '../../repositories/drizzle-tournament-repo.js';
import { DrizzleMatchRepo } from '../../repositories/drizzle-match-repo.js';
import { DrizzleTicketRepo } from '../../repositories/drizzle-ticket-repo.js';
import { DrizzleUserRepo } from '../../repositories/drizzle-user-repo.js';
import { DrizzleAuditLogRepo } from '../../repositories/drizzle-audit-log-repo.js';
import type { UnitOfWork } from '../../../domain/ports/unit-of-work.js';

// ── Helpers ────────────────────────────────────────────────────────

const TOURNAMENT_ROW = {
  id: 1,
  name: 'Torneo',
  commission: '15.00',
  isActive: true,
  carryover: 0,
  createdAt: new Date(),
};

/**
 * Fake Drizzle client.
 * The select chain is `select().from().where(...)` and, for the locked
 * read, `.where(...).for('update')` — so the where-result must be BOTH
 * an awaitable array (plain read) AND expose `.for()` (locked read).
 */
function createFakeClient() {
  const whereResult: any = [TOURNAMENT_ROW];
  whereResult.for = vi.fn().mockResolvedValue([TOURNAMENT_ROW]);
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(whereResult),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([TOURNAMENT_ROW]) }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([TOURNAMENT_ROW]) }),
      }),
    }),
  };
}

function buildUow(db: any): UnitOfWork {
  return new DrizzleUnitOfWork(db as any, {
    tournamentRepo: (tx) => new DrizzleTournamentRepo(tx),
    matchRepo: (tx) => new DrizzleMatchRepo(tx),
    ticketRepo: (tx) => new DrizzleTicketRepo(tx),
    userRepo: (tx) => new DrizzleUserRepo(tx),
    auditLogRepo: (tx) => new DrizzleAuditLogRepo(tx),
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleUnitOfWork', () => {
  it('runs the callback inside db.transaction with transaction-bound repos', async () => {
    const tx = createFakeClient();
    const db = {
      transaction: vi.fn(async (fn: (t: any) => Promise<unknown>) => fn(tx)),
    };

    const uow = buildUow(db);
    const result = await uow.withTransaction(async (repos) => {
      // The callback must receive working repos bound to the tx client
      const tournament = await repos.tournamentRepo.findById(1);
      return { found: tournament !== null };
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(result).toEqual({ found: true });
    // The repo query went through the tx client, not the main db
    expect(tx.select).toHaveBeenCalled();
  });

  it('rebuilds every repository bound to the transaction client', async () => {
    const tx = createFakeClient();
    const db = { transaction: vi.fn(async (fn: (t: any) => Promise<unknown>) => fn(tx)) };
    const factories = {
      tournamentRepo: vi.fn((d: any) => new DrizzleTournamentRepo(d)),
      matchRepo: vi.fn((d: any) => new DrizzleMatchRepo(d)),
      ticketRepo: vi.fn((d: any) => new DrizzleTicketRepo(d)),
      userRepo: vi.fn((d: any) => new DrizzleUserRepo(d)),
      auditLogRepo: vi.fn((d: any) => new DrizzleAuditLogRepo(d)),
    };
    const uow = new DrizzleUnitOfWork(db as any, factories);

    await uow.withTransaction(async (repos) => {
      // The callback receives all five repos, each bound to the tx client
      expect(repos.tournamentRepo).toBeDefined();
      expect(repos.matchRepo).toBeDefined();
      expect(repos.ticketRepo).toBeDefined();
      expect(repos.userRepo).toBeDefined();
      expect(repos.auditLogRepo).toBeDefined();
    });

    // Every factory received the transaction client as its db handle
    for (const factory of Object.values(factories)) {
      expect(factory).toHaveBeenCalledWith(tx);
    }
  });

  it('propagates callback errors so the transaction rolls back', async () => {
    const tx = createFakeClient();
    const db = {
      transaction: vi.fn(async (fn: (t: any) => Promise<unknown>) => fn(tx)),
    };

    const uow = buildUow(db);
    await expect(
      uow.withTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
