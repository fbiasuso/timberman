import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { UserRepo } from '../../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../../domain/ports/ticket-repo.js';
import type { UnitOfWork } from '../../../domain/ports/unit-of-work.js';
import { PlaceBetUseCase } from '../../../application/betting/place-bet-use-case.js';
import type { TicketDTO, TicketMatchDTO } from '../../../application/betting/place-bet-use-case.js';
import { sanitizeMatches } from '../../../application/tournament/sanitize-matches.js';
import type { MatchDateStatus } from '../../../domain/entities/match-date.js';
import type { Match } from '../../../domain/entities/match.js';
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

      // Enrich the response the same way as GET — the ticket's date is
      // 'open', so results are nulled but team names are embedded.
      const matchMap = await buildMatchMap(matchRepo, tournamentRepo, [ticket.matchDateId]);
      return reply.status(201).send({ ticket: embedMatches(ticket, matchMap) });
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

      // Embed each prediction's match (team names + sanitized result). The
      // result only leaks on 'results' dates — the same rule sanitizeMatches
      // applies to the history endpoint.
      const matchMap = await buildMatchMap(
        matchRepo,
        tournamentRepo,
        tickets.map((t) => t.matchDateId),
      );

      return { tickets: tickets.map((t) => embedMatches(t, matchMap)) };
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

/** Project a domain Match onto the sanitizer's DTO shape */
function toSanitizableMatch(match: Match): {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  localTeamId: number | null;
  visitorTeamId: number | null;
  scheduledAt: string | null;
  result: string | null;
  score: string | null;
} {
  return {
    id: match.id,
    matchDateId: match.matchDateId,
    localTeam: match.localTeam,
    visitorTeam: match.visitorTeam,
    localImg: match.localImg,
    visitorImg: match.visitorImg,
    localTeamId: match.localTeamId,
    visitorTeamId: match.visitorTeamId,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    result: match.result,
    score: match.score,
  };
}

/**
 * Build a matchId → { localTeam, visitorTeam, result } map for the given
 * dates. Results are sanitized per date status (null unless 'results') —
 * the same sanitizeMatches rule the history endpoint uses, so unpublished
 * results never leak through tickets.
 */
async function buildMatchMap(
  matchRepo: MatchRepo,
  tournamentRepo: TournamentRepo,
  matchDateIds: number[],
): Promise<Map<number, TicketMatchDTO>> {
  const map = new Map<number, TicketMatchDTO>();
  for (const matchDateId of new Set(matchDateIds)) {
    const [matches, matchDate] = await Promise.all([
      matchRepo.findByMatchDateId(matchDateId),
      tournamentRepo.findMatchDateById(matchDateId),
    ]);
    const status: MatchDateStatus = matchDate?.status ?? 'open';
    for (const sanitized of sanitizeMatches(status, matches.map(toSanitizableMatch))) {
      map.set(sanitized.id, {
        localTeam: sanitized.localTeam,
        visitorTeam: sanitized.visitorTeam,
        result: sanitized.result,
      });
    }
  }
  return map;
}

/** Attach the embedded match to each prediction of a DTO */
function embedMatches(
  ticket: TicketDTO,
  matchMap: ReadonlyMap<number, TicketMatchDTO>,
): TicketDTO {
  return {
    ...ticket,
    predictions: ticket.predictions.map((tp) => ({
      ...tp,
      match: matchMap.get(tp.matchId) ?? null,
    })),
  };
}
