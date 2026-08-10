import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';
import { createAdminMiddleware } from '../middlewares/admin-middleware.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';
import { MatchDateNotFoundError } from '../../../domain/errors/index.js';
import { sanitizeMatches } from '../../../application/tournament/sanitize-matches.js';

// ── DTOs (shape of API responses) ─────────────────────────────────

interface MatchDTO {
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
}

interface MatchDateDTO {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: string;
  pozo: number;
  betAmount: number;
  commission: number; // percent — snapshot taken at close
  carryover: number; // cents — unpaid pozo accumulated in the parent tournament
  createdAt: string;
}

interface CurrentDateResponse {
  matchDate: MatchDateDTO | null;
  matches: MatchDTO[];
  carryover: number; // cents — accumulated pozo from unpaid previous dates
  tournamentName: string;
}

interface DatesResponse {
  dates: MatchDateDTO[];
}

interface DateMatchesResponse {
  matchDate: MatchDateDTO;
  matches: MatchDTO[];
}

const dateParamsSchema = z.object({
  dateId: z.coerce.number().int().positive(),
});

function toMatchDTO(match: any): MatchDTO {
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

function toMatchDateDTO(md: any, carryover: number): MatchDateDTO {
  return {
    id: md.id,
    tournamentId: md.tournamentId,
    dateNumber: md.dateNumber,
    status: md.status,
    pozo: md.pozo,
    betAmount: md.betAmount,
    commission: md.commission,
    carryover,
    createdAt: md.createdAt.toISOString(),
  };
}

// ── Routes ────────────────────────────────────────────────────────

export function createMatchRoutes(
  tournamentRepo: TournamentRepo,
  matchRepo: MatchRepo,
  jwtService: JwtServiceImpl,
): FastifyPluginAsync {
  return async (fastify) => {
    const authMiddleware = createAuthMiddleware(jwtService);
    const adminMiddleware = createAdminMiddleware();

    /**
     * GET /api/matches/current
     *
     * Returns the current open match date of the ACTIVE tournament (if any)
     * with its matches. Used by the cartelera page to display available bets.
     * When no tournament is active, the response is the empty shape.
     */
    fastify.get('/api/matches/current', {
      preHandler: [authMiddleware],
    }, async (_request, _reply) => {
      const active = await tournamentRepo.findActive();
      if (!active) {
        return { matchDate: null, matches: [], carryover: 0, tournamentName: 'Torneo' } satisfies CurrentDateResponse;
      }

      const openDates = await tournamentRepo.findOpenMatchDates(active.id);
      if (openDates.length === 0) {
        return { matchDate: null, matches: [], carryover: 0, tournamentName: 'Torneo' } satisfies CurrentDateResponse;
      }

      // Use the most recent open date
      const current = openDates.reduce((latest, md) =>
        md.createdAt > latest.createdAt ? md : latest,
      );

      const tournament = await tournamentRepo.findById(current.tournamentId);
      const matches = await matchRepo.findByMatchDateId(current.id);
      const snap = current.toSnapshot();

      return {
        matchDate: toMatchDateDTO(snap, tournament?.carryover ?? 0),
        matches: matches.map((m) => toMatchDTO(m.toSnapshot())),
        carryover: tournament?.carryover ?? 0,
        tournamentName: tournament?.name ?? 'Torneo',
      } satisfies CurrentDateResponse;
    });

    /**
     * GET /api/matches/dates
     *
     * Returns all match dates of the ACTIVE tournament only (design D5) —
     * dates of 'finished'/'archived' tournaments never reach the client.
     * When no tournament is active, the response is an empty list.
     */
    fastify.get('/api/matches/dates', {
      preHandler: [authMiddleware],
    }, async (_request, _reply) => {
      // Resolve the active tournament; its dates are the only ones surfaced
      const active = await tournamentRepo.findActive();
      if (!active) {
        return { dates: [] } satisfies DatesResponse;
      }

      const dates = await tournamentRepo.findMatchDatesByTournamentId(active.id);
      const allDates: MatchDateDTO[] = dates.map((md) =>
        toMatchDateDTO(md.toSnapshot(), active.carryover),
      );

      // Sort by dateNumber descending (newest first)
      allDates.sort((a, b) => b.dateNumber - a.dateNumber);

      return { dates: allDates } satisfies DatesResponse;
    });

    /**
     * GET /api/matches/dates/:dateId
     *
     * Returns a SPECIFIC match date (any status) with its matches, admin-only:
     * closed-date results are unpublished, so regular users must not see them.
     *
     * /matches/current only reaches the open date, so an admin could never
     * correct the results of an already-closed date before publishing. This
     * route closes that gap: the admin UI loads a closed date's matches here
     * and fixes them via PATCH /api/admin/matches/:matchId/result.
     */
    fastify.get('/api/matches/dates/:dateId', {
      preHandler: [authMiddleware, adminMiddleware],
    }, async (request, reply) => {
      const { dateId } = dateParamsSchema.parse(request.params);

      const matchDate = await tournamentRepo.findMatchDateById(dateId);
      if (!matchDate) {
        throw new MatchDateNotFoundError(dateId);
      }

      const tournament = await tournamentRepo.findById(matchDate.tournamentId);
      const matches = await matchRepo.findByMatchDateId(dateId);

      return reply.send({
        matchDate: toMatchDateDTO(matchDate.toSnapshot(), tournament?.carryover ?? 0),
        matches: matches.map((m) => toMatchDTO(m.toSnapshot())),
      } satisfies DateMatchesResponse);
    });

    /**
     * GET /api/matches/dates/:dateId/history
     *
     * Returns a SPECIFIC match date (any status) with its matches for ANY
     * authenticated user (admin NOT required). Unpublished results are hidden
     * server-side: on 'closed' dates every match comes back with result/score
     * null; only 'results' dates (published/paid) expose their stored results.
     * Admins get the full picture via the admin-only GET /api/matches/dates/:dateId.
     */
    fastify.get('/api/matches/dates/:dateId/history', {
      preHandler: [authMiddleware],
    }, async (request, reply) => {
      const { dateId } = dateParamsSchema.parse(request.params);

      const matchDate = await tournamentRepo.findMatchDateById(dateId);
      if (!matchDate) {
        throw new MatchDateNotFoundError(dateId);
      }

      const tournament = await tournamentRepo.findById(matchDate.tournamentId);
      const matches = await matchRepo.findByMatchDateId(dateId);

      return reply.send({
        matchDate: toMatchDateDTO(matchDate.toSnapshot(), tournament?.carryover ?? 0),
        matches: sanitizeMatches(
          matchDate.status,
          matches.map((m) => toMatchDTO(m.toSnapshot())),
        ),
      } satisfies DateMatchesResponse);
    });
  };
}
