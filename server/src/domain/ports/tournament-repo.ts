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
  findActive(): Promise<Tournament | null>;
  findAll(): Promise<Tournament[]>;
  save(tournament: Tournament): Promise<Tournament>;
  update(tournament: Tournament): Promise<Tournament>;

  // ── MatchDate ──────────────────────────────────────────────
  findMatchDateById(id: number): Promise<MatchDate | null>;
  findMatchDatesByTournamentId(tournamentId: number): Promise<MatchDate[]>;
  findOpenMatchDates(): Promise<MatchDate[]>;
  saveMatchDate(matchDate: MatchDate): Promise<MatchDate>;
  updateMatchDate(matchDate: MatchDate): Promise<MatchDate>;
}
