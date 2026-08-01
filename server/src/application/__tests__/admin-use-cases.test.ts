import { describe, it, expect, vi } from 'vitest';
import { ListUsersUseCase } from '../admin/list-users-use-case.js';
import { CreateUserUseCase } from '../admin/create-user-use-case.js';
import { CreateTournamentUseCase } from '../admin/create-tournament-use-case.js';
import { ListTournamentsUseCase } from '../admin/list-tournaments-use-case.js';
import { AdjustBalanceUseCase } from '../admin/adjust-balance-use-case.js';
import { DeleteUserUseCase } from '../admin/delete-user-use-case.js';
import { GetConfigUseCase } from '../admin/get-config-use-case.js';
import { UpdateConfigUseCase, InvalidConfigKeyError } from '../admin/update-config-use-case.js';
import { SetMatchResultUseCase } from '../admin/set-match-result-use-case.js';
import { PointsCalculator } from '../tournament/points-calculator.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { SystemConfigRepo } from '../../domain/ports/system-config-repo.js';
import type { BcryptService } from '../auth/register-use-case.js';
import { User } from '../../domain/entities/user.js';
import { Match } from '../../domain/entities/match.js';
import { Tournament } from '../../domain/entities/tournament.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import { DuplicateUsernameError, UserNotFoundError, MatchNotFoundError, InvalidCommissionError, InvalidConfigValueError } from '../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

