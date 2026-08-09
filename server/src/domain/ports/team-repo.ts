import type { Team } from '../entities/team.js';

/**
 * Repository port for Team aggregates — the team row PLUS its memberships
 * (design D12: memberships have no independent lifecycle, every write is a
 * side effect of team create/edit/delete, so they live inside TeamRepo).
 */
export interface TeamRepo {
  /** All teams (with memberships) ordered by name. */
  findAll(): Promise<Team[]>;
  /** Team by id, including its leagueIds. */
  findById(id: number): Promise<Team | null>;
  /** Teams with a membership in the given league, ordered by name (autocomplete). */
  findByLeagueId(leagueId: number): Promise<Team[]>;
  /** Lookup by GLOBAL normalized name (case-folded, whitespace stripped) — seed idempotency. */
  findByName(name: string): Promise<Team | null>;
  /**
   * Insert the team and its memberships in ONE transaction (atomic — design
   * D12). Throws TeamNameAlreadyExistsError on normalized collision.
   */
  save(team: Team): Promise<Team>;
  /**
   * Update the team row and REPLACE its membership set in ONE transaction.
   * Throws TeamNameAlreadyExistsError on normalized collision (name change)
   * and TeamNotFoundError when the id is missing.
   */
  update(team: Team): Promise<Team>;
  /**
   * Delete the team; the DB CASCADE removes its memberships. Throws
   * TeamNotFoundError when the id is missing. The caller MUST pre-check
   * countMatchesReferencing — matches FKs are SET NULL, so the guard is what
   * produces the typed 409 (design D2).
   */
  delete(id: number): Promise<void>;
  /** Matches referencing the team as local OR visitor (delete guard, design D2). */
  countMatchesReferencing(teamId: number): Promise<number>;
}
