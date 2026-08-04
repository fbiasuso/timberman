/**
 * Persisted tournament points and winners (design D2).
 *
 * One `TournamentPoint` row per user+tournament+date, written ONLY when a
 * date transitions to 'results' (publish-results). Ranking reads these rows
 * instead of recomputing from tickets on the fly. Winners are all users tied
 * at the maximum total tournament points at terminate.
 *
 * Rows are plain read-model interfaces (no entity class) — the data-access
 * pattern used by `AuditLogRepo` reads.
 */
export interface TournamentPoint {
  userId: string;
  tournamentId: number;
  matchDateId: number;
  points: number;
}

export interface TournamentPointsRepo {
  /** Persist one row per user+tournament+date. Idempotent — conflicting rows are skipped. */
  savePoints(rows: TournamentPoint[]): Promise<void>;
  findByTournamentId(tournamentId: number): Promise<TournamentPoint[]>;
  findByUserAndTournament(userId: string, tournamentId: number): Promise<TournamentPoint[]>;
  /** Persist winner user IDs for a tournament. Idempotent — duplicates are skipped. */
  saveWinners(tournamentId: number, userIds: string[]): Promise<void>;
  findWinnersByTournamentId(tournamentId: number): Promise<{ userId: string }[]>;
}
