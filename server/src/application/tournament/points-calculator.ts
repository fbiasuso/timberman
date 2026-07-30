import type { Match } from '../../domain/entities/match.js';
import type { Ticket } from '../../domain/entities/ticket.js';

/**
 * Points per ticket — number of correct predictions.
 */
export interface TicketPoints {
  ticketId: number;
  userId: string;
  correct: number;
  total: number;
}

/**
 * Calculate how many correct predictions each ticket has.
 *
 * Compares each prediction on a ticket against the actual match result.
 * Matches without a result are excluded from the count.
 *
 * @param matches - All matches for a given match date (with results set)
 * @param tickets - All tickets placed on that date (with predictions loaded)
 * @returns An array of points per ticket, sorted by correct desc
 */
export class PointsCalculator {
  calculate(matches: Match[], tickets: Ticket[]): TicketPoints[] {
    // Build a map from matchId → Match for O(1) lookups
    const matchMap = new Map<number, Match>();
    for (const match of matches) {
      matchMap.set(match.id, match);
    }

    const results: TicketPoints[] = [];

    for (const ticket of tickets) {
      let correct = 0;
      let total = 0;

      for (const prediction of ticket.predictions) {
        const match = matchMap.get(prediction.matchId);
        if (!match || !match.hasResult()) continue;

        total++;
        if (match.isCorrect(prediction.prediction)) {
          correct++;
        }
      }

      results.push({
        ticketId: ticket.id,
        userId: ticket.userId,
        correct,
        total,
      });
    }

    // Sort by correct descending
    results.sort((a, b) => b.correct - a.correct);

    return results;
  }
}
