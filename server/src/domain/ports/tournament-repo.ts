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
  findActive(): Promise<Tournament | null>;
  findAll(): Promise<Tournament[]>;
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
  findOpenMatchDates(): Promise<MatchDate[]>;
  saveMatchDate(matchDate: MatchDate): Promise<MatchDate>;
  updateMatchDate(matchDate: MatchDate): Promise<MatchDate>;
}