function createUserRepoMocks() {
  const repo: UserRepo = {
    findById: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn((u: User) => Promise.resolve(u)),
    update: vi.fn((u: User) => Promise.resolve(u)),
    findAll: vi.fn(),
    delete: vi.fn(),
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

function createMatchRepoMocks() {
  const repo: MatchRepo = {
    findById: vi.fn(),
    findByMatchDateId: vi.fn(),
    save: vi.fn(),
    update: vi.fn((m: Match) => Promise.resolve(m)),
    saveMany: vi.fn(),
  };
  return repo;
}

function createAuditLogRepoMocks() {
  const repo: AuditLogRepo = {
    save: vi.fn(),
    findByAdminId: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };
  return repo;
}

function createConfigRepoMocks() {
  const repo: SystemConfigRepo = {
    get: vi.fn(),
    upsert: vi.fn(),
  };
  return repo;
}

function createBcryptMock(): BcryptService {
  return {
    hash: vi.fn((pw: string) => Promise.resolve(`hashed-${pw}`)),
    compare: vi.fn(),
  };
}

function makeUser(id: string, username: string, opts?: { role?: string; balance?: number }): User {
  return User.create({
    id,
    username,
    passwordHash: 'hash',
    role: (opts?.role as 'user' | 'admin') ?? 'user',
    balance: opts?.balance ?? 1000,
    createdAt: new Date(),
  });
}

// ── ListUsersUseCase ──────────────────────────────────────────────

describe('ListUsersUseCase', () => {
  it('returns all users without password hashes', async () => {
    const userRepo = createUserRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const pointsCalc = new PointsCalculator();

    const users = [makeUser('u1', 'Alice'), makeUser('u2', 'Bob', { role: 'admin' })];
    vi.mocked(userRepo.findAll).mockResolvedValue(users);
    vi.mocked(ticketRepo.findByUserId).mockResolvedValue([]);

    const uc = new ListUsersUseCase(userRepo, ticketRepo, matchRepo, pointsCalc);
    const result = await uc.execute();

    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('Alice');
    expect(result[1].username).toBe('Bob');
    // Ensure password hashes are NOT exposed
    for (const user of result) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('includes totalPoints computed from tickets', async () => {
    const userRepo = createUserRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const matchRepo = createMatchRepoMocks();
    const pointsCalc = new PointsCalculator();

    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findAll).mockResolvedValue([user]);
    vi.mocked(ticketRepo.findByUserId).mockResolvedValue([]);

    const uc = new ListUsersUseCase(userRepo, ticketRepo, matchRepo, pointsCalc);
    const result = await uc.execute();

    expect(result[0].totalPoints).toBe(0);
  });
});

// ── CreateUserUseCase ──────────────────────────────────────────────

describe('CreateUserUseCase', () => {
  it('creates a user with password hash', async () => {
    const userRepo = createUserRepoMocks();
    const bcrypt = createBcryptMock();
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);

    const uc = new CreateUserUseCase(userRepo, bcrypt);
    const result = await uc.execute({ username: 'newuser', password: 'secret123' });

    expect(result.username).toBe('newuser');
    expect(result.role).toBe('user');
    expect(result.balance).toBe(0);
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123');
    expect(userRepo.save).toHaveBeenCalledOnce();
  });

  it('creates a user with optional initial balance', async () => {
    const userRepo = createUserRepoMocks();
    const bcrypt = createBcryptMock();
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);

    const uc = new CreateUserUseCase(userRepo, bcrypt);
    const result = await uc.execute({ username: 'richuser', password: 'pass', balance: 5000 });

    expect(result.balance).toBe(5000);
  });

  it('throws DuplicateUsernameError when username exists', async () => {
    const userRepo = createUserRepoMocks();
    const bcrypt = createBcryptMock();
    vi.mocked(userRepo.findByUsername).mockResolvedValue(makeUser('u1', 'existing'));

    const uc = new CreateUserUseCase(userRepo, bcrypt);
    await expect(uc.execute({ username: 'existing', password: 'pass' })).rejects.toThrow(DuplicateUsernameError);
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});

// ── CreateTournamentUseCase ────────────────────────────────────────

describe('CreateTournamentUseCase', () => {
  function createTournamentRepoMocks() {
    const repo: import('../../domain/ports/tournament-repo.js').TournamentRepo = {
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      findActive: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn((t: any) => Promise.resolve(t)),
      update: vi.fn(),
      findMatchDateById: vi.fn(),
      findMatchDateByIdForUpdate: vi.fn(),
      findMatchDatesByTournamentId: vi.fn(),
      findOpenMatchDates: vi.fn(),
      saveMatchDate: vi.fn(),
      updateMatchDate: vi.fn(),
    };
    return repo;
  }

  it('defaults commission from the system config when not provided', async () => {
    const repo = createTournamentRepoMocks();
    const config = { commission: 20, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new CreateTournamentUseCase(repo, config);

    const result = await uc.execute({ name: 'Torneo' });

    expect(result.commission).toBe(20);
    expect(repo.save).toHaveBeenCalledOnce();
    const saved = vi.mocked(repo.save).mock.calls[0][0];
    expect(saved.toSnapshot().commission).toBe(20);
  });

  it('uses an explicit commission when provided', async () => {
    const repo = createTournamentRepoMocks();
    const config = { commission: 20, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new CreateTournamentUseCase(repo, config);

    const result = await uc.execute({ name: 'Torneo', commission: 10 });

    expect(result.commission).toBe(10);
  });
});

// ── ListTournamentsUseCase ─────────────────────────────────────────

describe('ListTournamentsUseCase', () => {
  function createTournamentRepoMocks() {
    const repo: import('../../domain/ports/tournament-repo.js').TournamentRepo = {
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
      saveMatchDate: vi.fn(),
      updateMatchDate: vi.fn(),
    };
    return repo;
  }

  it('includes per-date payout breakdown with winner usernames', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const ticketRepo = createTicketRepoMocks();
    const userRepo = createUserRepoMocks();

    const tournament = Tournament.new({ id: 1, name: 'Torneo', carryover: 500 });
    const date = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'results',
      pozo: 6000,
      betAmount: 1500,
      commission: 15,
      createdAt: new Date(),
    });
    const winningTicket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'L' })],
    }).withPrize(6000);
    const losingTicket = Ticket.new({
      id: 2,
      userId: 'user-2',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [TicketPrediction.new({ matchId: 1, prediction: 'V' })],
    });

    vi.mocked(tournamentRepo.findAll).mockResolvedValue([tournament]);
    vi.mocked(tournamentRepo.findMatchDatesByTournamentId).mockResolvedValue([date]);
    vi.mocked(ticketRepo.findByMatchDateId).mockResolvedValue([winningTicket, losingTicket]);
    vi.mocked(userRepo.findById).mockResolvedValue(makeUser('user-1', 'Alice'));

    const uc = new ListTournamentsUseCase(tournamentRepo, ticketRepo, userRepo);
    const result = await uc.execute();

    expect(result).toHaveLength(1);
    expect(result[0].carryover).toBe(500);
    expect(result[0].dates).toHaveLength(1);
    expect(result[0].dates[0]).toMatchObject({
      id: 10,
      dateNumber: 1,
      status: 'results',
      pozo: 6000,
      commission: 15,
    });
    // Only the paid ticket appears; the unpaid one is excluded
    expect(result[0].dates[0].winners).toEqual([
      { ticketId: 1, userId: 'user-1', username: 'Alice', prize: 6000 },
    ]);
    expect(userRepo.findById).toHaveBeenCalledWith('user-1');
  });
});

