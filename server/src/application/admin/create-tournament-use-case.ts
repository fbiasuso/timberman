import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { Tournament } from '../../domain/entities/tournament.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateTournamentInput {
  name: string;
  commission?: number;
}

export interface TournamentDTO {
  id: number;
  name: string;
  commission: number;
  isActive: boolean;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Create a new tournament.
 */
export class CreateTournamentUseCase {
  constructor(private readonly tournamentRepo: TournamentRepo) {}

  async execute(input: CreateTournamentInput): Promise<TournamentDTO> {
    const tournament = Tournament.new({
      id: 0,
      name: input.name,
      commission: input.commission,
    });

    const saved = await this.tournamentRepo.save(tournament);
    const snap = saved.toSnapshot();

    return {
      id: snap.id,
      name: snap.name,
      commission: snap.commission,
      isActive: snap.isActive,
      createdAt: snap.createdAt,
    };
  }
}
