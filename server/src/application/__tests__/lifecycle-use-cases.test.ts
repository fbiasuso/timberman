import { describe, it, expect, vi } from 'vitest';
import { TerminateTournamentUseCase } from '../admin/terminate-tournament-use-case.js';
import { ArchiveTournamentUseCase } from '../admin/archive-tournament-use-case.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { AuditLogRepo } from '../../domain/ports/audit-log-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import { Tournament } from '../../domain/entities/tournament.js';
import { User } from '../../domain/entities/user.js';
import {
  TournamentNotFoundError,
  TournamentOpenDateError,
  TournamentNotActiveError,
  TournamentNotFinishedError,
} from '../../domain/errors/index.js';
import { DEFAULT_SYSTEM_CONFIG } from '../../domain/entities/system-config.js';

// ── Helpers ────────────────────────────────────────────────────────

function createTournamentRepoMocks() {
  const repo: TournamentRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    createInitialTournament: vi.fn(),
    save: vi.fn((t: Tournament) => Promise.resolve(t)),
    update: vi.fn((t: Tournament) => Promise.resolve(t)),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn(),
  };
  return repo;
}

function createPointsRepoMocks() {
  const repo: TournamentPointsRepo = {
    savePoints: vi.fn().mockResolvedValue(undefined),
    findByTournamentId: vi.fn(),
    findByUserAndTournament: vi.fn(),
    saveWinners: vi.fn().mockResolvedValue(undefined),
    findWinnersByTournamentId: vi.fn(),
  };
  return repo;
}

