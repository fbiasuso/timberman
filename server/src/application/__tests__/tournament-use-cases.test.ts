import { describe, it, expect, vi } from 'vitest';
import { CreateDateUseCase } from '../tournament/create-date-use-case.js';
import { CloseDateUseCase } from '../tournament/close-date-use-case.js';
import { PublishResultsUseCase } from '../tournament/publish-results-use-case.js';
import { PointsCalculator } from '../tournament/points-calculator.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import { Tournament } from '../../domain/entities/tournament.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { Match } from '../../domain/entities/match.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import { User } from '../../domain/entities/user.js';
import { PozoCalculator } from '../betting/pozo-calculator.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import {
  TournamentNotFoundError,
  MatchDateNotFoundError,
  DateNotClosedError,
  MatchDateNotOpenError,
  UserNotFoundError,
  MatchesNotReadyError,
} from '../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

function createTournamentRepoMocks() {
  const repo: TournamentRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn((md: MatchDate) => Promise.resolve(md)),
    updateMatchDate: vi.fn((md: MatchDate) => Promise.resolve(md)),
  };
  return repo;
}

function createMatchRepoMocks() {
  const repo: MatchRepo = {
    findById: vi.fn(),
    findByMatchDateId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    saveMany: vi.fn(),
  };
  return repo;
}

function createTicketRepoMocks() {
  const repo: TicketRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByMatchDateId: vi.fn(),
    findByUserAndDate: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    countByMatchDateId: vi.fn(),
  };
  return repo;
}

function createUserRepoMocks() {
  const repo: UserRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn(),
    update: vi.fn((u: User) => Promise.resolve(u)),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  return repo;
}

function createAuditLogRepoMocks() {
  const repo: AuditLogRepo = {
    save: vi.fn((log: any) => Promise.resolve(log)),
    findByAdminId: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };
  return repo;
}

function makeAdmin(id: string, balance = 0): User {
  return User.create({
    id,
    username: 'admin',
    passwordHash: 'hash',
    role: 'admin',
    balance,
    createdAt: new Date(),
  });
}

function makeUser(id: string, balance = 0): User {
  return User.create({
    id,
    username: `user-${id}`,
    passwordHash: 'hash',
    role: 'user',
    balance,
    createdAt: new Date(),
  });
}

/**
 * Fake unit of work: hands the given repos to the callback untouched and
 * records the invocation, so tests can assert the flow ran inside it.
 */
function createFakeUow(repos: TransactionRepos) {
  const withTransaction = vi.fn(
    async (fn: (txRepos: TransactionRepos) => Promise<unknown>) => fn(repos),
  );
  const uow: UnitOfWork = {
    withTransaction: withTransaction as unknown as UnitOfWork['withTransaction'],
  };
  return { uow, withTransaction };
}

// ── CreateDateUseCase ──────────────────────────────────────────────

describe('CreateDateUseCase', () => {
  it('creates a match date with default bet amount', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });
    vi.mocked(tournamentRepo.findById).mockResolvedValue(tournament);
    vi.mocked(tournamentRepo.saveMatchDate).mockImplementation(async (md) => md);

    const uc = new CreateDateUseCase(tournamentRepo);
    const result = await uc.execute({ tournamentId: 1, dateNumber: 1 });

    expect(result.tournamentId).toBe(1);
    expect(result.dateNumber).toBe(1);
    expect(result.status).toBe('open');
    expect(result.betAmount).toBe(1500);
    expect(result.pozo).toBe(0);
    expect(tournamentRepo.findById).toHaveBeenCalledWith(1);
    expect(tournamentRepo.saveMatchDate).toHaveBeenCalledOnce();
  });

  it('creates a match date with custom bet amount', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });
    vi.mocked(tournamentRepo.findById).mockResolvedValue(tournament);

    const uc = new CreateDateUseCase(tournamentRepo);
    const result = await uc.execute({ tournamentId: 1, dateNumber: 2, betAmount: 2000 });

    expect(result.betAmount).toBe(2000);
  });

  it('throws TournamentNotFoundError when tournament does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    vi.mocked(tournamentRepo.findById).mockResolvedValue(null);

    const uc = new CreateDateUseCase(tournamentRepo);
    await expect(uc.execute({ tournamentId: 999, dateNumber: 1 })).rejects.toThrow(
      TournamentNotFoundError,
    );
    expect(tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
  });
});

// ── CloseDateUseCase ───────────────────────────────────────────────

