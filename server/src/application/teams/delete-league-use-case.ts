import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import {
  LeagueNotFoundError,
  LeagueHasTeamsError,
} from '../../domain/errors/index.js';

/**
 * Delete a league (admin). Guard: a league that still has team memberships is
 * rejected with LeagueHasTeamsError (409) — league and teams untouched (spec
 * "League Deletion Guard"). The FK RESTRICT is the DB-level backstop; the
 * pre-check produces the typed 409 (design D3).
 */
export class DeleteLeagueUseCase {
  constructor(private readonly leagueRepo: LeagueRepo) {}

  async execute(leagueId: number): Promise<void> {
    const league = await this.leagueRepo.findById(leagueId);
    if (!league) throw new LeagueNotFoundError(leagueId);

    const teamCount = await this.leagueRepo.countTeams(leagueId);
    if (teamCount > 0) throw new LeagueHasTeamsError(leagueId, teamCount);

    await this.leagueRepo.delete(leagueId);
  }
}
