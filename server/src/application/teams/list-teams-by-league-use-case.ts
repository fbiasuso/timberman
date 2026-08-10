import type { TeamRepo } from '../../domain/ports/team-repo.js';
import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import { LeagueNotFoundError } from '../../domain/errors/index.js';
import { toTeamDTO, type TeamDTO } from './dto.js';

/**
 * List teams with a membership in the given league, ordered by name
 * (autocomplete, spec "Team Autocomplete"). Unknown league → 404. Teams
 * without a membership in the league are never returned; a team spanning
 * leagues appears in each of its leagues' lists (M2M).
 */
export class ListTeamsByLeagueUseCase {
  constructor(
    private readonly teamRepo: TeamRepo,
    private readonly leagueRepo: LeagueRepo,
  ) {}

  async execute(leagueId: number): Promise<TeamDTO[]> {
    const league = await this.leagueRepo.findById(leagueId);
    if (!league) throw new LeagueNotFoundError(leagueId);

    const teams = await this.teamRepo.findByLeagueId(leagueId);
    return teams.map(toTeamDTO);
  }
}