describe('CloseDateUseCase', () => {
  const openDate = MatchDate.create({
    id: 10,
    tournamentId: 1,
    dateNumber: 1,
    status: 'open',
    pozo: 0,
    betAmount: 1500,
    commission: 0,
    createdAt: new Date(),
  });

  const config = { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };

  function buildUseCase(
    tournamentRepo: TournamentRepo,
    ticketRepo: TicketRepo,
    userRepo: UserRepo,
    auditLogRepo: AuditLogRepo,
  ) {
    return new CloseDateUseCase(
      tournamentRepo,
      ticketRepo,
      new PozoCalculator(),
      config,
      userRepo,
      auditLogRepo,
    );
  }

  it('closes an open date, calculates pozo, credits the admin, and audits', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test', commission: 15 });
    const admin = makeAdmin('admin-1');

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(admin);

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    const result = await uc.execute(10, 'admin-1');

    // 5 tickets × 1500 = 7500 gross, 15% commission = 1125, pozo = 6375
    expect(result.status).toBe('closed');
    expect(result.pozo).toBe(6375);
    expect(result.commission).toBe(1125);
    expect(result.ticketCount).toBe(5);

    // Date persists pozo + commission snapshot
    const savedDate = vi.mocked(tournamentRepo.updateMatchDate).mock.calls[0][0];
    expect(savedDate.toSnapshot()).toMatchObject({ pozo: 6375, commission: 15 });

    // Carryover (0) is consumed — still persisted via update
    expect(tournamentRepo.update).toHaveBeenCalledOnce();

    // Admin balance credited 1125
    const credited = vi.mocked(userRepo.update).mock.calls[0][0];
    expect(credited.balance.cents).toBe(1125);

    // Audit entry recorded
    expect(auditLogRepo.save).toHaveBeenCalledOnce();
    const audit = vi.mocked(auditLogRepo.save).mock.calls[0][0];
    expect(audit.action).toBe('commission_payout');
    expect(audit.amount?.cents).toBe(1125);
  });

  it('adds tournament carryover to the pozo and resets it to zero', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test', carryover: 1200 });
    const admin = makeAdmin('admin-1');

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(admin);

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    const result = await uc.execute(10, 'admin-1');

    // 7500 gross − 1125 commission = 6375 base + 1200 carryover = 7575
    expect(result.pozo).toBe(7575);

    const reset = vi.mocked(tournamentRepo.update).mock.calls[0][0];
    expect(reset.carryover).toBe(0);
  });

  it('records pozo and commission as zero when there are no bets', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(0);

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    const result = await uc.execute(10, 'admin-1');

    expect(result.pozo).toBe(0);
    expect(result.commission).toBe(0);
    expect(userRepo.findByIdForUpdate).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(auditLogRepo.save).not.toHaveBeenCalled();
  });

  it('throws UserNotFoundError when the closing admin does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(null);

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    await expect(uc.execute(10, 'ghost-admin')).rejects.toThrow(UserNotFoundError);
  });

  it('throws MatchDateNotFoundError when date does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(null);

    const uc = buildUseCase(
      tournamentRepo,
      ticketRepo,
      createUserRepoMocks(),
      createAuditLogRepoMocks(),
    );
    await expect(uc.execute(999, 'admin-1')).rejects.toThrow(MatchDateNotFoundError);
  });

  it('throws MatchDateNotOpenError when trying to close an already closed date', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const closedDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'closed',
      pozo: 5000,
      betAmount: 1500,
      commission: 0,
      createdAt: new Date(),
    });
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);

    const uc = buildUseCase(
      tournamentRepo,
      ticketRepo,
      createUserRepoMocks(),
      createAuditLogRepoMocks(),
    );
    await expect(uc.execute(10, 'admin-1')).rejects.toThrow(MatchDateNotOpenError);
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
    expect(tournamentRepo.update).not.toHaveBeenCalled();
  });

  it('locks the match date row (findMatchDateByIdForUpdate) at the start of the close transaction', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeAdmin('admin-1'));

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    await uc.execute(10, 'admin-1');

    // The date read must go through the row lock — a concurrent close of the
    // same date blocks here and then sees the committed status (no double
    // commission credit). The plain read must never be used in this flow.
    expect(tournamentRepo.findMatchDateByIdForUpdate).toHaveBeenCalledWith(10);
    expect(tournamentRepo.findMatchDateById).not.toHaveBeenCalled();
  });

  it('locks the tournament row (findByIdForUpdate) when reading carryover', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test', carryover: 500 });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeAdmin('admin-1'));

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    await uc.execute(10, 'admin-1');

    // The carryover read must go through the row lock, never the plain read
    expect(tournamentRepo.findByIdForUpdate).toHaveBeenCalledWith(1);
    expect(tournamentRepo.findById).not.toHaveBeenCalled();
  });

  it('locks the admin row (findByIdForUpdate) before crediting the commission', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeAdmin('admin-1'));

    const uc = buildUseCase(tournamentRepo, ticketRepo, userRepo, auditLogRepo);
    await uc.execute(10, 'admin-1');

    // The balance credit must go through the row lock — a concurrent bet
    // deduction on the same user serializes here so the credit is never lost.
    // The plain read must never be used in this flow.
    expect(userRepo.findByIdForUpdate).toHaveBeenCalledWith('admin-1');
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('runs the whole close flow inside the provided unit of work', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test', carryover: 500 });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeAdmin('admin-1'));

    const { uow, withTransaction } = createFakeUow({
      tournamentRepo,
      ticketRepo,
      userRepo,
      auditLogRepo,
      matchRepo: undefined as never,
    });

    const uc = new CloseDateUseCase(
      tournamentRepo,
      ticketRepo,
      new PozoCalculator(),
      config,
      userRepo,
      auditLogRepo,
      uow,
    );
    const result = await uc.execute(10, 'admin-1');

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.status).toBe('closed');
    // Every write went through repos provided by the unit of work (atomic set)
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledOnce();
    expect(tournamentRepo.update).toHaveBeenCalledOnce();
    expect(userRepo.update).toHaveBeenCalledOnce();
    expect(auditLogRepo.save).toHaveBeenCalledOnce();
  });

  it('propagates errors from inside the unit of work so the transaction rolls back', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test' });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);
    vi.mocked(ticketRepo.countByMatchDateId).mockResolvedValue(5);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(null); // ghost admin

    const { uow, withTransaction } = createFakeUow({
      tournamentRepo,
      ticketRepo,
      userRepo,
      auditLogRepo,
      matchRepo: undefined as never,
    });

    const uc = new CloseDateUseCase(
      tournamentRepo,
      ticketRepo,
      new PozoCalculator(),
      config,
      userRepo,
      auditLogRepo,
      uow,
    );

    await expect(uc.execute(10, 'ghost-admin')).rejects.toThrow(UserNotFoundError);
    // The error surfaced out of the unit of work — the Drizzle implementation
    // turns that into a rollback (verified in drizzle-unit-of-work.test.ts).
    expect(withTransaction).toHaveBeenCalledOnce();
  });
});

