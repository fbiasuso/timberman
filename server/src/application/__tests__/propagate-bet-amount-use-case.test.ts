import { describe, it, expect, vi } from 'vitest';
import { PropagateBetAmountUseCase } from '../admin/propagate-bet-amount-use-case.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { Tournament } from '../../domain/entities/tournament.js';
import { Money } from '../../domain/value-objects/money.js';
import { AuditLog } from '../../domain/entities/audit-log.js';

// ── Mock factories (mirror admin-use-cases.test.ts style) ──────────

function tournamentRepoStub(dates: MatchDate[]) {
  const repo: TournamentRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    createInitialTournament: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn((id: number) =>
      Promise.resolve(dates.find((d) => d.id === id) ?? null),
    ),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn().mockResolvedValue(dates),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn((md: MatchDate) => Promise.resolve(md)),
  };
  return repo;
}

function ticketRepoStub(counts: Map<number, number>) {
  const repo: TicketRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByMatchDateId: vi.fn(),
    findByUserAndDate: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    countByMatchDateId: vi.fn((id: number) =>
      Promise.resolve(counts.get(id) ?? 0),
    ),
  };
  return repo;
}

function auditLogRepoStub() {
  const repo: AuditLogRepo = {
    save: vi.fn((log: AuditLog) => Promise.resolve(log)),
    findByAdminId: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };
  return repo;
}

function fakeUow(repos: TransactionRepos) {
  const withTransaction = vi.fn(
    async (fn: (txRepos: TransactionRepos) => Promise<unknown>) => fn(repos),
  );
  const uow: UnitOfWork = {
    withTransaction: withTransaction as unknown as UnitOfWork['withTransaction'],
  };
  return { uow, withTransaction };
}

function makeDate(id: number, dateNumber: number, betAmount = 1500): MatchDate {
  return MatchDate.create({
    id,
    tournamentId: 1,
    dateNumber,
    status: 'open',
    pozo: 0,
    betAmount,
    commission: 0,
    createdAt: new Date('2025-01-01'),
  });
}

/** The ACTIVE tournament the dates belong to (dates above use tournamentId 1). */
const activeTournament = () => Tournament.new({ id: 1, name: 'Test' });

const ADMIN_ID = 'admin-1';
const NEW_AMOUNT = Money.fromCents(800);

// ── Tests ─────────────────────────────────────────────────────────

