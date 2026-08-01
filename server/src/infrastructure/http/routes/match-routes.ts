import type { FastifyPluginAsync } from 'fastify';
import type { TournamentRepo } from '../../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../../domain/ports/match-repo.js';
import { createAuthMiddleware } from '../middlewares/auth-middleware.js';
import type { JwtServiceImpl } from '../../auth/jwt-service.js';

// ── DTOs (shape of API responses) ─────────────────────────────────

interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
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
}

interface DatesResponse {
  dates: MatchDateDTO[];
}

function toMatchDTO(match: any): MatchDTO {
  return {
    id: match.id,
    matchDateId: match.matchDateId,
    localTeam: match.localTeam,
    visitorTeam: match.visitorTeam,
    localImg: match.localImg,
    visitorImg: match.visitorImg,
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

    /**
     * GET /api/matches/current
     *
     * Returns the current open match date (if any) with its matches.
     * Used by the cartelera page to display available bets.
     */
    fastify.get('/api/matches/current', {
      preHandler: [authMiddleware],
    }, async (_request, _reply) => {
      const openDates = await tournamentRepo.findOpenMatchDates();
      if (openDates.length === 0) {
        return { matchDate: null, matches: [], carryover: 0 } satisfies CurrentDateResponse;
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
      } satisfies CurrentDateResponse;
    });

    /**
     * GET /api/matches/dates
     *
     * Returns all match dates across all tournaments.
     */
    fastify.get('/api/matches/dates', {
      preHandler: [authMiddleware],
    }, async (_request, _reply) => {
      // Get all tournaments then their dates
      const tournaments = await tournamentRepo.findAll();
      const allDates: MatchDateDTO[] = [];

      for (const t of tournaments) {
        const dates = await tournamentRepo.findMatchDatesByTournamentId(t.id);
        for (const md of dates) {
          allDates.push(toMatchDateDTO(md.toSnapshot(), t.carryover));
        }
      }

      // Sort by dateNumber descending (newest first)
      allDates.sort((a, b) => b.dateNumber - a.dateNumber);

      return { dates: allDates } satisfies DatesResponse;
    });
  };
}
