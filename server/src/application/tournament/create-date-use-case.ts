import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { SystemConfig } from '../../domain/entities/system-config.js';
import { MatchDate } from '../../domain/entities/match-date.js';
import { TournamentNotFoundError, OpenDateExistsError } from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateDateInput {
  tournamentId: number;
  betAmount?: number; // cents — overrides the system-config default
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
 * Business rules (tournament-management spec):
 * 1. The date starts in 'open' status so users can place bets; matches are
 *    added separately via the admin match editor.
 * 2. `dateNumber` is auto-computed as `max(existing dateNumber) + 1` — the
 *    admin never picks the number.
 * 3. Only one betting round can be open at a time: creation is rejected
 *    (409 `OpenDateExistsError`) when the tournament already has an 'open'
 *    date.
 * 4. `betAmount` defaults to the system-config value; the optional input
 *    override is preserved for callers that need it.
 */
export class CreateDateUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly config: SystemConfig,
  ) {}

  async execute(input: CreateDateInput): Promise<MatchDateDTO> {
    // Verify tournament exists
    const tournament = await this.tournamentRepo.findById(input.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError(input.tournamentId);
    }

    // Load existing dates: guard the one-open-round rule and compute the
    // next dateNumber from the same read.
    const dates = await this.tournamentRepo.findMatchDatesByTournamentId(input.tournamentId);
    if (dates.some((date) => date.isOpen())) {
      throw new OpenDateExistsError(input.tournamentId);
    }
    const nextDateNumber = dates.reduce((max, date) => Math.max(max, date.dateNumber), 0) + 1;

    // Create the match date
    const matchDate = MatchDate.new({
      id: 0,
      tournamentId: input.tournamentId,
      dateNumber: nextDateNumber,
      betAmount: input.betAmount ?? this.config.defaultBetAmount,
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
