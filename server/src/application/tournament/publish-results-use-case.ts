import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import { PointsCalculator } from './points-calculator.js';
import type { TicketPoints } from './points-calculator.js';
import { MatchDateNotFoundError } from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface PublishResultsResult {
  id: number;
  status: string;
  points: TicketPoints[];
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Publish results for a closed match date.
 *
 * Transitions the date from 'closed' to 'results' status and
 * calculates the points (correct predictions) for each ticket.
 */
export class PublishResultsUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly matchRepo: MatchRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly pointsCalculator: PointsCalculator,
  ) {}

  async execute(matchDateId: number): Promise<PublishResultsResult> {
    // 1. Load match date
    const matchDate = await this.tournamentRepo.findMatchDateById(matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(matchDateId);
    }

    // 2. Transition to results status (domain validation — throws if not closed)
    const withResults = matchDate.publishResults();

    // 3. Load matches (which now have results set by admin)
    const matches = await this.matchRepo.findByMatchDateId(matchDateId);

    // 4. Load all tickets for this date
    const tickets = await this.ticketRepo.findByMatchDateId(matchDateId);

    // 5. Calculate points
    const points = this.pointsCalculator.calculate(matches, tickets);

    // 6. Save updated match date
    const saved = await this.tournamentRepo.updateMatchDate(withResults);

    return {
      id: saved.id,
      status: saved.status,
      points,
    };
  }
}
