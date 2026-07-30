import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import { PozoCalculator } from '../betting/pozo-calculator.js';
import { Money } from '../../domain/value-objects/money.js';
import {
  MatchDateNotFoundError,
  TournamentNotFoundError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CloseDateResult {
  id: number;
  status: string;
  pozo: number;
  ticketCount: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Close a match date for betting and calculate the prize pool.
 *
 * Flow:
 * 1. Find the match date and verify it's open
 * 2. Find the parent tournament for commission rate
 * 3. Count all tickets placed on this date
 * 4. Calculate pozo = (tickets × betAmount) - commission
 * 5. Update and save the match date
 */
export class CloseDateUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly ticketRepo: TicketRepo,
    private readonly pozoCalculator: PozoCalculator,
  ) {}

  async execute(matchDateId: number): Promise<CloseDateResult> {
    // 1. Load match date
    const matchDate = await this.tournamentRepo.findMatchDateById(matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(matchDateId);
    }

    // 2. Close it (domain transition — throws if not open)
    const closed = matchDate.close();

    // 3. Find tournament for commission rate
    const tournament = await this.tournamentRepo.findById(closed.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(closed.tournamentId);
    }

    // 4. Count tickets placed on this date
    const ticketCount = await this.ticketRepo.countByMatchDateId(matchDateId);

    // 5. Calculate pozo
    const pozo = this.pozoCalculator.calculate(
      ticketCount,
      closed.betAmount,
      tournament.commission,
    );

    // 6. Update match date with pozo
    const updated = closed.withPozo(pozo);
    const saved = await this.tournamentRepo.updateMatchDate(updated);
    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      status: snap.status,
      pozo: snap.pozo,
      ticketCount,
    };
  }
}
