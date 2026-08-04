import type { FastifyPluginAsync } from 'fastify';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';

// ── DTOs (shape of API responses) ─────────────────────────────────

interface TournamentDTO {
  id: number;
  name: string;
  status: string;
  finishedAt: string | null;
  createdAt: string;
}

// ── Routes ────────────────────────────────────────────────────────

/**
 * Public tournament read endpoints (any authenticated user — NOT admin).
 * Powers the per-tournament ranking selector (design D6); the admin-only
 * tournament list lives under /api/admin/tournaments.
 */
export function createTournamentRoutes(
  tournamentRepo: TournamentRepo,
  jwtService: JwtServiceImpl,
): FastifyPluginAsync {
  return async (fastify) => {
    const authMiddleware = createAuthMiddleware(jwtService);

    /**
     * GET /api/tournaments
     *
     * Returns all tournaments (id, name, status, finishedAt, createdAt) with
     * the ACTIVE tournament first, then the rest ordered by id. RankingPage
     * uses the list to build its tournament selector and mark the active one.
     */
    fastify.get('/api/tournaments', {
      preHandler: [authMiddleware],
    }, async (_request, _reply) => {
      const tournaments = await tournamentRepo.findAll();

      const dtos: TournamentDTO[] = tournaments.map((t) => {
        const snap = t.toSnapshot();
        return {
          id: snap.id,
          name: snap.name,
          status: snap.status,
          finishedAt: snap.finishedAt ? snap.finishedAt.toISOString() : null,
          createdAt: snap.createdAt.toISOString(),
        };
      });

      // Active tournament first, then the rest by id
      dtos.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.id - b.id;
      });

      return { tournaments: dtos };
    });
  };
}
