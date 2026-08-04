import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { TournamentPointsRepo } from '../../domain/ports/tournament-points-repo.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface RankingEntry {
  userId: string;
  username: string;
  totalPoints: number;
  position: number;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Build the per-tournament ranking from PERSISTED tournament points.
 *
 * Points are written to `tournament_points` when a date is published
 * (publish-results), so this use case aggregates those rows instead of
 * recomputing from tickets on the fly (spec ranking-calculation). A user
 * appears only when they have at least one persisted row for the tournament
 * (a row with 0 points still counts — the row is written for every ticket
 * owner, including owners with no correct predictions).
 *
 * When `tournamentId` is omitted, the ACTIVE tournament is used; when no
 * tournament is active the ranking is empty. Results are sorted descending
 * by total points; users with equal points share the same rank position and
 * are ordered deterministically (by username, then userId) — no ticket-count
 * tie-break is applied.
 */
export class GetRankingUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly tournamentRepo: TournamentRepo,
    private readonly tournamentPointsRepo: TournamentPointsRepo,
  ) {}

  async execute(tournamentId?: number): Promise<RankingEntry[]> {
    // Resolve the target tournament: explicit id, or the active one
    let resolvedTournamentId = tournamentId;
    if (resolvedTournamentId === undefined) {
      const active = await this.tournamentRepo.findActive();
      if (!active) return [];
      resolvedTournamentId = active.id;
    }

    const rows = await this.tournamentPointsRepo.findByTournamentId(resolvedTournamentId);

    // Aggregate persisted points per user (rows include 0-point owners)
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.points);
    }

    // User display data (username) still comes from the user repo — one batch
    // read instead of one query per user.
    const users = await this.userRepo.findAll();
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    const entries: Array<{ userId: string; username: string; totalPoints: number }> = [];
    for (const [userId, totalPoints] of totals) {
      entries.push({
        userId,
        username: usernameById.get(userId) ?? 'unknown',
        totalPoints,
      });
    }

    // Sort by totalPoints descending; ties deterministic by username, then userId
    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const byName = a.username.localeCompare(b.username);
      if (byName !== 0) return byName;
      return a.userId.localeCompare(b.userId);
    });

    // Assign positions with ties (same points → same position)
    const result: RankingEntry[] = [];
    let position = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalPoints < entries[i - 1].totalPoints) {
        position = i + 1;
      }
      result.push({
        ...entries[i],
        position,
      });
    }

    return result;
  }
}
