import type { League } from '../entities/league.js';

/**
 * Repository port for League entities.
 *
 * Memberships (team_leagues rows) are NOT here — they belong to the TeamRepo
 * aggregate (design D12). League reads that need teams either join through
 * TeamRepo.findByLeagueId or group memberships in memory.
 */
export interface LeagueRepo {
  /** All leagues ordered by name (spec "League Listing"). */
  findAll(): Promise<League[]>;
  findById(id: number): Promise<League | null>;
  /** Lookup by normalized name (case-folded, whitespace stripped) — seed idempotency. */
  findByName(name: string): Promise<League | null>;
  /** Insert a new league. Throws LeagueNameAlreadyExistsError on normalized collision. */
  save(league: League): Promise<League>;
  /** Update an existing league. Throws LeagueNotFoundError when the id is missing. */
  update(league: League): Promise<League>;
  /**
   * Delete a league. Throws LeagueNotFoundError when the id is missing.
   * The caller MUST pre-check countTeams — the FK is RESTRICT, so deleting a
   * league that still has memberships fails at the DB level (defensive).
   */
  delete(id: number): Promise<void>;
  /** Number of team memberships referencing the league (delete guard, design D3). */
  countTeams(leagueId: number): Promise<number>;
}