// ── AdjustBalanceUseCase ──────────────────────────────────────────

describe('AdjustBalanceUseCase', () => {
  it('adds balance with positive adjustment and creates audit log', async () => {
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const user = makeUser('u1', 'Alice', { balance: 1000 });
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    const uc = new AdjustBalanceUseCase(userRepo, auditLogRepo);
    const result = await uc.execute({ userId: 'u1', adminId: 'admin-1', amount: 500, reason: 'Bonus' });

    expect(result.previousBalance).toBe(1000);
    expect(result.newBalance).toBe(1500);
    expect(result.adjustedAmount).toBe(500);
    expect(userRepo.update).toHaveBeenCalledOnce();
    expect(auditLogRepo.save).toHaveBeenCalledOnce();
    const savedLog = vi.mocked(auditLogRepo.save).mock.calls[0][0];
    expect(savedLog.action).toBe('BALANCE_ADJUSTMENT_ADD');
    expect(savedLog.reason).toBe('Bonus');
  });

  it('deducts balance with negative adjustment and creates audit log', async () => {
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    const user = makeUser('u1', 'Alice', { balance: 2000 });
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    const uc = new AdjustBalanceUseCase(userRepo, auditLogRepo);
    const result = await uc.execute({ userId: 'u1', adminId: 'admin-1', amount: -300, reason: 'Fee' });

    expect(result.previousBalance).toBe(2000);
    expect(result.newBalance).toBe(1700);
    expect(result.adjustedAmount).toBe(-300);
    const savedLog = vi.mocked(auditLogRepo.save).mock.calls[0][0];
    expect(savedLog.action).toBe('BALANCE_ADJUSTMENT_DEDUCT');
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const userRepo = createUserRepoMocks();
    const auditLogRepo = createAuditLogRepoMocks();
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    const uc = new AdjustBalanceUseCase(userRepo, auditLogRepo);
    await expect(uc.execute({ userId: 'nonexistent', adminId: 'admin-1', amount: 100, reason: 'Test' })).rejects.toThrow(UserNotFoundError);
  });
});

// ── DeleteUserUseCase ──────────────────────────────────────────────

describe('DeleteUserUseCase', () => {
  it('deletes an existing user', async () => {
    const userRepo = createUserRepoMocks();
    const user = makeUser('u1', 'Alice');
    vi.mocked(userRepo.findById).mockResolvedValue(user);

    const uc = new DeleteUserUseCase(userRepo);
    await uc.execute('u1');

    expect(userRepo.delete).toHaveBeenCalledWith('u1');
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const userRepo = createUserRepoMocks();
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    const uc = new DeleteUserUseCase(userRepo);
    await expect(uc.execute('nonexistent')).rejects.toThrow(UserNotFoundError);
    expect(userRepo.delete).not.toHaveBeenCalled();
  });
});

// ── GetConfigUseCase ──────────────────────────────────────────────

