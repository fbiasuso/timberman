import { describe, it, expect, vi } from 'vitest';
import { ListUsersUseCase } from '../admin/list-users-use-case.js';
import { CreateUserUseCase } from '../admin/create-user-use-case.js';
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
import type { BcryptService } from '../auth/register-use-case.js';
import { User } from '../../domain/entities/user.js';
import { Match } from '../../domain/entities/match.js';
import { DuplicateUsernameError, UserNotFoundError, MatchNotFoundError } from '../../domain/errors/index.js';

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
  it('updates commission key', () => {
    const config = { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new UpdateConfigUseCase(config);
    const result = uc.execute('commission', '20');

    expect(result.commission).toBe(20);
  });

  it('updates allowRegistration with coercion', () => {
    const config = { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new UpdateConfigUseCase(config);
    const result = uc.execute('allowRegistration', 'false');

    expect(result.allowRegistration).toBe(false);
  });

  it('updates defaultBetAmount with numeric coercion', () => {
    const config = { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new UpdateConfigUseCase(config);
    const result = uc.execute('defaultBetAmount', '2500');

    expect(result.defaultBetAmount).toBe(2500);
  });

  it('throws InvalidConfigKeyError for invalid keys', () => {
    const config = { commission: 15, allowRegistration: true, defaultBetAmount: 1500 };
    const uc = new UpdateConfigUseCase(config);
    expect(() => uc.execute('invalidKey', 'value')).toThrow(InvalidConfigKeyError);
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
