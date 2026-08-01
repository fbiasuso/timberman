import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import { Tournament } from '../../domain/entities/tournament.js';
import type { SystemConfig } from '../../domain/entities/system-config.js';

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
 *
 * The commission is informational only: it defaults to the live
 * system-config rate and MUST NOT feed pozo calculation (the close
 * flow reads the system config directly).
 */
export class CreateTournamentUseCase {
  constructor(
    private readonly tournamentRepo: TournamentRepo,
    private readonly config: SystemConfig,
  ) {}

  async execute(input: CreateTournamentInput): Promise<TournamentDTO> {
    const tournament = Tournament.new({
      id: 0,
      name: input.name,
      commission: input.commission ?? this.config.commission,
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
