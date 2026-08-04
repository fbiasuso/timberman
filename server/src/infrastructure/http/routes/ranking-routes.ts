import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { TournamentPointsRepo } from '../../../domain/ports/tournament-points-repo.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import { GetRankingUseCase } from '../../../application/ranking/get-ranking-use-case.js';
import { GetUserDetailUseCase } from '../../../application/ranking/get-user-detail-use-case.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';

// ── Validation Schemas ────────────────────────────────────────────

const rankingQuerySchema = z.object({
  tournamentId: z.coerce.number().int().positive().optional(),
});

// ── Routes ────────────────────────────────────────────────────────

export function createRankingRoutes(
  userRepo: UserRepo,
  tournamentRepo: TournamentRepo,
  matchRepo: MatchRepo,
  ticketRepo: TicketRepo,
  tournamentPointsRepo: TournamentPointsRepo,
  jwtService: JwtServiceImpl,
): FastifyPluginAsync {
  return async (fastify) => {
    const authMiddleware = createAuthMiddleware(jwtService);
    const getRankingUseCase = new GetRankingUseCase(
      userRepo,
      tournamentRepo,
      tournamentPointsRepo,
    );
    const getUserDetailUseCase = new GetUserDetailUseCase(
      userRepo,
      ticketRepo,
      matchRepo,
      tournamentRepo,
      tournamentPointsRepo,
    );

    // ── GET /api/ranking ─────────────────────────────────────────
    fastify.get('/api/ranking', {
      preHandler: [authMiddleware],
    }, async (request, _reply) => {
      const query = rankingQuerySchema.parse(request.query);
      const ranking = await getRankingUseCase.execute(query.tournamentId);
      return { ranking };
    });

    // ── GET /api/ranking/users/:userId ───────────────────────────
    fastify.get('/api/ranking/users/:userId', {
      preHandler: [authMiddleware],
    }, async (request, _reply) => {
      const { userId } = request.params as { userId: string };
      const query = rankingQuerySchema.parse(request.query);
      const details = await getUserDetailUseCase.execute(userId, query.tournamentId);
      return { userDetail: details };
    });
  };
}
