import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { AuditLogRepo } from '../../../domain/ports/audit-log-repo.js';
import type { SystemConfigRepo } from '../../../domain/ports/system-config-repo.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import type { BcryptServiceImpl } from '../../auth/bcrypt-service.js';
import type { SystemConfig } from '../../../domain/entities/system-config.js';
import { ListUsersUseCase } from '../../../application/admin/list-users-use-case.js';
import { CreateUserUseCase } from '../../../application/admin/create-user-use-case.js';
import { AdjustBalanceUseCase } from '../../../application/admin/adjust-balance-use-case.js';
import { DeleteUserUseCase } from '../../../application/admin/delete-user-use-case.js';
import { GetConfigUseCase } from '../../../application/admin/get-config-use-case.js';
import { UpdateConfigUseCase } from '../../../application/admin/update-config-use-case.js';
import { ListTournamentsUseCase } from '../../../application/admin/list-tournaments-use-case.js';
import { CreateTournamentUseCase } from '../../../application/admin/create-tournament-use-case.js';
import { SetMatchResultUseCase } from '../../../application/admin/set-match-result-use-case.js';
import { PointsCalculator } from '../../../application/tournament/points-calculator.js';
import { CloseDateUseCase } from '../../../application/tournament/close-date-use-case.js';
import { PozoCalculator } from '../../../application/betting/pozo-calculator.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';
import { createAdminMiddleware } from '../middlewares/admin-middleware.js';

// ── Validation Schemas ────────────────────────────────────────────

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  balance: z.number().int().min(0).optional(),
});

const adjustBalanceSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(500),
});

const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  commission: z.number().min(0).max(100).optional(),
});

const setMatchResultSchema = z.object({
  result: z.enum(['L', 'E', 'V']),
  score: z.string().nullable().optional(),
});

const updateConfigSchema = z.object({
  key: z.enum(['commission', 'allowRegistration', 'defaultBetAmount']),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

// ── Routes ────────────────────────────────────────────────────────

export function createAdminRoutes(
  userRepo: UserRepo,
  tournamentRepo: TournamentRepo,
  matchRepo: MatchRepo,
  ticketRepo: TicketRepo,
  auditLogRepo: AuditLogRepo,
  jwtService: JwtServiceImpl,
  bcryptService: BcryptServiceImpl,
  config: SystemConfig,
  configRepo: SystemConfigRepo,
): FastifyPluginAsync {
  return async (fastify) => {
    const authMiddleware = createAuthMiddleware(jwtService);
    const adminMiddleware = createAdminMiddleware();

    // ── Use Cases ──────────────────────────────────────────────
    const pointsCalculator = new PointsCalculator();
    const listUsersUseCase = new ListUsersUseCase(userRepo, ticketRepo, matchRepo, pointsCalculator);
    const createUserUseCase = new CreateUserUseCase(userRepo, bcryptService);
    const adjustBalanceUseCase = new AdjustBalanceUseCase(userRepo, auditLogRepo);
    const deleteUserUseCase = new DeleteUserUseCase(userRepo);
    const getConfigUseCase = new GetConfigUseCase(config);
    const updateConfigUseCase = new UpdateConfigUseCase(config, configRepo);
    const listTournamentsUseCase = new ListTournamentsUseCase(tournamentRepo);
    const createTournamentUseCase = new CreateTournamentUseCase(tournamentRepo);
    const setMatchResultUseCase = new SetMatchResultUseCase(matchRepo);
    const closeDateUseCase = new CloseDateUseCase(
      tournamentRepo,
      ticketRepo,
      new PozoCalculator(),
    );

    // ── GET /api/admin/users ─────────────────────────────────────
    fastify.get('/api/admin/users', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const users = await listUsersUseCase.execute();
      return { users };
    });

    // ── POST /api/admin/users ────────────────────────────────────
    fastify.post('/api/admin/users', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const user = await createUserUseCase.execute({
        username: body.username,
        password: body.password,
        balance: body.balance,
      });
      return reply.status(201).send({ user });
    });

    // ── PATCH /api/admin/users/:userId/balance ───────────────────
    fastify.patch('/api/admin/users/:userId/balance', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const body = adjustBalanceSchema.parse(request.body);

      const result = await adjustBalanceUseCase.execute({
        userId,
        adminId: request.user!.sub,
        amount: body.amount,
        reason: body.reason,
      });
      return reply.send(result);
    });

    // ── DELETE /api/admin/users/:userId ──────────────────────────
    fastify.delete('/api/admin/users/:userId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { userId } = request.params as { userId: string };
      await deleteUserUseCase.execute(userId);
      return reply.status(204).send();
    });

    // ── GET /api/admin/tournaments ───────────────────────────────
    fastify.get('/api/admin/tournaments', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const tournaments = await listTournamentsUseCase.execute();
      return { tournaments };
    });

    // ── POST /api/admin/tournaments ──────────────────────────────
    fastify.post('/api/admin/tournaments', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = createTournamentSchema.parse(request.body);
      const tournament = await createTournamentUseCase.execute({
        name: body.name,
        commission: body.commission,
      });
      return reply.status(201).send({ tournament });
    });

    // ── PATCH /api/admin/matches/:matchId/result ─────────────────
    fastify.patch('/api/admin/matches/:matchId/result', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { matchId } = request.params as { matchId: string };
      const body = setMatchResultSchema.parse(request.body);

      const result = await setMatchResultUseCase.execute({
        matchId: Number(matchId),
        result: body.result,
        score: body.score ?? null,
      });
      return reply.send({ match: result });
    });

    // ── GET /api/admin/config ────────────────────────────────────
    fastify.get('/api/admin/config', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (_request, _reply) => {
      const conf = getConfigUseCase.execute();
      return { config: conf };
    });

    // ── PATCH /api/admin/config ──────────────────────────────────
    fastify.patch('/api/admin/config', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const body = updateConfigSchema.parse(request.body);
      const conf = await updateConfigUseCase.execute(body.key, body.value);
      return reply.send({ config: conf });
    });

    // ── POST /api/admin/dates/:dateId/close ──────────────────────
    fastify.post('/api/admin/dates/:dateId/close', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { dateId } = request.params as { dateId: string };
      const result = await closeDateUseCase.execute(Number(dateId));
      return reply.send(result);
    });
  };
}