describe('PropagateBetAmountUseCase', () => {
  it('updates all open dates when none have tickets, writes both audit rows', async () => {
    const dates = [makeDate(10, 1), makeDate(11, 2)];
    const tournamentRepo = tournamentRepoStub(dates);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(activeTournament());
    const ticketRepo = ticketRepoStub(new Map([[10, 0], [11, 0]]));
    const auditLogRepo = auditLogRepoStub();
    const repos = { tournamentRepo, ticketRepo, auditLogRepo } as unknown as TransactionRepos;
    const { uow, withTransaction } = fakeUow(repos);

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo, uow);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    expect(withTransaction).toHaveBeenCalledOnce();
    // The open-date read is scoped to the ACTIVE tournament (design D3)
    expect(tournamentRepo.findOpenMatchDates).toHaveBeenCalledWith(1);
    expect(result.updatedDates).toEqual([
      { id: 10, dateNumber: 1, betAmount: 800 },
      { id: 11, dateNumber: 2, betAmount: 800 },
    ]);
    expect(result.blockedDates).toEqual([]);
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledTimes(2);
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);

    // First audit row: config update
    const [log1, log2] = vi.mocked(auditLogRepo.save).mock.calls.map((c) => c[0]);
    expect(log1.action).toBe('default_bet_amount_update');
    expect(log1.amount?.cents).toBe(800);
    expect(log1.reason).toBeNull();

    // Second audit row: propagation aggregate
    expect(log2.action).toBe('default_bet_amount_propagation');
    expect(log2.amount?.cents).toBe(800);
    expect(JSON.parse(log2.reason!)).toEqual({ changed: [10, 11], blocked: [] });
  });

  it('splits result when some open dates have tickets', async () => {
    const dates = [makeDate(10, 1), makeDate(11, 2), makeDate(12, 3)];
    const ticketRepo = ticketRepoStub(new Map([[10, 0], [11, 3], [12, 1]]));
    const tournamentRepo = tournamentRepoStub(dates);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(activeTournament());
    const auditLogRepo = auditLogRepoStub();
    const repos = { tournamentRepo, ticketRepo, auditLogRepo } as unknown as TransactionRepos;
    const { uow, withTransaction } = fakeUow(repos);

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo, uow);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.updatedDates).toEqual([{ id: 10, dateNumber: 1, betAmount: 800 }]);
    expect(result.blockedDates).toEqual([
      { id: 11, dateNumber: 2, betAmount: 1500 },
      { id: 12, dateNumber: 3, betAmount: 1500 },
    ]);
    // Only the ticket-free date was updated
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledTimes(1);
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);

    const [log1, log2] = vi.mocked(auditLogRepo.save).mock.calls.map((c) => c[0]);
    expect(log1.action).toBe('default_bet_amount_update');
    expect(JSON.parse(log2.reason!)).toEqual({ changed: [10], blocked: [11, 12] });
  });

  it('reports all as blocked when every open date has tickets, still saves both audit rows', async () => {
    const dates = [makeDate(10, 1), makeDate(11, 2)];
    const ticketRepo = ticketRepoStub(new Map([[10, 5], [11, 2]]));
    const tournamentRepo = tournamentRepoStub(dates);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(activeTournament());
    const auditLogRepo = auditLogRepoStub();
    const repos = { tournamentRepo, ticketRepo, auditLogRepo } as unknown as TransactionRepos;
    const { uow, withTransaction } = fakeUow(repos);

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo, uow);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.updatedDates).toEqual([]);
    expect(result.blockedDates).toEqual([
      { id: 10, dateNumber: 1, betAmount: 1500 },
      { id: 11, dateNumber: 2, betAmount: 1500 },
    ]);
    // No dates updated
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
    // Both audit rows are still written
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);

    const [log1, log2] = vi.mocked(auditLogRepo.save).mock.calls.map((c) => c[0]);
    expect(log1.action).toBe('default_bet_amount_update');
    expect(log2.action).toBe('default_bet_amount_propagation');
    expect(JSON.parse(log2.reason!)).toEqual({ changed: [], blocked: [10, 11] });
  });

  it('returns empty arrays and both audit rows when no open dates exist', async () => {
    const tournamentRepo = tournamentRepoStub([]);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(activeTournament());
    const ticketRepo = ticketRepoStub(new Map());
    const auditLogRepo = auditLogRepoStub();
    const repos = { tournamentRepo, ticketRepo, auditLogRepo } as unknown as TransactionRepos;
    const { uow, withTransaction } = fakeUow(repos);

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo, uow);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.updatedDates).toEqual([]);
    expect(result.blockedDates).toEqual([]);
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);

    const [log1, log2] = vi.mocked(auditLogRepo.save).mock.calls.map((c) => c[0]);
    expect(log1.action).toBe('default_bet_amount_update');
    expect(log2.action).toBe('default_bet_amount_propagation');
    expect(JSON.parse(log2.reason!)).toEqual({ changed: [], blocked: [] });
  });

  it('skips the propagation loop entirely when no tournament is active — audit rows still written', async () => {
    const tournamentRepo = tournamentRepoStub([makeDate(10, 1)]);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(null);
    const ticketRepo = ticketRepoStub(new Map([[10, 0]]));
    const auditLogRepo = auditLogRepoStub();
    const repos = { tournamentRepo, ticketRepo, auditLogRepo } as unknown as TransactionRepos;
    const { uow, withTransaction } = fakeUow(repos);

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo, uow);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    // No date is touched: open dates are never read, nothing is updated
    expect(withTransaction).toHaveBeenCalledOnce();
    expect(tournamentRepo.findOpenMatchDates).not.toHaveBeenCalled();
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
    expect(result.updatedDates).toEqual([]);
    expect(result.blockedDates).toEqual([]);
    // The audit rows are kept per design
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);

    const [log1, log2] = vi.mocked(auditLogRepo.save).mock.calls.map((c) => c[0]);
    expect(log1.action).toBe('default_bet_amount_update');
    expect(log2.action).toBe('default_bet_amount_propagation');
    expect(JSON.parse(log2.reason!)).toEqual({ changed: [], blocked: [] });
  });

  it('touches only the active tournament dates — finished-tournament open dates stay untouched', async () => {
    // The open dates BELONG to the active tournament (id 1) in this flow; the
    // scoping happens server-side via findOpenMatchDates(active.id). A date
    // of a non-active tournament is simply never read by the use case.
    const dates = [makeDate(10, 1), makeDate(11, 2)];
    const tournamentRepo = tournamentRepoStub(dates);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(activeTournament());
    const ticketRepo = ticketRepoStub(new Map([[10, 0], [11, 0]]));
    const auditLogRepo = auditLogRepoStub();
    const repos = { tournamentRepo, ticketRepo, auditLogRepo } as unknown as TransactionRepos;
    const { uow } = fakeUow(repos);

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo, uow);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    // Both queries are scoped by the active tournament id — the repo filter
    // (drizzle) guarantees finished/archived tournament dates are excluded.
    expect(tournamentRepo.findActive).toHaveBeenCalledOnce();
    expect(tournamentRepo.findOpenMatchDates).toHaveBeenCalledWith(1);
    expect(result.updatedDates).toHaveLength(2);
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledTimes(2);
  });

  it('passes injected repos directly when no UoW is provided (no-op boundary)', async () => {
    const dates = [makeDate(10, 1)];
    const tournamentRepo = tournamentRepoStub(dates);
    vi.mocked(tournamentRepo.findActive).mockResolvedValue(activeTournament());
    const ticketRepo = ticketRepoStub(new Map([[10, 0]]));
    const auditLogRepo = auditLogRepoStub();

    const uc = new PropagateBetAmountUseCase(tournamentRepo, ticketRepo, auditLogRepo);
    const result = await uc.execute(ADMIN_ID, NEW_AMOUNT);

    expect(result.updatedDates).toEqual([{ id: 10, dateNumber: 1, betAmount: 800 }]);
    expect(tournamentRepo.findOpenMatchDates).toHaveBeenCalledWith(1);
    expect(auditLogRepo.save).toHaveBeenCalledTimes(2);
  });
});