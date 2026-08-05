import type { Tournament } from '../entities/tournament.js';
import type { MatchDate } from '../entities/match-date.js';

/**
 * Repository port for Tournament aggregate.
 *
 * Covers both Tournament and MatchDate entities since MatchDates belong
 * to a Tournament and are typically loaded together.
 */
export interface TournamentRepo {
  // ── Tournament ─────────────────────────────────────────────
  findById(id: number): Promise<Tournament | null>;
  /**
   * Read a tournament row locking it for update (`SELECT ... FOR UPDATE`).
   * Must only be called inside a transaction — the lock is held until the
   * transaction commits/rolls back, which serializes read-modify-write
   * flows like carryover consumption on date close.
   */
  findByIdForUpdate(id: number): Promise<Tournament | null>;
  /**
   * Resolve the single tournament with status 'active' (lifecycle model —
   * previously `is_active = true`). Returns null when none exists.
   */
  findActive(): Promise<Tournament | null>;
  findAll(): Promise<Tournament[]>;
  /**
   * Atomically create the initial tournament when the table is empty.
   *
   * Uses a Postgres advisory lock to serialize concurrent cold-starts:
   * the second instance waits for the first's transaction, then sees the
   * existing row and does nothing. Returns the created tournament, or null
   * when a tournament already existed (no-op).
   */
  createInitialTournament(tournament: Tournament): Promise<Tournament | null>;
  save(tournament: Tournament): Promise<Tournament>;
  update(tournament: Tournament): Promise<Tournament>;

  // ── MatchDate ──────────────────────────────────────────────
  findMatchDateById(id: number): Promise<MatchDate | null>;
  /**
   * Read a match-date row locking it for update (`SELECT ... FOR UPDATE`).
   * Must only be called inside a transaction — the lock is held until the
   * transaction commits/rolls back, which serializes close/publish flows on
   * the SAME date: a concurrent request blocks here, then reads the committed
   * status and is rejected instead of double-crediting commission or payout.
   */
  findMatchDateByIdForUpdate(id: number): Promise<MatchDate | null>;
  findMatchDatesByTournamentId(tournamentId: number): Promise<MatchDate[]>;
  /**
   * Open match dates of a tournament. When `tournamentId` is provided, only
   * dates belonging to that tournament are returned (active-flow scoping);
   * otherwise all open dates are returned.
   */
  findOpenMatchDates(tournamentId?: number): Promise<MatchDate[]>;
  saveMatchDate(matchDate: MatchDate): Promise<MatchDate>;
  updateMatchDate(matchDate: MatchDate): Promise<MatchDate>;
}
