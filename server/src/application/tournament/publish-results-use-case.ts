import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { UnitOfWork, TransactionRepos } from '../../domain/ports/unit-of-work.js';
import { PointsCalculator } from './points-calculator.js';
import type { TicketPoints } from './points-calculator.js';
import { splitPozo } from './pozo-split.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  MatchDateNotFoundError,
  TournamentNotFoundError,
  UserNotFoundError,
  MatchesNotReadyError,
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
 * Every write (status transition, winner credits, ticket prizes, carryover
 * roll, or points persistence) happens inside ONE database transaction: a
 * failure anywhere rolls everything back, so a mid-flow error can never
 * leave a partially-paid state. The transition is persisted first inside the
 * transaction as the idempotency lock — a re-submit hits
 * `publishResults()` on an already-published date and is rejected with
 * DateNotClosedError before any credit is written.
 */
export class PublishResultsUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly matchRepo: MatchRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly pointsCalculator: PointsCalculator,
    private readonly userRepo: UserRepo,
    private readonly tournamentPointsRepo: TournamentPointsRepo,
    private readonly uow?: UnitOfWork,
  ) {}

  async execute(matchDateId: number): Promise<PublishResultsResult> {
    if (this.uow) {
      return this.uow.withTransaction((repos) =>
        this.publish(matchDateId, repos),
      );
    }
    return this.publish(matchDateId, {
      tournamentRepo: this.tournamentRepo,
      tournamentPointsRepo: this.tournamentPointsRepo,
      matchRepo: this.matchRepo,
      ticketRepo: this.ticketRepo,
      userRepo: this.userRepo,
    });
  }

  private async publish(
    matchDateId: number,
    repos: Pick<
      TransactionRepos,
      | 'tournamentRepo'
      | 'tournamentPointsRepo'
      | 'matchRepo'
      | 'ticketRepo'
      | 'userRepo'
    >,
  ): Promise<PublishResultsResult> {
    const { tournamentRepo, tournamentPointsRepo, matchRepo, ticketRepo, userRepo } = repos;

    // 1. Load match date — row locked FOR UPDATE so a concurrent publish of
    //    the SAME date blocks here, then sees the committed status and is
    //    rejected (409) instead of double-paying out.
    const matchDate = await tournamentRepo.findMatchDateByIdForUpdate(matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(matchDateId);
    }

    // 2. Transition to results status (domain validation — throws if not closed)
    const withResults = matchDate.publishResults();

    // 3. Load matches — every match MUST have its result set (and the date
    //    MUST have at least one match), otherwise the pozo would silently
    //    roll into carryover instead of paying out. Guarded BEFORE any write
    //    so a failed publish leaves the date closed.
    const matches = await matchRepo.findByMatchDateId(matchDateId);
    if (matches.length === 0 || matches.some((match) => !match.hasResult())) {
      throw new MatchesNotReadyError(matchDateId);
    }

    // 4. Persist the transition FIRST among writes: it is the idempotency
    //    lock (a re-submit hits DateNotClosedError before any credit)
    const saved = await tournamentRepo.updateMatchDate(withResults);

    // 5. Load all tickets for this date
    const tickets = await ticketRepo.findByMatchDateId(matchDateId);

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

        // Credit the winner's balance — the row is locked FOR UPDATE
        // (innermost lock level) so a concurrent bet deduction or payout
        // can never clobber this credit.
        const user = await userRepo.findByIdForUpdate(winner.userId);
        if (!user) {
          throw new UserNotFoundError(winner.userId);
        }
        await userRepo.update(user.addBalance(Money.fromCents(prize)));

        // Mark the winning ticket with its prize
        const ticket = ticketById.get(winner.ticketId);
        if (ticket) {
          await ticketRepo.update(ticket.withPrize(prize));
        }

        payouts.push({ ticketId: winner.ticketId, userId: winner.userId, prize });
      }
    } else {
      // No winners: the pozo is not paid and accumulates for the next date.
      // The tournament row is locked FOR UPDATE (same as the close flow) so
      // this read-modify-write cannot race with another concurrent flow.
      const tournament = await tournamentRepo.findByIdForUpdate(matchDate.tournamentId);
      if (!tournament) {
        throw new TournamentNotFoundError(matchDate.tournamentId);
      }
      await tournamentRepo.update(
        tournament.withCarryover(tournament.carryover + pozo),
      );
    }

    // 8. Persist one tournament_points row per ticket owner — INCLUDING
    //    owners with 0 correct predictions (spec prize-payouts: points are
    //    awarded only when a date transitions to 'results'). One ticket per
    //    user per date in this domain, so the calculator's per-ticket
    //    entries map 1:1 to owner rows.
    await tournamentPointsRepo.savePoints(
      points.map((p) => ({
        userId: p.userId,
        tournamentId: matchDate.tournamentId,
        matchDateId,
        points: p.correct,
      })),
    );

    return {
      id: saved.id,
      status: saved.status,
      points,
      winners: payouts,
    };
  }
}
