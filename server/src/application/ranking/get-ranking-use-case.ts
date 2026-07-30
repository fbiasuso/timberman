import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { PointsCalculator } from '../tournament/points-calculator.js';
import type { TicketPoints } from '../tournament/points-calculator.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface RankingEntry {
  userId: string;
  username: string;
  totalPoints: number;
  position: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Build a global ranking (or per-tournament) based on correct predictions.
 *
 * For each user, fetches all their tickets, calculates correct predictions
 * per ticket using the PointsCalculator, and aggregates totals.
 * Results are sorted descending by totalPoints with tied positions.
 */
export class GetRankingUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly matchRepo: MatchRepo,
    private readonly tournamentRepo: TournamentRepo,
    private readonly pointsCalculator: PointsCalculator,
  ) {}

  async execute(tournamentId?: number): Promise<RankingEntry[]> {
    const users = await this.userRepo.findAll();
    const entries: Array<{ userId: string; username: string; totalPoints: number }> = [];

    for (const user of users) {
      const tickets = await this.ticketRepo.findByUserId(user.id);
      let totalPoints = 0;

      for (const ticket of tickets) {
        // Optional tournament filter — skip tickets not in the target tournament
        if (tournamentId !== undefined) {
          const md = await this.tournamentRepo.findMatchDateById(ticket.matchDateId);
          if (!md || md.tournamentId !== tournamentId) continue;
        }

        const matches = await this.matchRepo.findByMatchDateId(ticket.matchDateId);
        const points: TicketPoints[] = this.pointsCalculator.calculate(matches, [ticket]);
        if (points.length > 0) {
          totalPoints += points[0].correct;
        }
      }

      entries.push({
        userId: user.id,
        username: user.username,
        totalPoints,
      });
    }

    // Sort by totalPoints descending
    entries.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign positions with ties (same points → same position)
    const result: RankingEntry[] = [];
    let position = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalPoints < entries[i - 1].totalPoints) {
        position = i + 1;
      }
      result.push({
        ...entries[i],
        position,
      });
    }

    return result;
  }
}
