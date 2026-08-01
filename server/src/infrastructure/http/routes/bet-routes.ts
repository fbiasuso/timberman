import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { UnitOfWork } from '../../../domain/ports/unit-of-work.js';
import { PlaceBetUseCase } from '../../../application/betting/place-bet-use-case.js';
import type { TicketDTO } from '../../../application/betting/place-bet-use-case.js';
import type { Ticket } from '../../../domain/entities/ticket.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';

// ── Validation Schemas ────────────────────────────────────────────

const predictionSchema = z.record(
  z.string(),
  z.enum(['L', 'E', 'V']),
);

const placeBetSchema = z.object({
  matchDateId: z.number().int().positive(),
  predictions: predictionSchema,
});

const listBetsQuerySchema = z.object({
  matchDateId: z.coerce.number().int().positive().optional(),
});

// ── Routes ────────────────────────────────────────────────────────

export function createBetRoutes(
  userRepo: UserRepo,
  tournamentRepo: TournamentRepo,
  matchRepo: MatchRepo,
  ticketRepo: TicketRepo,
  jwtService: JwtServiceImpl,
  uow?: UnitOfWork,
): FastifyPluginAsync {
  return async (fastify) => {
    const authMiddleware = createAuthMiddleware(jwtService);
    const placeBetUseCase = new PlaceBetUseCase(userRepo, tournamentRepo, matchRepo, ticketRepo, uow);

    /**
     * POST /api/bets
     *
     * Place a bet on an open match date.
     * Body: { matchDateId, predictions: { "matchId": "L"|"E"|"V" } }
     */
    fastify.post('/api/bets', {
      preHandler: [authMiddleware],
    }, async (request, reply) => {
      const body = placeBetSchema.parse(request.body);

      const ticket = await placeBetUseCase.execute({
        userId: request.user!.sub,
        matchDateId: body.matchDateId,
        predictions: body.predictions,
      });

      return reply.status(201).send({ ticket });
    });

    /**
     * GET /api/bets
     *
     * List the authenticated user's tickets.
     * Optional query: ?matchDateId= to filter by date.
     */
    fastify.get('/api/bets', {
      preHandler: [authMiddleware],
    }, async (request, _reply) => {
      const query = listBetsQuerySchema.parse(request.query);

      let tickets: TicketDTO[];

      if (query.matchDateId) {
        const ticket = await ticketRepo.findByUserAndDate(
          request.user!.sub,
          query.matchDateId,
        );
        tickets = ticket ? [toTicketDTO(ticket)] : [];
      } else {
        const allTickets = await ticketRepo.findByUserId(request.user!.sub);
        tickets = allTickets.map(toTicketDTO);
      }

      // Sort by createdAt descending
      tickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { tickets };
    });
  };
}

// ── Helpers ───────────────────────────────────────────────────────

function toTicketDTO(ticket: Ticket): TicketDTO {
  return {
    id: ticket.id,
    userId: ticket.userId,
    matchDateId: ticket.matchDateId,
    betAmount: ticket.betAmount.cents,
    prizeWon: ticket.prizeWon,
    predictions: ticket.predictions.map((tp) => ({
      matchId: tp.matchId,
      prediction: tp.prediction,
    })),
    createdAt: ticket.createdAt,
  };
}
