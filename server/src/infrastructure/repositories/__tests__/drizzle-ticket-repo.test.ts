import { describe, it, expect, vi } from 'vitest';
import { DrizzleTicketRepo } from '../drizzle-ticket-repo.js';
import { Ticket } from '../../../domain/entities/ticket.js';
import { TicketNotFoundError } from '../../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Build a fake PostgresJsDatabase with the query-chain shape the repo uses. */
function createMockDb() {
  const mocks = {
    selectWhere: vi.fn(),
    updateSet: vi.fn(),
    updateReturning: vi.fn(),
  };
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: mocks.selectWhere }),
    }),
    update: vi.fn().mockReturnValue({
      set: mocks.updateSet.mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: mocks.updateReturning }),
      }),
    }),
  };
  return { db, mocks };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('DrizzleTicketRepo.update()', () => {
  it('persists and returns prizeWon (set → save → read back)', async () => {
    const { db, mocks } = createMockDb();
    mocks.updateReturning.mockResolvedValue([
      {
        id: 1,
        userId: 'u1',
        matchDateId: 1,
        betAmount: 100,
        prizeWon: 500,
        createdAt: new Date(),
      },
    ]);
    mocks.selectWhere.mockResolvedValue([]); // no predictions

    const repo = new DrizzleTicketRepo(db as any);
    const ticket = Ticket.new({
      id: 1,
      userId: 'u1',
      matchDateId: 1,
      betAmount: 100,
      predictions: [],
    }).withPrize(500);

    const updated = await repo.update(ticket);

    expect(mocks.updateSet).toHaveBeenCalledWith({ betAmount: 100, prizeWon: 500 });
    expect(updated.prizeWon).toBe(500);
  });

  it('throws TicketNotFoundError when no row is returned', async () => {
    const { db, mocks } = createMockDb();
    mocks.updateReturning.mockResolvedValue([]);

    const repo = new DrizzleTicketRepo(db as any);
    const ticket = Ticket.new({
      id: 99,
      userId: 'u1',
      matchDateId: 1,
      betAmount: 100,
      predictions: [],
    });

    await expect(repo.update(ticket)).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});
