import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import { Match } from '../../domain/entities/match.js';
import {
  MatchDateNotFoundError,
  DateNotOpenError,
  TournamentNotFoundError,
  TournamentNotActiveError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateMatchInput {
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg?: string | null;
  visitorImg?: string | null;
  scheduledAt?: Date | null;
}

export interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  scheduledAt: Date | null;
  result: string | null;
  score: string | null;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Create a new match on a tournament date (admin action).
 *
 * Guards:
 * 1. The parent date must exist (else `MatchDateNotFoundError`, 404)
 * 2. The parent date must be 'open' (else `DateNotOpenError`, 422) — matches
 *    can only be added while the round is open for betting
 * 3. The parent tournament must be ACTIVE (else `TournamentNotActiveError`,
 *    422) — finished/archived tournaments accept no new matches
 *
 * On success: `Match.new` → `matchRepo.save`. The route is responsible for
 * converting the ISO `scheduledAt` string from the request body into a Date.
 */
export class CreateMatchUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly matchRepo: MatchRepo,
  ) {}

  async execute(input: CreateMatchInput): Promise<MatchDTO> {
    // 1. Parent date must exist
    const matchDate = await this.tournamentRepo.findMatchDateById(input.matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(input.matchDateId);
    }

    // 2. Only open dates accept new matches
    if (!matchDate.isOpen()) {
      throw new DateNotOpenError(input.matchDateId, matchDate.status);
    }

    // 3. Lifecycle guard: the tournament backing the date must be active
    const tournament = await this.tournamentRepo.findById(matchDate.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(matchDate.tournamentId);
    }
    if (tournament.status !== 'active') {
      throw new TournamentNotActiveError(tournament.id, tournament.status);
    }

    // 4. Build + persist the match
    const match = Match.new({
      id: 0,
      matchDateId: input.matchDateId,
      localTeam: input.localTeam,
      visitorTeam: input.visitorTeam,
      localImg: input.localImg,
      visitorImg: input.visitorImg,
      scheduledAt: input.scheduledAt,
    });

    const saved = await this.matchRepo.save(match);
    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      matchDateId: snap.matchDateId,
      localTeam: snap.localTeam,
      visitorTeam: snap.visitorTeam,
      localImg: snap.localImg,
      visitorImg: snap.visitorImg,
      scheduledAt: snap.scheduledAt,
      result: snap.result,
      score: snap.score,
      createdAt: snap.createdAt,
    };
  }
}
