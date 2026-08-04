import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';
import { UserNotFoundError } from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface UserDateDetail {
  dateNumber: number;
  points: number;
  totalMatches: number;
  correctPredictions: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Returns a per-tournament-date breakdown of a user's performance.
 *
 * The date list and per-date points come from PERSISTED tournament_points
 * rows (written when a date is published — only paid dates have rows), so
 * unpaid dates never contribute. `totalMatches`/`correctPredictions` are
 * recomputed from that date's ticket + matches (same logic as before,
 * restricted to the persisted paid dates).
 *
 * When `tournamentId` is omitted, the ACTIVE tournament is used; when no
 * tournament is active the breakdown is empty.
 */
export class GetUserDetailUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly matchRepo: MatchRepo,
    private readonly tournamentRepo: TournamentRepo,
    private readonly tournamentPointsRepo: TournamentPointsRepo,
  ) {}

  async execute(userId: string, tournamentId?: number): Promise<UserDateDetail[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Resolve the target tournament: explicit id, or the active one
    let resolvedTournamentId = tournamentId;
    if (resolvedTournamentId === undefined) {
      const active = await this.tournamentRepo.findActive();
      if (!active) return [];
      resolvedTournamentId = active.id;
    }

    // Paid dates only — persisted rows exist exactly for published dates
    const rows = await this.tournamentPointsRepo.findByUserAndTournament(
      userId,
      resolvedTournamentId,
    );

    const details: UserDateDetail[] = [];

    for (const row of rows) {
      const md = await this.tournamentRepo.findMatchDateById(row.matchDateId);
      if (!md) continue;

      const ticket = await this.ticketRepo.findByUserAndDate(userId, row.matchDateId);
      const matches = await this.matchRepo.findByMatchDateId(row.matchDateId);

      let correctPredictions = 0;
      let totalMatches = 0;

      if (ticket) {
        for (const match of matches) {
          if (!match.hasResult()) continue;
          totalMatches++;

          const prediction = ticket.predictions.find((p) => p.matchId === match.id);
          if (prediction && match.isCorrect(prediction.prediction)) {
            correctPredictions++;
          }
        }
      }

      details.push({
        dateNumber: md.dateNumber,
        points: row.points,
        totalMatches,
        correctPredictions,
      });
    }

    // Sort by dateNumber descending (most recent first)
    details.sort((a, b) => b.dateNumber - a.dateNumber);

    return details;
  }
}
