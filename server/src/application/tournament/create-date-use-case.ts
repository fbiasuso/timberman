import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { TournamentNotFoundError, MatchDateNotFoundError } from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateDateInput {
  tournamentId: number;
  dateNumber: number;
  betAmount?: number;
}

export interface MatchDateDTO {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: string;
  pozo: number;
  betAmount: number;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Create a new match date for a tournament.
 *
 * The match date starts in 'open' status so users can place bets.
 * Matches are added separately via the admin match editor.
 */
export class CreateDateUseCase {
  constructor(private readonly tournamentRepo: TournamentRepo) {}

  async execute(input: CreateDateInput): Promise<MatchDateDTO> {
    // Verify tournament exists
    const tournament = await this.tournamentRepo.findById(input.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(input.tournamentId);
    }

    // Create the match date
    const matchDate = MatchDate.new({
      id: 0,
      tournamentId: input.tournamentId,
      dateNumber: input.dateNumber,
      betAmount: input.betAmount,
    });

    const saved = await this.tournamentRepo.saveMatchDate(matchDate);
    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      tournamentId: snap.tournamentId,
      dateNumber: snap.dateNumber,
      status: snap.status,
      pozo: snap.pozo,
      betAmount: snap.betAmount,
      createdAt: snap.createdAt,
    };
  }
}