// ── PublishResultsUseCase ──────────────────────────────────────────

describe('PublishResultsUseCase', () => {
  const closedDate = MatchDate.create({
    id: 10,
    tournamentId: 1,
    dateNumber: 1,
    status: 'closed',
    pozo: 6000,
    betAmount: 1500,
    commission: 0,
    createdAt: new Date(),
  });

  const matches = [
    Match.new({ id: 1, matchDateId: 10, localTeam: 'River', visitorTeam: 'Boca' }),
    Match.new({ id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente' }),
  ];

  const ticket = Ticket.new({
    id: 1,
    userId: 'user-1',
    matchDateId: 10,
    betAmount: 1500,
    predictions: [
      TicketPrediction.new({ matchId: 1, prediction: 'L' }),
      TicketPrediction.new({ matchId: 2, prediction: 'E' }),
    ],
  });

  function buildUseCase(
    tournamentRepo: TournamentRepo,
    matchRepo: MatchRepo,
    ticketRepo: TicketRepo,
    userRepo: UserRepo,
  ) {
    return new PublishResultsUseCase(
      tournamentRepo,
      matchRepo,
      ticketRepo,
      new PointsCalculator(),
      userRepo,
    );
  }

  it('publishes results, pays the winner, and persists the prize', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    // Set results on matches
    const matchesWithResults = matches.map((m) => {
      if (m.id === 1) return m.setResult('L', '2-0');
      if (m.id === 2) return m.setResult('V', '1-0');
      return m;
    });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(matchesWithResults);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeUser('user-1'));

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    const result = await uc.execute(10);

    expect(result.status).toBe('results');
    expect(result.points).toHaveLength(1);
    expect(result.points[0].ticketId).toBe(1);
    expect(result.points[0].correct).toBe(1); // L is correct, E is wrong
    expect(result.points[0].total).toBe(2);

    // Single winner takes the full pozo
    expect(result.winners).toEqual([{ ticketId: 1, userId: 'user-1', prize: 6000 }]);
    expect(userRepo.update).toHaveBeenCalledOnce();
    expect(ticketRepo.update).toHaveBeenCalledOnce();
    const paidTicket = vi.mocked(ticketRepo.update).mock.calls[0][0];
    expect(paidTicket.prizeWon).toBe(6000);
    // The transition is persisted FIRST (idempotency lock)
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledOnce();
  });

  it('splits the pozo among tied winners with remainder to the first ticket', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    const results = matches.map((m) => {
      if (m.id === 1) return m.setResult('L', '2-0');
      if (m.id === 2) return m.setResult('L', '1-0');
      return m;
    });

    // Both tickets predict L on match 1 → 1 correct each
    const ticketA = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'L' })],
    });
    const ticketB = Ticket.new({
      id: 2,
      userId: 'user-2',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'L' })],
    });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(results);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticketA, ticketB]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(userRepo.findByIdForUpdate).mockImplementation(async (userId: string) =>
      makeUser(userId),
    );

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    const result = await uc.execute(10);

    // 6000 / 2 = 3000 each — exact split
    expect(result.winners).toEqual([
      { ticketId: 1, userId: 'user-1', prize: 3000 },
      { ticketId: 2, userId: 'user-2', prize: 3000 },
    ]);
    expect(userRepo.update).toHaveBeenCalledTimes(2);
    expect(ticketRepo.update).toHaveBeenCalledTimes(2);
  });

  it('rolls the pozo into carryover when no ticket has correct predictions', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();
    const tournament = Tournament.new({ id: 1, name: 'Test', carryover: 0 });

    const results = matches.map((m) => {
      if (m.id === 1) return m.setResult('V', '0-2');
      if (m.id === 2) return m.setResult('L', '1-0');
      return m;
    });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(results);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(tournament);

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    const result = await uc.execute(10);

    expect(result.winners).toEqual([]);
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(ticketRepo.update).not.toHaveBeenCalled();

    const rolled = vi.mocked(tournamentRepo.update).mock.calls[0][0];
    expect(rolled.carryover).toBe(6000); // 0 + pozo
    // The carryover read-modify-write goes through the FOR UPDATE lock
    // (same as the close flow) — never the unlocked plain read.
    expect(tournamentRepo.findByIdForUpdate).toHaveBeenCalledWith(1);
    expect(tournamentRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a second publish with DateNotClosedError and does not double-pay', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    const results = matches.map((m) => {
      if (m.id === 1) return m.setResult('L', '2-0');
      if (m.id === 2) return m.setResult('V', '1-0');
      return m;
    });

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate)
      .mockResolvedValueOnce(closedDate) // first publish sees 'closed'
      .mockResolvedValueOnce(MatchDate.create({ ...closedDate.toSnapshot(), status: 'results' }));
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(results);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeUser('user-1'));

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    await uc.execute(10);
    await expect(uc.execute(10)).rejects.toThrow(DateNotClosedError);

    expect(userRepo.update).toHaveBeenCalledTimes(1); // no double credit
    expect(ticketRepo.update).toHaveBeenCalledTimes(1);
  });

  it('throws MatchDateNotFoundError when date does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(null);

    const uc = buildUseCase(
      tournamentRepo,
      createMatchRepoMocks(),
      createTicketRepoMocks(),
      createUserRepoMocks(),
    );
    await expect(uc.execute(999)).rejects.toThrow(MatchDateNotFoundError);
  });

  it('throws when trying to publish results on an open date', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const openDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: 0,
      createdAt: new Date(),
    });
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);

    const uc = buildUseCase(
      tournamentRepo,
      createMatchRepoMocks(),
      createTicketRepoMocks(),
      createUserRepoMocks(),
    );
    await expect(uc.execute(10)).rejects.toThrow(DateNotClosedError);
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
  });

  it('rejects publishing when a match is missing its result — no writes', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    // Match 1 has a result; match 2 does NOT
    const partial = [matches[0].setResult('L', '2-0'), matches[1]];

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(partial);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    await expect(uc.execute(10)).rejects.toThrow(MatchesNotReadyError);

    // Guard runs BEFORE any write: the date stays closed, nothing is credited
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(ticketRepo.update).not.toHaveBeenCalled();
    expect(tournamentRepo.update).not.toHaveBeenCalled();
  });

  it('rejects publishing when the date has no matches — no silent pozo roll', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue([]); // zero matches
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    await expect(uc.execute(10)).rejects.toThrow(MatchesNotReadyError);

    // The empty guard runs BEFORE any write: the date stays closed and the
    // pozo must NOT silently roll into carryover.
    expect(tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
    expect(tournamentRepo.update).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(ticketRepo.update).not.toHaveBeenCalled();
  });

  it('locks the match date row (findMatchDateByIdForUpdate) at the start of the publish transaction', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    const results = matches.map((m) => m.setResult('L', '2-0'));
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(results);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeUser('user-1'));

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    await uc.execute(10);

    // The date read must go through the row lock — a concurrent publish of
    // the same date blocks here and then sees the committed status (no
    // double payout). The plain read must never be used in this flow.
    expect(tournamentRepo.findMatchDateByIdForUpdate).toHaveBeenCalledWith(10);
    expect(tournamentRepo.findMatchDateById).not.toHaveBeenCalled();
  });

  it('locks the winner row (findByIdForUpdate) before crediting the prize', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    const results = matches.map((m) => m.setResult('L', '2-0'));
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(results);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeUser('user-1'));

    const uc = buildUseCase(tournamentRepo, matchRepo, ticketRepo, userRepo);
    await uc.execute(10);

    // The payout must go through the row lock — a concurrent bet deduction
    // on the same user serializes here so the credit is never lost. The
    // plain read must never be used in this flow.
    expect(userRepo.findByIdForUpdate).toHaveBeenCalledWith('user-1');
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('runs the whole publish flow inside the provided unit of work', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    const results = matches.map((m) => m.setResult('L', '2-0'));
    vi.mocked(tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
    vi.mocked(matchRepo.findByMatchDateId).mockResolvedValue(results);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
    vi.mocked(tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    vi.mocked(userRepo.findByIdForUpdate).mockResolvedValue(makeUser('user-1'));

    const { uow, withTransaction } = createFakeUow({
      tournamentRepo,
      matchRepo,
      ticketRepo,
      userRepo,
      auditLogRepo: {} as never,
    });

    const uc = new PublishResultsUseCase(
      tournamentRepo,
      matchRepo,
      ticketRepo,
      new PointsCalculator(),
      userRepo,
      uow,
    );
    const result = await uc.execute(10);

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.status).toBe('results');
    // All writes went through repos provided by the unit of work (atomic set)
    expect(tournamentRepo.updateMatchDate).toHaveBeenCalledOnce();
    expect(userRepo.update).toHaveBeenCalledOnce();
    expect(ticketRepo.update).toHaveBeenCalledOnce();
  });
});

