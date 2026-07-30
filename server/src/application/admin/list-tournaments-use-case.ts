import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface AdminTournamentDTO {
  id: number;
  name: string;
  commission: number;
  isActive: boolean;
  createdAt: Date;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Returns all tournaments (admin view).
 */
export class ListTournamentsUseCase {
  constructor(private readonly tournamentRepo: TournamentRepo) {}

  async execute(): Promise<AdminTournamentDTO[]> {
    const tournaments = await this.tournamentRepo.findAll();
    return tournaments.map((t) => {
      const snap = t.toSnapshot();
      return {
        id: snap.id,
        name: snap.name,
        commission: snap.commission,
        isActive: snap.isActive,
        createdAt: snap.createdAt,
      };
    });
  }
}
