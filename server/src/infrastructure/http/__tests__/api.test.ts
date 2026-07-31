import { describe, it, expect, vi, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../../domain/ports/audit-log-repo.js';
import type { SystemConfig } from '../../../application/admin/get-config-use-case.js';
import { createRouter } from '../routes/router.js';
import { errorHandler } from '../middlewares/error-handler.js';

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
    countByMatchDateId: vi.fn(),
  };

  const auditLogRepo: AuditLogRepo = {
    save: vi.fn(),
    findByAdminId: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
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
      true,
      services.auditLogRepo,
      services.config,
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
});
