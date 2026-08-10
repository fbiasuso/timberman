import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import type { TeamRepo } from '../../domain/ports/team-repo.js';
import { toLeagueDTO, toTeamDTO, type LeagueWithTeamsDTO } from './dto.js';

/**
 * List all leagues ordered by name, each with its member teams (nested, by
 * name). Memberships are grouped in memory from TeamRepo.findAll() — the
 * registry is small and ONE response feeds the Equipos tab and the match-form
 * autocomplete (design D8, spec "League Listing").
 */
export class ListLeaguesUseCase {
  constructor(
    private readonly leagueRepo: LeagueRepo,
    private readonly teamRepo: TeamRepo,
  ) {}

  async execute(): Promise<LeagueWithTeamsDTO[]> {
    const [leagues, teams] = await Promise.all([
      this.leagueRepo.findAll(),
      this.teamRepo.findAll(),
    ]);

    return leagues.map((league) => ({
      ...toLeagueDTO(league),
      // Teams are already ordered by name from the repo; filter preserves order.
      teams: teams
        .filter((team) => team.leagueIds.includes(league.id))
        .map(toTeamDTO),
    }));
  }
}
