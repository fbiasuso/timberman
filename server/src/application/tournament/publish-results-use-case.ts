import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import { PointsCalculator } from './points-calculator.js';
import type { TicketPoints } from './points-calculator.js';
import { splitPozo } from './pozo-split.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  MatchDateNotFoundError,
  TournamentNotFoundError,
  UserNotFoundError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface WinnerPayout {
  ticketId: number;
  userId: string;
  prize: number; // cents
}

export interface PublishResultsResult {
  id: number;
  status: string;
  points: TicketPoints[];
  winners: WinnerPayout[];
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Publish results for a closed match date.
 *
 * Transitions the date from 'closed' to 'results' and pays out the pozo:
 * - Winners are the ticket(s) with the maximum correct-prediction count,
 *   only when that maximum is greater than zero. The pozo is split
 *   equally among them (remainder to the first winner by ascending id).
 * - With no correct predictions, the pozo is NOT paid and rolls into the
 *   tournament carryover for the next date.
 *
 * The results transition is persisted FIRST (acts as the idempotency
 * lock — a re-submit hits `publishResults()` on an already-published date
 * and is rejected with DateNotClosedError before any credit is written).
 */
export class PublishResultsUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly matchRepo: MatchRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly pointsCalculator: PointsCalculator,
    private readonly userRepo: UserRepo,
  ) {}

  async execute(matchDateId: number): Promise<PublishResultsResult> {
    // 1. Load match date
    const matchDate = await this.tournamentRepo.findMatchDateById(matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(matchDateId);
    }

    // 2. Transition to results status (domain validation — throws if not closed)
    const withResults = matchDate.publishResults();

    // 3. Persist the transition FIRST: it is the idempotency lock
    const saved = await this.tournamentRepo.updateMatchDate(withResults);

    // 4. Load matches (which now have results set by admin)
    const matches = await this.matchRepo.findByMatchDateId(matchDateId);

    // 5. Load all tickets for this date
    const tickets = await this.ticketRepo.findByMatchDateId(matchDateId);

    // 6. Determine winners: tickets with the max correct count, only when > 0
    const points = this.pointsCalculator.calculate(matches, tickets);
    const maxCorrect = points.reduce((max, p) => Math.max(max, p.correct), 0);
    const winners = maxCorrect > 0
      ? points.filter((p) => p.correct === maxCorrect)
          .sort((a, b) => a.ticketId - b.ticketId)
      : [];

    // 7. Pay winners or roll the pozo into the tournament carryover
    const pozo = matchDate.pozo.cents;
    const payouts: WinnerPayout[] = [];

    if (winners.length > 0) {
      const amounts = splitPozo(pozo, winners.length);
      const ticketById = new Map(tickets.map((t) => [t.id, t]));

      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const prize = amounts[i];

        // Credit the winner's balance
        const user = await this.userRepo.findById(winner.userId);
        if (!user) {
          throw new UserNotFoundError(winner.userId);
        }
        await this.userRepo.update(user.addBalance(Money.fromCents(prize)));

        // Mark the winning ticket with its prize
        const ticket = ticketById.get(winner.ticketId);
        if (ticket) {
          await this.ticketRepo.update(ticket.withPrize(prize));
        }

        payouts.push({ ticketId: winner.ticketId, userId: winner.userId, prize });
      }
    } else {
      // No winners: the pozo is not paid and accumulates for the next date
      const tournament = await this.tournamentRepo.findById(matchDate.tournamentId);
      if (!tournament) {
        throw new TournamentNotFoundError(matchDate.tournamentId);
      }
      await this.tournamentRepo.update(
        tournament.withCarryover(tournament.carryover + pozo),
      );
    }

    return {
      id: saved.id,
      status: saved.status,
      points,
      winners: payouts,
    };
  }
}