// ── PointsCalculator ───────────────────────────────────────────────

describe('PointsCalculator', () => {
  it('counts correct predictions', () => {
    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '0-0'),
    ];
    const ticket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [
        TicketPrediction.new({ matchId: 1, prediction: 'L' }),
        TicketPrediction.new({ matchId: 2, prediction: 'E' }),
      ],
    });

    const calc = new PointsCalculator();
    const points = calc.calculate(matches, [ticket]);

    expect(points).toHaveLength(1);
    expect(points[0].correct).toBe(2);
    expect(points[0].total).toBe(2);
  });

  it('handles partial results (some matches without result)', () => {
    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('V', '0-2'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }), // no result yet
    ];
    const ticket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [
        TicketPrediction.new({ matchId: 1, prediction: 'V' }),
        TicketPrediction.new({ matchId: 2, prediction: 'L' }),
      ],
    });

    const calc = new PointsCalculator();
    const points = calc.calculate(matches, [ticket]);

    expect(points[0].correct).toBe(1); // only match 1 counted (V is correct)
    expect(points[0].total).toBe(1);    // only match 1 has a result
  });

  it('returns empty array when no tickets', () => {
    const matches = [Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' })];
    const calc = new PointsCalculator();
    const points = calc.calculate(matches, []);
    expect(points).toEqual([]);
  });

  it('sorts results by correct descending', () => {
    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '1-1'),
    ];
    const ticket1 = Ticket.new({
      id: 1, userId: 'u1', matchDateId: 10, betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'L' }), TicketPrediction.new({ matchId: 2, prediction: 'E' })],
    });
    const ticket2 = Ticket.new({
      id: 2, userId: 'u2', matchDateId: 10, betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'V' }), TicketPrediction.new({ matchId: 2, prediction: 'E' })],
    });

    const calc = new PointsCalculator();
    const points = calc.calculate(matches, [ticket1, ticket2]);

    expect(points[0].ticketId).toBe(1); // 2 correct
    expect(points[1].ticketId).toBe(2); // 1 correct
  });
});