describe('GetConfigUseCase', () => {
  it('returns the current config', () => {
    const config = { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new GetConfigUseCase(config);
    const result = uc.execute();

    expect(result).toEqual(config);
  });
});

// ── UpdateConfigUseCase ────────────────────────────────────────────

describe('UpdateConfigUseCase', () => {
  function makeConfig() {
    return { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };
  }

  it('updates commission key and persists via the config repo', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);
    const result = await uc.execute('commission', '20');

    expect(result.commission).toBe(20);
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ commission: 20, allowRegistration: true, defaultBetAmount: 1500 }),
    );
  });

  it('updates allowRegistration with coercion and persists', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);
    const result = await uc.execute('allowRegistration', 'false');

    expect(result.allowRegistration).toBe(false);
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ allowRegistration: false }),
    );
  });

  it('updates defaultBetAmount with numeric coercion and persists', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);
    const result = await uc.execute('defaultBetAmount', '2500');

    expect(result.defaultBetAmount).toBe(2500);
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ defaultBetAmount: 2500 }),
    );
  });

  it('throws InvalidConfigKeyError for invalid keys without persisting', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);

    await expect(uc.execute('invalidKey', 'value')).rejects.toThrow(InvalidConfigKeyError);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric commission with InvalidCommissionError', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);

    await expect(uc.execute('commission', 'abc')).rejects.toThrow(InvalidCommissionError);
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(config.commission).toBe(15); // shared ref untouched
  });

  it('rejects commission outside 0-100 with InvalidCommissionError', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);

    await expect(uc.execute('commission', 150)).rejects.toThrow(InvalidCommissionError);
    await expect(uc.execute('commission', -5)).rejects.toThrow(InvalidCommissionError);
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(config.commission).toBe(15);
  });

  it('rejects negative, non-integer, or NaN defaultBetAmount without persisting', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    const uc = new UpdateConfigUseCase(config, repo);

    await expect(uc.execute('defaultBetAmount', -100)).rejects.toThrow(InvalidConfigValueError);
    await expect(uc.execute('defaultBetAmount', 15.5)).rejects.toThrow(InvalidConfigValueError);
    await expect(uc.execute('defaultBetAmount', 'abc')).rejects.toThrow(InvalidConfigValueError);
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(config.defaultBetAmount).toBe(1500);
  });

  it('does not mutate the shared config when the upsert fails', async () => {
    const config = makeConfig();
    const repo = createConfigRepoMocks();
    vi.mocked(repo.upsert).mockRejectedValue(new Error('db down'));
    const uc = new UpdateConfigUseCase(config, repo);

    await expect(uc.execute('commission', 20)).rejects.toThrow('db down');
    expect(config.commission).toBe(15); // in-memory never diverges from DB
  });
});

// ── SetMatchResultUseCase ─────────────────────────────────────────

describe('SetMatchResultUseCase', () => {
  it('sets result on a match', async () => {
    const matchRepo = createMatchRepoMocks();
    const match = Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' });
    vi.mocked(matchRepo.findById).mockResolvedValue(match);

    const uc = new SetMatchResultUseCase(matchRepo);
    const result = await uc.execute({ matchId: 1, result: 'L', score: '2-1' });

    expect(result.result).toBe('L');
    expect(result.score).toBe('2-1');
    expect(matchRepo.update).toHaveBeenCalledOnce();
  });

  it('sets result without score', async () => {
    const matchRepo = createMatchRepoMocks();
    const match = Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' });
    vi.mocked(matchRepo.findById).mockResolvedValue(match);

    const uc = new SetMatchResultUseCase(matchRepo);
    const result = await uc.execute({ matchId: 1, result: 'V' });

    expect(result.result).toBe('V');
    expect(result.score).toBeNull();
  });

  it('throws MatchNotFoundError when match does not exist', async () => {
    const matchRepo = createMatchRepoMocks();
    vi.mocked(matchRepo.findById).mockResolvedValue(null);

    const uc = new SetMatchResultUseCase(matchRepo);
    await expect(uc.execute({ matchId: 999, result: 'L' })).rejects.toThrow(MatchNotFoundError);
    expect(matchRepo.update).not.toHaveBeenCalled();
  });
});
