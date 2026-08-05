import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../../domain/ports/tournament-points-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../../domain/ports/audit-log-repo.js';
import type { SystemConfigRepo } from '../../../domain/ports/system-config-repo.js';
import type { SystemConfig } from '../../../domain/entities/system-config.js';
import { createRouter } from '../routes/router.js';
import { errorHandler } from '../middlewares/error-handler.js';
import { Ticket } from '../../../domain/entities/ticket.js';
import { TicketPrediction } from '../../../domain/entities/ticket-prediction.js';
import { Match } from '../../../domain/entities/match.js';
import { MatchDate } from '../../../domain/entities/match-date.js';
import { Tournament } from '../../../domain/entities/tournament.js';
import { User } from '../../../domain/entities/user.js';
import { TournamentNameAlreadyExistsError } from '../../../domain/errors/index.js';

// ── Helpers ────────────────────────────────────────────────────────

function createMockServices() {
  const userRepo: UserRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findByUsername: vi.fn(),
    save: vi.fn((user: any) => Promise.resolve({
      ...user,
      id: 'generated-uuid',
      role: 'user',
      balance: 0,
      createdAt: new Date(),
      toSnapshot: () => ({
        id: 'generated-uuid',
        username: user.username ?? 'testuser',
        passwordHash: user.passwordHash ?? 'hash',
        role: 'user',
        balance: 0,
        createdAt: new Date(),
      }),
    })),
    update: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };

  const tournamentRepo: TournamentRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    createInitialTournament: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
    findMatchDateByIdForUpdate: vi.fn(),
    findMatchDatesByTournamentId: vi.fn(),
    findOpenMatchDates: vi.fn(),
    saveMatchDate: vi.fn(),
    updateMatchDate: vi.fn(),
  };

  const matchRepo: MatchRepo = {
    findById: vi.fn(),
    findByMatchDateId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    saveMany: vi.fn(),
  };

  const ticketRepo: TicketRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByMatchDateId: vi.fn(),
    findByUserAndDate: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    countByMatchDateId: vi.fn(),
  };

  const auditLogRepo: AuditLogRepo = {
    save: vi.fn(),
    findByAdminId: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };

  const tournamentPointsRepo: TournamentPointsRepo = {
    savePoints: vi.fn().mockResolvedValue(undefined),
    findByTournamentId: vi.fn(),
    findByUserAndTournament: vi.fn(),
    saveWinners: vi.fn(),
    findWinnersByTournamentId: vi.fn(),
  };

  const configRepo: SystemConfigRepo = {
    get: vi.fn(),
    upsert: vi.fn(),
  };

  const jwtService = {
    sign: vi.fn(() => 'fake-jwt-token'),
    verify: vi.fn(),
  };

  const bcryptService = {
    hash: vi.fn((pw: string) => Promise.resolve(`hashed-${pw}`)),
    compare: vi.fn(),
  };

  const config: SystemConfig = {
    commission: 15,
    allowRegistration: true,
    defaultBetAmount: 1500,
  };

  return {
    userRepo, tournamentRepo, matchRepo, ticketRepo, auditLogRepo,
    tournamentPointsRepo, configRepo, jwtService, bcryptService, config,
  };
}

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let services: ReturnType<typeof createMockServices>;

  beforeAll(async () => {
    services = createMockServices();
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(createRouter(
      services.userRepo,
      services.tournamentRepo,
      services.matchRepo,
      services.ticketRepo,
      services.jwtService as any,
      services.bcryptService as any,
      services.auditLogRepo,
      services.config,
      services.configRepo,
      services.tournamentPointsRepo,
    ));
    await app.ready();
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 for successful registration', async () => {
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'newuser', password: 'secret123' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.user.username).toBe('newuser');
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 409 for duplicate username', async () => {
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue({ id: 'existing' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'existing', password: 'pass123' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('DUPLICATE_USERNAME');
    });

    it('returns 400 for invalid input (short username)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'ab', password: 'secret123' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('registration live toggle (system config reference)', () => {
    it('blocks registration immediately when the config toggle is flipped', async () => {
      vi.clearAllMocks(); // isolate call-history assertions from earlier tests
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue(null);
      services.config.allowRegistration = false;

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'blockeduser', password: 'secret123' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('REGISTRATION_DISABLED');
      expect(services.userRepo.save).not.toHaveBeenCalled();

      services.config.allowRegistration = true; // restore for other tests
    });

    it('persists config updates and applies them to registration without restart', async () => {
      vi.clearAllMocks(); // isolate call-history assertions from earlier tests
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/config',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { key: 'allowRegistration', value: false },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.config.allowRegistration).toBe(false);
      expect(services.configRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ allowRegistration: false }),
      );

      // The very next registration attempt is rejected — no restart needed.
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue(null);
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'blockeduser', password: 'secret123' },
      });
      expect(regRes.statusCode).toBe(403);
      const regBody = JSON.parse(regRes.body);
      expect(regBody.error).toBe('REGISTRATION_DISABLED');

      services.config.allowRegistration = true; // restore for other tests
    });
  });

  describe('PATCH /api/admin/config — defaultBetAmount propagation', () => {
    const freeDate = MatchDate.create({
      id: 46,
      tournamentId: 1,
      dateNumber: 46,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: 0,
      createdAt: new Date(),
    });
    const ticketedDate = MatchDate.create({
      id: 45,
      tournamentId: 1,
      dateNumber: 45,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: 0,
      createdAt: new Date(),
    });

    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    afterEach(() => {
      // UpdateConfigUseCase publishes to the SHARED config reference — restore
      // the original values so later tests (close, create-date) read 15%/1500.
      services.config.commission = 15;
      services.config.allowRegistration = true;
      services.config.defaultBetAmount = 1500;
    });

    function mockOpenDates(dates: typeof freeDate[]) {
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test' }),
      );
      vi.mocked(services.tournamentRepo.findOpenMatchDates).mockResolvedValue(dates);
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockImplementation(
        async (id) => dates.find((d) => d.id === id) ?? null,
      );
      vi.mocked(services.tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
    }

    it('propagates the new amount to ticket-free open dates and returns the full response shape (200)', async () => {
      vi.clearAllMocks();
      mockAdmin();
      mockOpenDates([freeDate]);
      vi.mocked(services.ticketRepo.countByMatchDateId).mockResolvedValue(0);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/config',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { key: 'defaultBetAmount', value: 500 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.config.defaultBetAmount).toBe(500);
      expect(body.updatedDates).toEqual([{ id: 46, dateNumber: 46, betAmount: 500 }]);
      expect(body.blockedDates).toEqual([]);
      // The persisted date carries the new amount
      const saved = vi.mocked(services.tournamentRepo.updateMatchDate).mock.calls[0][0];
      expect(saved.betAmount.cents).toBe(500);
    });

    it('reports ticketed open dates as blocked in a 200 partial success (never 4xx)', async () => {
      vi.clearAllMocks();
      mockAdmin();
      mockOpenDates([freeDate, ticketedDate]);
      vi.mocked(services.ticketRepo.countByMatchDateId).mockImplementation(async (id) =>
        id === 45 ? 3 : 0,
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/config',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { key: 'defaultBetAmount', value: 500 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.config.defaultBetAmount).toBe(500);
      expect(body.updatedDates).toEqual([{ id: 46, dateNumber: 46, betAmount: 500 }]);
      // Blocked date keeps its current (unchanged) amount — 1500
      expect(body.blockedDates).toEqual([{ id: 45, dateNumber: 45, betAmount: 1500 }]);
      // Only the ticket-free date is persisted — the ticketed one keeps its amount
      expect(services.tournamentRepo.updateMatchDate).toHaveBeenCalledTimes(1);
    });

    it('writes both audit rows for the propagation', async () => {
      vi.clearAllMocks();
      mockAdmin();
      mockOpenDates([freeDate, ticketedDate]);
      vi.mocked(services.ticketRepo.countByMatchDateId).mockImplementation(async (id) =>
        id === 45 ? 3 : 0,
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/config',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { key: 'defaultBetAmount', value: 500 },
      });

      expect(res.statusCode).toBe(200);
      expect(services.auditLogRepo.save).toHaveBeenCalledTimes(2);
      const [configAudit, propagationAudit] = vi
        .mocked(services.auditLogRepo.save)
        .mock.calls.map((c) => c[0]);
      expect(configAudit.action).toBe('default_bet_amount_update');
      expect(configAudit.amount?.cents).toBe(500);
      expect(configAudit.adminId).toBe('admin-1');
      expect(propagationAudit.action).toBe('default_bet_amount_propagation');
      expect(propagationAudit.amount?.cents).toBe(500);
      // The propagation row ALWAYS carries the JSON reason (both keys present)
      expect(JSON.parse(propagationAudit.reason as string)).toEqual({ changed: [46], blocked: [45] });
    });

    it('returns empty propagation arrays for a non-defaultBetAmount key', async () => {
      vi.clearAllMocks();
      mockAdmin();

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/config',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { key: 'commission', value: 20 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.config.commission).toBe(20);
      expect(body.updatedDates).toEqual([]);
      expect(body.blockedDates).toEqual([]);
      // The propagation use case is never invoked for other keys
      expect(services.tournamentRepo.findOpenMatchDates).not.toHaveBeenCalled();
      expect(services.auditLogRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with token for valid credentials', async () => {
      const user = {
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashed-password',
        role: 'user',
        balance: 1000,
        createdAt: new Date(),
        toSnapshot: () => ({
          id: 'user-1',
          username: 'testuser',
          passwordHash: 'hashed-password',
          role: 'user',
          balance: 1000,
          createdAt: new Date(),
        }),
        isAdmin: () => false,
        canDeduct: () => true,
        deductBalance: () => user,
        addBalance: () => user,
      };
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue(user as any);
      vi.mocked(services.bcryptService.compare).mockResolvedValue(true);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'testuser', password: 'correct-password' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe('fake-jwt-token');
      expect(body.user.username).toBe('testuser');
    });

    it('returns 401 for wrong password', async () => {
      const user = {
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashed-password',
        role: 'user',
        balance: 1000,
        createdAt: new Date(),
        toSnapshot: () => ({
          id: 'user-1',
          username: 'testuser',
          passwordHash: 'hashed-password',
          role: 'user',
          balance: 1000,
          createdAt: new Date(),
        }),
        isAdmin: () => false,
        canDeduct: () => true,
        deductBalance: () => user,
        addBalance: () => user,
      };
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue(user as any);
      vi.mocked(services.bcryptService.compare).mockResolvedValue(false);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'testuser', password: 'wrong-password' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for non-existent user', async () => {
      vi.mocked(services.userRepo.findByUsername).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nobody', password: 'anypass' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/ranking', () => {
    function mockUser() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    function mockUsers() {
      vi.mocked(services.userRepo.findAll).mockResolvedValue([
        User.create({
          id: 'user-1', username: 'ana', passwordHash: 'hash', role: 'user',
          balance: 5000, createdAt: new Date(),
        }),
        User.create({
          id: 'user-2', username: 'leo', passwordHash: 'hash', role: 'user',
          balance: 5000, createdAt: new Date(),
        }),
      ]);
    }

    it('defaults to the active tournament and returns persisted points sorted desc', async () => {
      vi.clearAllMocks();
      mockUser();
      mockUsers();
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Torneo 1' }),
      );
      vi.mocked(services.tournamentPointsRepo.findByTournamentId).mockResolvedValue([
        { userId: 'user-1', tournamentId: 1, matchDateId: 10, points: 3 },
        { userId: 'user-2', tournamentId: 1, matchDateId: 10, points: 1 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ranking).toEqual([
        { userId: 'user-1', username: 'ana', totalPoints: 3, position: 1 },
        { userId: 'user-2', username: 'leo', totalPoints: 1, position: 2 },
      ]);
      expect(services.tournamentRepo.findActive).toHaveBeenCalledOnce();
      expect(services.tournamentPointsRepo.findByTournamentId).toHaveBeenCalledWith(1);
    });

    it('scopes to the requested tournamentId without resolving the active one', async () => {
      vi.clearAllMocks();
      mockUser();
      mockUsers();
      vi.mocked(services.tournamentPointsRepo.findByTournamentId).mockResolvedValue([
        { userId: 'user-1', tournamentId: 2, matchDateId: 20, points: 5 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking?tournamentId=2',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ranking).toEqual([
        { userId: 'user-1', username: 'ana', totalPoints: 5, position: 1 },
      ]);
      expect(services.tournamentRepo.findActive).not.toHaveBeenCalled();
      expect(services.tournamentPointsRepo.findByTournamentId).toHaveBeenCalledWith(2);
    });

    it('returns an empty ranking when no tournament is active', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ranking).toEqual([]);
      expect(services.tournamentPointsRepo.findByTournamentId).not.toHaveBeenCalled();
    });

    it('keeps users with 0 persisted points in the ranking', async () => {
      vi.clearAllMocks();
      mockUser();
      mockUsers();
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Torneo 1' }),
      );
      vi.mocked(services.tournamentPointsRepo.findByTournamentId).mockResolvedValue([
        { userId: 'user-1', tournamentId: 1, matchDateId: 10, points: 0 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ranking).toEqual([
        { userId: 'user-1', username: 'ana', totalPoints: 0, position: 1 },
      ]);
    });

    it('returns 401 without a token', async () => {
      vi.clearAllMocks();
      const res = await app.inject({ method: 'GET', url: '/api/ranking' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/ranking/users/:userId', () => {
    it('returns user detail from persisted points for a non-admin authenticated user', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
      vi.mocked(services.userRepo.findById).mockResolvedValue({ id: 'user-1' } as any);
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Torneo 1' }),
      );

      // Persisted row for the paid date — points come from here (2)
      vi.mocked(services.tournamentPointsRepo.findByUserAndTournament).mockResolvedValue([
        { userId: 'user-1', tournamentId: 1, matchDateId: 10, points: 2 },
      ]);

      const ticket = Ticket.new({
        id: 1,
        userId: 'user-1',
        matchDateId: 10,
        betAmount: 1500,
        predictions: [
          TicketPrediction.new({ matchId: 1, prediction: 'L' }),
          TicketPrediction.new({ matchId: 2, prediction: 'V' }),
        ],
      });
      vi.mocked(services.ticketRepo.findByUserAndDate).mockResolvedValue(ticket);

      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(
        MatchDate.create({
          id: 10,
          tournamentId: 1,
          dateNumber: 3,
          status: 'results' as const,
          pozo: 5000,
          betAmount: 1500,
          commission: 0,
          createdAt: new Date(),
        }),
      );

      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([
        Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '1-0'),
        Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('E', '1-1'),
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking/users/user-1',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // points come from the persisted row (2); details recomputed (1 correct of 2)
      expect(body.userDetail).toEqual([
        { dateNumber: 3, points: 2, totalMatches: 2, correctPredictions: 1 },
      ]);
      expect(services.tournamentPointsRepo.findByUserAndTournament).toHaveBeenCalledWith('user-1', 1);
    });

    it('supports explicit tournamentId scoping', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
      vi.mocked(services.userRepo.findById).mockResolvedValue({ id: 'user-1' } as any);
      vi.mocked(services.tournamentPointsRepo.findByUserAndTournament).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking/users/user-1?tournamentId=7',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).userDetail).toEqual([]);
      expect(services.tournamentRepo.findActive).not.toHaveBeenCalled();
      expect(services.tournamentPointsRepo.findByUserAndTournament).toHaveBeenCalledWith('user-1', 7);
    });

    it('returns 404 for an unknown userId', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
      vi.mocked(services.userRepo.findById).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/ranking/users/ghost-user',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('USER_NOT_FOUND');
    });
  });

  describe('GET /api/bets — enriched predictions (design T4)', () => {
    function mockAuth() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    function mockResultsDate() {
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(
        MatchDate.create({
          id: 10,
          tournamentId: 1,
          dateNumber: 3,
          status: 'results' as const,
          pozo: 5000,
          betAmount: 1500,
          commission: 0,
          createdAt: new Date(),
        }),
      );
    }

    function mockResultsMatches() {
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([
        Match.new({ id: 1, matchDateId: 10, localTeam: 'River Plate', visitorTeam: 'Boca Juniors' })
          .setResult('L', '2-1'),
        Match.new({ id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente' })
          .setResult('E', '1-1'),
      ]);
    }

    function mockTicket() {
      return Ticket.new({
        id: 1,
        userId: 'user-1',
        matchDateId: 10,
        betAmount: 1500,
        predictions: [
          TicketPrediction.new({ matchId: 1, prediction: 'L' }),
          TicketPrediction.new({ matchId: 2, prediction: 'V' }),
        ],
      });
    }

    it('embeds team names and results for a ticket on a results date', async () => {
      vi.clearAllMocks();
      mockAuth();
      vi.mocked(services.ticketRepo.findByUserId).mockResolvedValue([mockTicket()]);
      mockResultsDate();
      mockResultsMatches();

      const res = await app.inject({
        method: 'GET',
        url: '/api/bets',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tickets).toHaveLength(1);
      expect(body.tickets[0].predictions).toEqual([
        {
          matchId: 1,
          prediction: 'L',
          match: { localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: 'L' },
        },
        {
          matchId: 2,
          prediction: 'V',
          match: { localTeam: 'Racing', visitorTeam: 'Independiente', result: 'E' },
        },
      ]);
    });

    it('nulls results for a ticket on a closed date, keeping team names', async () => {
      vi.clearAllMocks();
      mockAuth();
      vi.mocked(services.ticketRepo.findByUserId).mockResolvedValue([mockTicket()]);
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(
        MatchDate.create({
          id: 10,
          tournamentId: 1,
          dateNumber: 3,
          status: 'closed' as const,
          pozo: 5000,
          betAmount: 1500,
          commission: 0,
          createdAt: new Date(),
        }),
      );
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([
        Match.new({ id: 1, matchDateId: 10, localTeam: 'River Plate', visitorTeam: 'Boca Juniors' })
          .setResult('L', '2-1'),
        Match.new({ id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente' })
          .setResult('E', '1-1'),
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/bets',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tickets[0].predictions).toEqual([
        {
          matchId: 1,
          prediction: 'L',
          match: { localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: null },
        },
        {
          matchId: 2,
          prediction: 'V',
          match: { localTeam: 'Racing', visitorTeam: 'Independiente', result: null },
        },
      ]);
    });

    it('supports the matchDateId filter and still enriches the response', async () => {
      vi.clearAllMocks();
      mockAuth();
      vi.mocked(services.ticketRepo.findByUserAndDate).mockResolvedValue(mockTicket());
      mockResultsDate();
      mockResultsMatches();

      const res = await app.inject({
        method: 'GET',
        url: '/api/bets?matchDateId=10',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(services.ticketRepo.findByUserAndDate).toHaveBeenCalledWith('user-1', 10);
      const body = JSON.parse(res.body);
      expect(body.tickets).toHaveLength(1);
      expect(body.tickets[0].predictions[0].match).toEqual({
        localTeam: 'River Plate',
        visitorTeam: 'Boca Juniors',
        result: 'L',
      });
    });

    it('returns an empty list when the user has no tickets', async () => {
      vi.clearAllMocks();
      mockAuth();
      vi.mocked(services.ticketRepo.findByUserId).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/bets',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).tickets).toEqual([]);
    });
  });

  describe('POST /api/bets — enriched response (design T4)', () => {
    function mockAuth() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    it('returns the created ticket with embedded team names (results null on an open date)', async () => {
      vi.clearAllMocks();
      mockAuth();
      // Open date — place-bet flow (date + match lookups happen inside the use case)
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(
        MatchDate.new({ id: 10, tournamentId: 1, dateNumber: 1 }),
      );
      vi.mocked(services.userRepo.findByIdForUpdate).mockResolvedValue({
        id: 'user-1',
        deductBalance: vi.fn((_amount: number) => ({ id: 'user-1', balance: 0 })),
      } as any);
      vi.mocked(services.ticketRepo.findByUserAndDate).mockResolvedValue(null);
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([
        Match.new({ id: 1, matchDateId: 10, localTeam: 'River Plate', visitorTeam: 'Boca Juniors' }),
      ]);
      vi.mocked(services.ticketRepo.save).mockResolvedValue(
        Ticket.new({
          id: 42,
          userId: 'user-1',
          matchDateId: 10,
          betAmount: 1500,
          predictions: [TicketPrediction.new({ matchId: 1, prediction: 'L' })],
        }),
      );
      vi.mocked(services.userRepo.update).mockResolvedValue({ id: 'user-1', balance: 0 } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/bets',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { matchDateId: 10, predictions: { '1': 'L' } },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.ticket.id).toBe(42);
      expect(body.ticket.predictions).toEqual([
        {
          matchId: 1,
          prediction: 'L',
          match: { localTeam: 'River Plate', visitorTeam: 'Boca Juniors', result: null },
        },
      ]);
    });
  });

  describe('GET /api/tournaments', () => {
    function mockUser() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    it('lists tournaments (active first) for any authenticated user', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findAll).mockResolvedValue([
        Tournament.new({ id: 2, name: 'Torneo 2' }),
        Tournament.create({
          id: 1,
          name: 'Torneo 1',
          commission: 15,
          status: 'archived',
          finishedAt: new Date('2026-01-01'),
          carryover: 0,
          createdAt: new Date('2025-12-01'),
        }),
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/tournaments',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tournaments).toHaveLength(2);
      // Active tournament (id 2) first, archived after
      expect(body.tournaments[0]).toMatchObject({ id: 2, name: 'Torneo 2', status: 'active' });
      expect(body.tournaments[0].finishedAt).toBeNull();
      expect(body.tournaments[0].createdAt).toEqual(expect.any(String));
      expect(body.tournaments[1]).toMatchObject({ id: 1, name: 'Torneo 1', status: 'archived' });
      expect(body.tournaments[1].finishedAt).toEqual(expect.any(String));
    });

    it('returns 401 without a token', async () => {
      vi.clearAllMocks();
      const res = await app.inject({ method: 'GET', url: '/api/tournaments' });
      expect(res.statusCode).toBe(401);
      expect(services.tournamentRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/dates/:dateId/publish-results', () => {
    const closedDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'closed',
      pozo: 6000,
      betAmount: 1500,
      commission: 15,
      createdAt: new Date(),
    });

    const matchesWithResults = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '2-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }).setResult('V', '1-0'),
    ];

    const ticket = Ticket.new({
      id: 1,
      userId: 'user-1',
      matchDateId: 10,
      betAmount: 1500,
      predictions: [
        TicketPrediction.new({ matchId: 1, prediction: 'L' }),
        TicketPrediction.new({ matchId: 2, prediction: 'V' }),
      ],
    });

    it('publishes results from closed status, pays winners, and returns the breakdown', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
      vi.mocked(services.tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue(matchesWithResults);
      vi.mocked(services.ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
      vi.mocked(services.userRepo.findByIdForUpdate).mockResolvedValue(
        User.create({
          id: 'user-1',
          username: 'testuser',
          passwordHash: 'hash',
          role: 'user',
          balance: 500,
          createdAt: new Date(),
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/publish-results',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('results');
      expect(body.winners).toEqual([{ ticketId: 1, userId: 'user-1', prize: 6000 }]);

      // Winner balance credited 500 + 6000 through the FOR UPDATE row lock
      const credited = vi.mocked(services.userRepo.update).mock.calls[0][0];
      expect(credited.balance.cents).toBe(6500);
      expect(services.userRepo.findByIdForUpdate).toHaveBeenCalledWith('user-1');
      expect(services.userRepo.findById).not.toHaveBeenCalled();
      // Winning ticket prize persisted
      const paidTicket = vi.mocked(services.ticketRepo.update).mock.calls[0][0];
      expect(paidTicket.prizeWon).toBe(6000);
      // Points are persisted per ticket owner (ticket 1 = user-1, 2 correct)
      expect(services.tournamentPointsRepo.savePoints).toHaveBeenCalledOnce();
      expect(services.tournamentPointsRepo.savePoints).toHaveBeenCalledWith([
        { userId: 'user-1', tournamentId: 1, matchDateId: 10, points: 2 },
      ]);
    });

    it('rejects a re-submit with 409 DATE_NOT_CLOSED without credits', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(
        MatchDate.create({ ...closedDate.toSnapshot(), status: 'results' }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/publish-results',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('DATE_NOT_CLOSED');
      expect(services.tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
      expect(services.userRepo.update).not.toHaveBeenCalled();
      expect(services.ticketRepo.update).not.toHaveBeenCalled();
    });

    it('rejects with 422 MATCHES_NOT_READY when a match lacks its result', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([
        matchesWithResults[0], // has result
        Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }), // no result
      ]);
      vi.mocked(services.ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/publish-results',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCHES_NOT_READY');
      expect(services.tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
      expect(services.userRepo.update).not.toHaveBeenCalled();
    });

    it('rejects with 422 MATCHES_NOT_READY when the date has no matches', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(closedDate);
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([]); // zero matches
      vi.mocked(services.ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/publish-results',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCHES_NOT_READY');
      // No transition, no carryover roll, no credits
      expect(services.tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
      expect(services.tournamentRepo.update).not.toHaveBeenCalled();
      expect(services.userRepo.update).not.toHaveBeenCalled();
      expect(services.ticketRepo.update).not.toHaveBeenCalled();
    });

    it('returns 403 for non-admin users', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/publish-results',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/admin/dates/:dateId/close', () => {
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

    it('closes the date, credits the closing admin, and writes an audit entry', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(openDate);
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test' }),
      );
      vi.mocked(services.ticketRepo.countByMatchDateId).mockResolvedValue(5);
      vi.mocked(services.userRepo.findByIdForUpdate).mockResolvedValue(
        User.create({
          id: 'admin-1',
          username: 'admin',
          passwordHash: 'hash',
          role: 'admin',
          balance: 0,
          createdAt: new Date(),
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/close',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('closed');
      expect(body.pozo).toBe(6375); // 7500 gross − 1125 commission
      expect(body.commission).toBe(1125);

      // Admin credited with the house cut through the FOR UPDATE row lock
      const credited = vi.mocked(services.userRepo.update).mock.calls[0][0];
      expect(credited.balance.cents).toBe(1125);
      expect(services.userRepo.findByIdForUpdate).toHaveBeenCalledWith('admin-1');
      expect(services.userRepo.findById).not.toHaveBeenCalled();
      // Audit entry written
      expect(services.auditLogRepo.save).toHaveBeenCalledOnce();
      const audit = vi.mocked(services.auditLogRepo.save).mock.calls[0][0];
      expect(audit.action).toBe('commission_payout');
    });

    it('rejects a double-close with 409 MATCH_DATE_NOT_OPEN without credits', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      // A second close arrives when the date is already closed
      vi.mocked(services.tournamentRepo.findMatchDateByIdForUpdate).mockResolvedValue(
        MatchDate.create({ ...openDate.toSnapshot(), status: 'closed' }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates/10/close',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCH_DATE_NOT_OPEN');
      // No transition, no carryover reset, no commission credit
      expect(services.tournamentRepo.updateMatchDate).not.toHaveBeenCalled();
      expect(services.tournamentRepo.update).not.toHaveBeenCalled();
      expect(services.userRepo.update).not.toHaveBeenCalled();
      expect(services.auditLogRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/users/:userId/balance', () => {
    it('adjusts the balance through the FOR UPDATE row lock and audits it', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.userRepo.findByIdForUpdate).mockResolvedValue(
        User.create({
          id: 'user-1',
          username: 'testuser',
          passwordHash: 'hash',
          role: 'user',
          balance: 1000,
          createdAt: new Date(),
        }),
      );
      vi.mocked(services.userRepo.update).mockImplementation(async (u: any) => u);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/users/user-1/balance',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { amount: 500, reason: 'Bonus' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.userId).toBe('user-1');
      expect(body.previousBalance).toBe(1000);
      expect(body.newBalance).toBe(1500);

      // Balance read goes through the FOR UPDATE lock, never the plain read
      expect(services.userRepo.findByIdForUpdate).toHaveBeenCalledWith('user-1');
      expect(services.userRepo.findById).not.toHaveBeenCalled();
      // Audit entry written
      expect(services.auditLogRepo.save).toHaveBeenCalledOnce();
      const audit = vi.mocked(services.auditLogRepo.save).mock.calls[0][0];
      expect(audit.action).toBe('BALANCE_ADJUSTMENT_ADD');
    });
  });

  describe('GET /api/matches/dates/:dateId', () => {
    const closedDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'closed',
      pozo: 6000,
      betAmount: 1500,
      commission: 15,
      createdAt: new Date(),
    });

    const matches = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'A', visitorTeam: 'B' }).setResult('L', '2-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'C', visitorTeam: 'D' }),
    ];

    it('returns a specific closed date with its matches for an admin', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test', carryover: 500 }),
      );
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue(matches);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/10',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.matchDate).toMatchObject({ id: 10, status: 'closed' });
      expect(body.matchDate.carryover).toBe(500);
      expect(body.matches).toHaveLength(2);
      expect(body.matches[0]).toMatchObject({ id: 1, result: 'L', score: '2-0' });
      expect(body.matches[1]).toMatchObject({ id: 2, result: null });
      // The per-date read must NOT go through the FOR UPDATE lock — this is a
      // plain read used by the admin UI, never inside a financial transaction.
      expect(services.tournamentRepo.findMatchDateById).toHaveBeenCalledWith(10);
    });

    it('returns 404 MATCH_DATE_NOT_FOUND for an unknown date', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/999',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCH_DATE_NOT_FOUND');
    });

    it('returns 403 for non-admin users (results are unpublished data)', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/10',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
      expect(services.matchRepo.findByMatchDateId).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/matches/dates — active-tournament scoping (design D5)', () => {
    const activeDate = MatchDate.create({
      id: 1,
      tournamentId: 1,
      dateNumber: 2,
      status: 'results',
      pozo: 5000,
      betAmount: 1500,
      commission: 15,
      createdAt: new Date(),
    });
    const otherDate = MatchDate.create({
      id: 2,
      tournamentId: 2,
      dateNumber: 1,
      status: 'open',
      pozo: 0,
      betAmount: 1500,
      commission: 0,
      createdAt: new Date(),
    });

    function mockUser() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    it('returns ONLY the active tournament dates — open dates of a non-active tournament are excluded', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test', carryover: 300 }),
      );
      // The scoped read returns the active tournament's dates; the mock for
      // the other tournament's id is never invoked by the implementation.
      vi.mocked(services.tournamentRepo.findMatchDatesByTournamentId).mockImplementation(
        async (tournamentId) => (tournamentId === 1 ? [activeDate] : [otherDate]),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.dates).toHaveLength(1);
      expect(body.dates[0]).toMatchObject({ id: 1, tournamentId: 1, dateNumber: 2, carryover: 300 });
      expect(body.dates[0].tournamentId).toBe(1);
      // The query is scoped to the active tournament — no cross-tournament scan
      expect(services.tournamentRepo.findActive).toHaveBeenCalledOnce();
      expect(services.tournamentRepo.findMatchDatesByTournamentId).toHaveBeenCalledWith(1);
      expect(services.tournamentRepo.findMatchDatesByTournamentId).not.toHaveBeenCalledWith(2);
      expect(services.tournamentRepo.findAll).not.toHaveBeenCalled();
    });

    it('returns an empty dates list when no tournament is active', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.dates).toEqual([]);
      expect(services.tournamentRepo.findMatchDatesByTournamentId).not.toHaveBeenCalled();
    });

    it('returns 401 without a token', async () => {
      vi.clearAllMocks();
      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/matches/current — active-tournament scoping (design D3)', () => {
    function mockUser() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    it('returns the null shape when no tournament is active', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/current',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual({
        matchDate: null,
        matches: [],
        carryover: 0,
        tournamentName: 'Torneo',
      });
      expect(services.tournamentRepo.findOpenMatchDates).not.toHaveBeenCalled();
    });

    it('scopes the open-date read to the active tournament', async () => {
      vi.clearAllMocks();
      mockUser();
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
      vi.mocked(services.tournamentRepo.findActive).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test', carryover: 500 }),
      );
      vi.mocked(services.tournamentRepo.findOpenMatchDates).mockResolvedValue([openDate]);
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test', carryover: 500 }),
      );
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/current',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.matchDate).toMatchObject({ id: 10, tournamentId: 1, carryover: 500 });
      expect(body.tournamentName).toBe('Test');
      expect(services.tournamentRepo.findOpenMatchDates).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /api/admin/dates', () => {
    const closedDate = MatchDate.create({
      id: 1,
      tournamentId: 1,
      dateNumber: 1,
      status: 'closed',
      pozo: 5000,
      betAmount: 1500,
      commission: 15,
      createdAt: new Date(),
    });

    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    it('creates the next date with auto dateNumber, open status, pozo 0 and config bet amount (201)', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test', carryover: 500 }),
      );
      vi.mocked(services.tournamentRepo.findMatchDatesByTournamentId).mockResolvedValue([closedDate]);
      vi.mocked(services.tournamentRepo.saveMatchDate).mockImplementation(async (md) =>
        MatchDate.create({ ...md.toSnapshot(), id: 2 }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { tournamentId: 1 },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.matchDate).toMatchObject({
        id: 2,
        tournamentId: 1,
        dateNumber: 2, // max(1) + 1
        status: 'open',
        pozo: 0,
        betAmount: 1500, // from system config
        carryover: 500,
      });
      expect(body.matchDate.createdAt).toEqual(expect.any(String));
      expect(services.tournamentRepo.saveMatchDate).toHaveBeenCalledOnce();
    });

    it('rejects with 403 FORBIDDEN for non-admin users', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { tournamentId: 1 },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
      expect(services.tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
    });

    it('rejects with 409 OPEN_DATE_EXISTS when the tournament already has an open date', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test' }),
      );
      vi.mocked(services.tournamentRepo.findMatchDatesByTournamentId).mockResolvedValue([
        MatchDate.create({ ...closedDate.toSnapshot(), id: 1, status: 'open', pozo: 0 }),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { tournamentId: 1 },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('OPEN_DATE_EXISTS');
      expect(services.tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
    });

    it('rejects with 404 TOURNAMENT_NOT_FOUND for an unknown tournament', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { tournamentId: 999 },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_FOUND');
      expect(services.tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
    });

    it('rejects with 422 TOURNAMENT_NOT_ACTIVE for a finished tournament — no date created', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.create({
          id: 1,
          name: 'Test',
          commission: 15,
          status: 'finished',
          finishedAt: new Date(),
          carryover: 0,
          createdAt: new Date(),
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { tournamentId: 1 },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_ACTIVE');
      expect(services.tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
    });

    it('rejects with 400 VALIDATION_ERROR when tournamentId is missing', async () => {
      vi.clearAllMocks();
      mockAdmin();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/dates',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(services.tournamentRepo.saveMatchDate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/matches', () => {
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

    const closedDate = MatchDate.create({
      ...openDate.toSnapshot(),
      status: 'closed',
      pozo: 5000,
    });

    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    it('creates and persists a match on an open date (201)', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test' }),
      );
      vi.mocked(services.matchRepo.save).mockImplementation(async (m) =>
        Match.create({ ...m.toSnapshot(), id: 1 }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/matches',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: {
          matchDateId: 10,
          localTeam: 'River Plate',
          visitorTeam: 'Boca Juniors',
          localImg: 'river.png',
          scheduledAt: '2026-08-02T20:00:00Z',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.match).toMatchObject({
        id: 1,
        matchDateId: 10,
        localTeam: 'River Plate',
        visitorTeam: 'Boca Juniors',
        localImg: 'river.png',
        scheduledAt: '2026-08-02T20:00:00.000Z',
        result: null,
        score: null,
      });
      expect(services.matchRepo.save).toHaveBeenCalledOnce();
      const saved = vi.mocked(services.matchRepo.save).mock.calls[0][0];
      expect(saved.scheduledAt).toEqual(new Date('2026-08-02T20:00:00Z'));
    });

    it('rejects with 422 DATE_NOT_OPEN when the parent date is closed', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/matches',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { matchDateId: 10, localTeam: 'A', visitorTeam: 'B' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('DATE_NOT_OPEN');
      expect(services.matchRepo.save).not.toHaveBeenCalled();
    });

    it('rejects with 404 MATCH_DATE_NOT_FOUND for an unknown date', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/matches',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { matchDateId: 999, localTeam: 'A', visitorTeam: 'B' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCH_DATE_NOT_FOUND');
      expect(services.matchRepo.save).not.toHaveBeenCalled();
    });

    it('rejects with 422 TOURNAMENT_NOT_ACTIVE when the tournament is finished — no match created', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.create({
          id: 1,
          name: 'Test',
          commission: 15,
          status: 'finished',
          finishedAt: new Date(),
          carryover: 0,
          createdAt: new Date(),
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/matches',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { matchDateId: 10, localTeam: 'A', visitorTeam: 'B' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_ACTIVE');
      expect(services.matchRepo.save).not.toHaveBeenCalled();
    });

    it('rejects with 403 FORBIDDEN for non-admin users', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/matches',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { matchDateId: 10, localTeam: 'A', visitorTeam: 'B' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
      expect(services.matchRepo.save).not.toHaveBeenCalled();
    });

    it('rejects with 400 VALIDATION_ERROR for an invalid scheduledAt', async () => {
      vi.clearAllMocks();
      mockAdmin();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/matches',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: {
          matchDateId: 10,
          localTeam: 'River Plate',
          visitorTeam: 'Boca Juniors',
          scheduledAt: 'not-a-date',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(services.matchRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/matches/:matchId', () => {
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

    const closedDate = MatchDate.create({
      ...openDate.toSnapshot(),
      status: 'closed',
      pozo: 5000,
    });

    const matchWithDetails = Match.create({
      id: 1,
      matchDateId: 10,
      localTeam: 'River Plate',
      visitorTeam: 'Boca Juniors',
      localImg: 'river.png',
      visitorImg: 'boca.png',
      scheduledAt: new Date('2026-08-02T20:00:00Z'),
      result: null,
      score: null,
      createdAt: new Date(),
    });

    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    it('applies a partial details update and returns the match (200)', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.matchRepo.findById).mockResolvedValue(matchWithDetails);
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(services.matchRepo.update).mockImplementation(async (m) => m);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/matches/1',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { visitorTeam: 'Gimnasia' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.match).toMatchObject({
        id: 1,
        localTeam: 'River Plate', // untouched
        visitorTeam: 'Gimnasia', // changed
        localImg: 'river.png',
        scheduledAt: '2026-08-02T20:00:00.000Z',
      });
      expect(services.matchRepo.update).toHaveBeenCalledOnce();
      const saved = vi.mocked(services.matchRepo.update).mock.calls[0][0];
      expect(saved.visitorTeam).toBe('Gimnasia');
    });

    it('rejects with 422 DATE_NOT_OPEN when the parent date is closed', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.matchRepo.findById).mockResolvedValue(matchWithDetails);
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/matches/1',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { localTeam: 'Racing' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('DATE_NOT_OPEN');
      expect(services.matchRepo.update).not.toHaveBeenCalled();
    });

    it('rejects with 404 MATCH_NOT_FOUND for an unknown match', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.matchRepo.findById).mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/matches/999',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { localTeam: 'Racing' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCH_NOT_FOUND');
      expect(services.matchRepo.update).not.toHaveBeenCalled();
    });

    it('rejects with 403 FORBIDDEN for non-admin users', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/matches/1',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { visitorTeam: 'Gimnasia' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('FORBIDDEN');
      expect(services.matchRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/matches/dates/:dateId/history', () => {
    const closedDate = MatchDate.create({
      id: 10,
      tournamentId: 1,
      dateNumber: 1,
      status: 'closed',
      pozo: 6000,
      betAmount: 1500,
      commission: 15,
      createdAt: new Date(),
    });

    const resultsDate = MatchDate.create({
      ...closedDate.toSnapshot(),
      status: 'results',
    });

    const matchesWithResults = [
      Match.new({ id: 1, matchDateId: 10, localTeam: 'River Plate', visitorTeam: 'Boca' })
        .setResult('L', '2-0'),
      Match.new({ id: 2, matchDateId: 10, localTeam: 'Racing', visitorTeam: 'Independiente' })
        .setResult('V', '1-0'),
    ];

    function mockUser() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
    }

    it('returns the date with sanitized matches for a non-admin (closed → result/score null)', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test', carryover: 500 }),
      );
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue(matchesWithResults);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/10/history',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.matchDate).toMatchObject({ id: 10, status: 'closed', carryover: 500 });
      expect(body.matches).toHaveLength(2);
      // Unpublished results are hidden server-side, teams stay visible
      expect(body.matches[0]).toMatchObject({ id: 1, localTeam: 'River Plate', result: null, score: null });
      expect(body.matches[1]).toMatchObject({ id: 2, localTeam: 'Racing', result: null, score: null });
    });

    it('returns full results for a published (results) date', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(resultsDate);
      vi.mocked(services.tournamentRepo.findById).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test' }),
      );
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue(matchesWithResults);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/10/history',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.matchDate.status).toBe('results');
      expect(body.matches).toHaveLength(2);
      expect(body.matches[0]).toMatchObject({ id: 1, result: 'L', score: '2-0' });
      expect(body.matches[1]).toMatchObject({ id: 2, result: 'V', score: '1-0' });
    });

    it('returns 401 UNAUTHORIZED without a token', async () => {
      vi.clearAllMocks();

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/10/history',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('UNAUTHORIZED');
      expect(services.tournamentRepo.findMatchDateById).not.toHaveBeenCalled();
    });

    it('returns 404 MATCH_DATE_NOT_FOUND for an unknown date', async () => {
      vi.clearAllMocks();
      mockUser();
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/matches/dates/999/history',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('MATCH_DATE_NOT_FOUND');
    });
  });

  describe('POST /api/admin/tournaments/:tournamentId/terminate', () => {
    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    it('terminates an active tournament and returns the winners', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Torneo 1' }),
      );
      vi.mocked(services.tournamentRepo.update).mockImplementation(async (t) => t);
      vi.mocked(services.tournamentRepo.findOpenMatchDates).mockResolvedValue([]);
      vi.mocked(services.tournamentPointsRepo.findByTournamentId).mockResolvedValue([
        { userId: 'user-1', tournamentId: 1, matchDateId: 1, points: 12 },
        { userId: 'user-2', tournamentId: 1, matchDateId: 1, points: 12 },
        { userId: 'user-3', tournamentId: 1, matchDateId: 1, points: 5 },
      ]);
      vi.mocked(services.tournamentPointsRepo.saveWinners).mockResolvedValue(undefined);
      vi.mocked(services.userRepo.findAll).mockResolvedValue([
        User.create({
          id: 'user-1',
          username: 'alice',
          passwordHash: 'hash',
          role: 'user',
          balance: 1000,
          createdAt: new Date(),
        }),
        User.create({
          id: 'user-2',
          username: 'bob',
          passwordHash: 'hash',
          role: 'user',
          balance: 1000,
          createdAt: new Date(),
        }),
        User.create({
          id: 'user-3',
          username: 'carol',
          passwordHash: 'hash',
          role: 'user',
          balance: 1000,
          createdAt: new Date(),
        }),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/terminate',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('finished');
      expect(body.finishedAt).toEqual(expect.any(String));
      // Both users tied at the max (12) win; carol (5) does not
      expect(body.winners).toEqual([
        { userId: 'user-1', username: 'alice', points: 12 },
        { userId: 'user-2', username: 'bob', points: 12 },
      ]);
      expect(services.tournamentPointsRepo.saveWinners).toHaveBeenCalledWith(1, [
        'user-1',
        'user-2',
      ]);
      // Audit written for the terminate action
      expect(services.auditLogRepo.save).toHaveBeenCalledOnce();
      const log = vi.mocked(services.auditLogRepo.save).mock.calls[0][0];
      expect(log.action).toBe('tournament_finished');
      expect(log.adminId).toBe('admin-1');
    });

    it('returns 409 TOURNAMENT_OPEN_DATE when a betting round is in flight', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Torneo 1' }),
      );
      vi.mocked(services.tournamentRepo.findOpenMatchDates).mockResolvedValue([
        { id: 5, dateNumber: 1 } as never,
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/terminate',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_OPEN_DATE');
      expect(services.tournamentRepo.update).not.toHaveBeenCalled();
    });

    it('returns 422 TOURNAMENT_NOT_ACTIVE for a finished tournament', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.create({
          id: 1,
          name: 'Torneo 1',
          commission: 15,
          status: 'finished',
          finishedAt: new Date(),
          carryover: 0,
          createdAt: new Date(),
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/terminate',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_ACTIVE');
      expect(services.tournamentRepo.update).not.toHaveBeenCalled();
    });

    it('returns 404 TOURNAMENT_NOT_FOUND for an unknown tournament', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/99/terminate',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_FOUND');
    });

    it('returns 403 for non-admin users', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/terminate',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(403);
      expect(services.tournamentRepo.findByIdForUpdate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/tournaments/:tournamentId/archive', () => {
    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    it('archives a finished tournament and creates the next one', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.create({
          id: 1,
          name: 'Torneo 1',
          commission: 15,
          status: 'finished',
          finishedAt: new Date(),
          carryover: 0,
          createdAt: new Date(),
        }),
      );
      vi.mocked(services.tournamentRepo.update).mockImplementation(async (t) => t);
      vi.mocked(services.tournamentRepo.save).mockImplementation(async (t) =>
        Tournament.create({ ...t.toSnapshot(), id: 2 }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/archive',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual({
        id: 1,
        status: 'archived',
        nextTournament: { id: 2, name: 'Torneo 2', status: 'active' },
      });
      // Archive (update) happens BEFORE the next save (single-active invariant)
      const updateCall = vi.mocked(services.tournamentRepo.update).mock.invocationCallOrder[0];
      const saveCall = vi.mocked(services.tournamentRepo.save).mock.invocationCallOrder[0];
      expect(updateCall).toBeLessThan(saveCall);
      expect(services.auditLogRepo.save).toHaveBeenCalledOnce();
      const log = vi.mocked(services.auditLogRepo.save).mock.calls[0][0];
      expect(log.action).toBe('tournament_archived');
    });

    it('returns 422 TOURNAMENT_NOT_FINISHED for an active tournament', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Torneo 1' }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/archive',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_FINISHED');
      expect(services.tournamentRepo.update).not.toHaveBeenCalled();
      expect(services.tournamentRepo.save).not.toHaveBeenCalled();
    });

    it('returns 404 TOURNAMENT_NOT_FOUND for an unknown tournament', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/99/archive',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NOT_FOUND');
    });

    it('returns 403 for non-admin users', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments/1/archive',
        headers: { authorization: 'Bearer fake-jwt-token' },
      });

      expect(res.statusCode).toBe(403);
      expect(services.tournamentRepo.findByIdForUpdate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/tournaments — unique name (spec)', () => {
    function mockAdmin() {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
    }

    it('creates a tournament with a unique name (201)', async () => {
      vi.clearAllMocks();
      mockAdmin();
      vi.mocked(services.tournamentRepo.save).mockImplementation(async (t) =>
        Tournament.create({ ...t.toSnapshot(), id: 7 }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { name: 'Torneo 2' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.tournament.name).toBe('Torneo 2');
      expect(body.tournament.id).toBe(7);
    });

    it('returns 409 TOURNAMENT_NAME_TAKEN with the fixed Spanish message on a name collision', async () => {
      vi.clearAllMocks();
      mockAdmin();
      // Repo maps the PG 23505 to the typed error; the generic DomainError
      // handler renders the 409 shape (verified here end-to-end at the route).
      vi.mocked(services.tournamentRepo.save).mockRejectedValue(
        new TournamentNameAlreadyExistsError('torneo 1'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/tournaments',
        headers: { authorization: 'Bearer fake-jwt-token' },
        payload: { name: 'torneo 1' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('TOURNAMENT_NAME_TAKEN');
      expect(body.message).toBe('Ya existe un torneo con ese nombre');
    });
  });
});