function createUserRepoMocks() {
  const repo: UserRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn((u: User) => Promise.resolve(u)),
    update: vi.fn((u: User) => Promise.resolve(u)),
    findAll: vi.fn(),
    delete: vi.fn(),
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

function makeUser(id: string, username: string): User {
  return User.create({
    id,
    username,
    passwordHash: 'hash',
    role: 'user',
    balance: 1000,
    createdAt: new Date(),
  });
}

function createFakeUow(repos: TransactionRepos) {
  const withTransaction = vi.fn(
    async (fn: (txRepos: TransactionRepos) => Promise<unknown>) => fn(repos),
  );
  const uow: UnitOfWork = {
    withTransaction: withTransaction as unknown as UnitOfWork['withTransaction'],
  };
  return { uow, withTransaction };
}

/** Active tournament with no open dates */
function activeTournament(id = 1): Tournament {
  return Tournament.new({ id, name: `Torneo ${id}` });
}

function finishedTournament(id = 1): Tournament {
  return activeTournament(id).finish();
}

// ── TerminateTournamentUseCase (T16) ───────────────────────────────

describe('TerminateTournamentUseCase', () => {
  it('finishes an active tournament and persists the max-point winners', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(activeTournament(1));
    vi.mocked(tournamentRepo.findOpenMatchDates).mockResolvedValue([]);
    vi.mocked(pointsRepo.findByTournamentId).mockResolvedValue([
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 10 },
      { userId: 'u1', tournamentId: 1, matchDateId: 2, points: 5 },
      { userId: 'u2', tournamentId: 1, matchDateId: 1, points: 10 },
      { userId: 'u3', tournamentId: 1, matchDateId: 1, points: 4 },
    ]);
    vi.mocked(userRepo.findAll).mockResolvedValue([
      makeUser('u1', 'Alice'),
      makeUser('u2', 'Bob'),
      makeUser('u3', 'Carol'),
    ]);

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
    );
    const result = await uc.execute('admin-1', 1);

    // Status transition persisted (entity stamps finishedAt)
    expect(tournamentRepo.update).toHaveBeenCalledOnce();
    const updated = vi.mocked(tournamentRepo.update).mock.calls[0][0];
    expect(updated.status).toBe('finished');
    expect(updated.finishedAt).not.toBeNull();

    // Winners: max total is 15 (u1) — u2 totals 10, u3 totals 4
    expect(pointsRepo.saveWinners).toHaveBeenCalledWith(1, ['u1']);
    expect(result).toMatchObject({
      id: 1,
      status: 'finished',
      winners: [{ userId: 'u1', username: 'Alice', points: 15 }],
    });
    expect(result.finishedAt).not.toBeNull();

    // Audit written
    expect(auditRepo.save).toHaveBeenCalledOnce();
    const log = vi.mocked(auditRepo.save).mock.calls[0][0];
    expect(log.action).toBe('tournament_finished');
    expect(log.adminId).toBe('admin-1');
  });

  it('returns NO winners and skips saveWinners when max points is zero', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(activeTournament(1));
    vi.mocked(tournamentRepo.findOpenMatchDates).mockResolvedValue([]);
    // All participants scored zero
    vi.mocked(pointsRepo.findByTournamentId).mockResolvedValue([
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 0 },
      { userId: 'u2', tournamentId: 1, matchDateId: 1, points: 0 },
    ]);
    vi.mocked(userRepo.findAll).mockResolvedValue([]);

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
    );
    const result = await uc.execute('admin-1', 1);

    expect(pointsRepo.saveWinners).not.toHaveBeenCalled();
    expect(result.winners).toEqual([]);
    expect(result.status).toBe('finished');
  });

  it('returns NO winners when no points rows exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(activeTournament(1));
    vi.mocked(tournamentRepo.findOpenMatchDates).mockResolvedValue([]);
    vi.mocked(pointsRepo.findByTournamentId).mockResolvedValue([]);
    vi.mocked(userRepo.findAll).mockResolvedValue([]);

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
    );
    const result = await uc.execute('admin-1', 1);

    expect(pointsRepo.saveWinners).not.toHaveBeenCalled();
    expect(result.winners).toEqual([]);
  });

  it('rejects with 409 when an open match date exists (betting round in flight)', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(activeTournament(1));
    vi.mocked(tournamentRepo.findOpenMatchDates).mockResolvedValue([
      { id: 5, dateNumber: 2 } as never,
    ]);

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
    );

    await expect(uc.execute('admin-1', 1)).rejects.toBeInstanceOf(
      TournamentOpenDateError,
    );
    expect(tournamentRepo.update).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('rejects with 422 when the tournament is not active', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(
      finishedTournament(1),
    );

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
    );

    await expect(uc.execute('admin-1', 1)).rejects.toBeInstanceOf(
      TournamentNotActiveError,
    );
    expect(tournamentRepo.update).not.toHaveBeenCalled();
  });

  it('rejects with 404 when the tournament does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(null);

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
    );

    await expect(uc.execute('admin-1', 99)).rejects.toBeInstanceOf(
      TournamentNotFoundError,
    );
  });

  it('runs the whole flow inside the UnitOfWork transaction when provided', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const pointsRepo = createPointsRepoMocks();
    const userRepo = createUserRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(activeTournament(1));
    vi.mocked(tournamentRepo.findOpenMatchDates).mockResolvedValue([]);
    vi.mocked(pointsRepo.findByTournamentId).mockResolvedValue([
      { userId: 'u1', tournamentId: 1, matchDateId: 1, points: 10 },
    ]);
    vi.mocked(userRepo.findAll).mockResolvedValue([makeUser('u1', 'Alice')]);

    const { uow, withTransaction } = createFakeUow({
      tournamentRepo,
      tournamentPointsRepo: pointsRepo,
      matchRepo: undefined as never,
      ticketRepo: undefined as never,
      userRepo,
      auditLogRepo: auditRepo,
    });

    const uc = new TerminateTournamentUseCase(
      tournamentRepo,
      pointsRepo,
      userRepo,
      auditRepo,
      uow,
    );
    const result = await uc.execute('admin-1', 1);

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.status).toBe('finished');
    expect(auditRepo.save).toHaveBeenCalledOnce();
  });
});

// ── ArchiveTournamentUseCase (T17) ─────────────────────────────────

