import { describe, it, expect, vi, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
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

// ── Helpers ────────────────────────────────────────────────────────

function createMockServices() {
  const userRepo: UserRepo = {
    findById: vi.fn(),
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
    save: vi.fn(),
    update: vi.fn(),
    findMatchDateById: vi.fn(),
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
    userRepo, tournamentRepo, matchRepo, ticketRepo, auditLogRepo, configRepo,
    jwtService, bcryptService, config,
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

  describe('GET /api/ranking/users/:userId', () => {
    it('returns user detail for a non-admin authenticated user', async () => {
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'user-1',
        role: 'user',
        username: 'testuser',
      });
      vi.mocked(services.userRepo.findById).mockResolvedValue({ id: 'user-1' } as any);

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
      vi.mocked(services.ticketRepo.findByUserId).mockResolvedValue([ticket]);

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
      expect(body.userDetail).toEqual([
        { dateNumber: 3, points: 1, totalMatches: 2, correctPredictions: 1 },
      ]);
    });

    it('returns 404 for an unknown userId', async () => {
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
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);
      vi.mocked(services.tournamentRepo.updateMatchDate).mockImplementation(async (md) => md);
      vi.mocked(services.matchRepo.findByMatchDateId).mockResolvedValue(matchesWithResults);
      vi.mocked(services.ticketRepo.findByMatchDateId).mockResolvedValue([ticket]);
      vi.mocked(services.userRepo.findById).mockResolvedValue(
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

      // Winner balance credited 500 + 6000
      const credited = vi.mocked(services.userRepo.update).mock.calls[0][0];
      expect(credited.balance.cents).toBe(6500);
      // Winning ticket prize persisted
      const paidTicket = vi.mocked(services.ticketRepo.update).mock.calls[0][0];
      expect(paidTicket.prizeWon).toBe(6000);
    });

    it('rejects a re-submit with 409 DATE_NOT_CLOSED without credits', async () => {
      vi.clearAllMocks();
      vi.mocked(services.jwtService.verify).mockReturnValue({
        sub: 'admin-1',
        role: 'admin',
        username: 'admin',
      });
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(
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
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(closedDate);
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
      vi.mocked(services.tournamentRepo.findMatchDateById).mockResolvedValue(openDate);
      vi.mocked(services.tournamentRepo.findByIdForUpdate).mockResolvedValue(
        Tournament.new({ id: 1, name: 'Test' }),
      );
      vi.mocked(services.ticketRepo.countByMatchDateId).mockResolvedValue(5);
      vi.mocked(services.userRepo.findById).mockResolvedValue(
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

      // Admin credited with the house cut
      const credited = vi.mocked(services.userRepo.update).mock.calls[0][0];
      expect(credited.balance.cents).toBe(1125);
      // Audit entry written
      expect(services.auditLogRepo.save).toHaveBeenCalledOnce();
      const audit = vi.mocked(services.auditLogRepo.save).mock.calls[0][0];
      expect(audit.action).toBe('commission_payout');
    });
  });
});
