import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
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
 * For each ticket the user has, loads the match date and its matches,
 * then counts correct predictions and total matches with results.
 */
export class GetUserDetailUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly matchRepo: MatchRepo,
    private readonly tournamentRepo: TournamentRepo,
  ) {}

  async execute(userId: string): Promise<UserDateDetail[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const tickets = await this.ticketRepo.findByUserId(userId);
    const details: UserDateDetail[] = [];

    for (const ticket of tickets) {
      const md = await this.tournamentRepo.findMatchDateById(ticket.matchDateId);
      if (!md) continue;

      const matches = await this.matchRepo.findByMatchDateId(ticket.matchDateId);

      let correctPredictions = 0;
      let totalMatches = 0;

      for (const match of matches) {
        if (!match.hasResult()) continue;
        totalMatches++;

        const prediction = ticket.predictions.find((p) => p.matchId === match.id);
        if (prediction && match.isCorrect(prediction.prediction)) {
          correctPredictions++;
        }
      }

      details.push({
        dateNumber: md.dateNumber,
        points: correctPredictions,
        totalMatches,
        correctPredictions,
      });
    }

    // Sort by dateNumber descending (most recent first)
    details.sort((a, b) => b.dateNumber - a.dateNumber);

    return details;
  }
}