describe('ArchiveTournamentUseCase', () => {
  it('archives a finished tournament and creates the next one ("Torneo N+1")', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(
      finishedTournament(1), // name "Torneo 1"
    );
    // save() assigns the next id — simulate the repo
    vi.mocked(tournamentRepo.save).mockImplementation(async (t: Tournament) =>
      Tournament.create({ ...t.toSnapshot(), id: 2 }),
    );

    const uc = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditRepo,
      DEFAULT_SYSTEM_CONFIG,
    );
    const result = await uc.execute('admin-1', 1);

    // Archive FIRST, then create — no window where two tournaments are active
    const updateCall = vi.mocked(tournamentRepo.update).mock.invocationCallOrder[0];
    const saveCall = vi.mocked(tournamentRepo.save).mock.invocationCallOrder[0];
    expect(updateCall).toBeLessThan(saveCall);

    const archived = vi.mocked(tournamentRepo.update).mock.calls[0][0];
    expect(archived.status).toBe('archived');
    expect(archived.finishedAt).not.toBeNull();

    const next = vi.mocked(tournamentRepo.save).mock.calls[0][0];
    expect(next.status).toBe('active');
    expect(next.carryover).toBe(0);
    expect(next.commission.value).toBe(DEFAULT_SYSTEM_CONFIG.commission);
    expect(next.name).toBe('Torneo 2');

    expect(result).toEqual({
      id: 1,
      status: 'archived',
      nextTournament: { id: 2, name: 'Torneo 2', status: 'active' },
    });

    // Audit written
    expect(auditRepo.save).toHaveBeenCalledOnce();
    const log = vi.mocked(auditRepo.save).mock.calls[0][0];
    expect(log.action).toBe('tournament_archived');
    expect(log.adminId).toBe('admin-1');
  });

  it('derives the next name from the last number in the name', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(
      Tournament.create({
        ...finishedTournament(7).toSnapshot(),
        name: 'Torneo Año 2024',
      }),
    );
    vi.mocked(tournamentRepo.save).mockImplementation(async (t: Tournament) =>
      Tournament.create({ ...t.toSnapshot(), id: 8 }),
    );

    const uc = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditRepo,
      DEFAULT_SYSTEM_CONFIG,
    );
    const result = await uc.execute('admin-1', 7);

    expect(result.nextTournament.name).toBe('Torneo 2025');
  });

  it('falls back to id + 1 when the name has no parseable number', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(
      Tournament.create({
        ...finishedTournament(3).toSnapshot(),
        name: 'Torneo Timberman',
      }),
    );
    vi.mocked(tournamentRepo.save).mockImplementation(async (t: Tournament) =>
      Tournament.create({ ...t.toSnapshot(), id: 4 }),
    );

    const uc = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditRepo,
      DEFAULT_SYSTEM_CONFIG,
    );
    const result = await uc.execute('admin-1', 3);

    expect(result.nextTournament.name).toBe('Torneo 4');
  });

  it('rejects with 422 when the tournament is not finished', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(
      activeTournament(1),
    );

    const uc = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditRepo,
      DEFAULT_SYSTEM_CONFIG,
    );

    await expect(uc.execute('admin-1', 1)).rejects.toBeInstanceOf(
      TournamentNotFinishedError,
    );
    expect(tournamentRepo.update).not.toHaveBeenCalled();
    expect(tournamentRepo.save).not.toHaveBeenCalled();
  });

  it('rejects with 404 when the tournament does not exist', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(null);

    const uc = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditRepo,
      DEFAULT_SYSTEM_CONFIG,
    );

    await expect(uc.execute('admin-1', 99)).rejects.toBeInstanceOf(
      TournamentNotFoundError,
    );
    expect(tournamentRepo.save).not.toHaveBeenCalled();
  });

  it('runs the whole flow inside the UnitOfWork transaction when provided', async () => {
    const tournamentRepo = createTournamentRepoMocks();
    const auditRepo = createAuditLogRepoMocks();

    vi.mocked(tournamentRepo.findByIdForUpdate).mockResolvedValue(
      finishedTournament(1),
    );
    vi.mocked(tournamentRepo.save).mockImplementation(async (t: Tournament) =>
      Tournament.create({ ...t.toSnapshot(), id: 2 }),
    );

    const { uow, withTransaction } = createFakeUow({
      tournamentRepo,
      tournamentPointsRepo: undefined as never,
      matchRepo: undefined as never,
      ticketRepo: undefined as never,
      userRepo: undefined as never,
      auditLogRepo: auditRepo,
    });

    const uc = new ArchiveTournamentUseCase(
      tournamentRepo,
      auditRepo,
      DEFAULT_SYSTEM_CONFIG,
      uow,
    );
    const result = await uc.execute('admin-1', 1);

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(result.status).toBe('archived');
    expect(result.nextTournament.name).toBe('Torneo 2');
  });
});
