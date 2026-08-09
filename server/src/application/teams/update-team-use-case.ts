import type { TeamRepo } from '../../domain/ports/team-repo.js';
import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import type { ImageService } from '../../domain/ports/image-service.js';
import { Team } from '../../domain/entities/team.js';
import {
  TeamNotFoundError,
  TeamNeedsLeagueError,
  LeagueNotFoundError,
} from '../../domain/errors/index.js';
import { toTeamDTO, type TeamDTO } from './dto.js';

export interface UpdateTeamInput {
  teamId: number;
  name?: string;
  aliases?: string[] | null;
  /** Remote shield URL — downloaded by the image service when wired (U4). */
  logoUrl?: string | null;
  leagueIds?: number[];
}

/**
 * Edit a team (admin, partial — `undefined` keeps the current value).
 *
 * Membership rules:
 * - `leagueIds` present → the membership set is REPLACED with the new list.
 * - Removing the last membership (empty final set) → TeamNeedsLeagueError 400,
 *   memberships unchanged (spec "Remove last membership rejected").
 * - Every referenced league id must exist → LeagueNotFoundError 404.
 *
 * Renames respect global normalized uniqueness → TeamNameAlreadyExistsError
 * 409 via the repo.
 */
export class UpdateTeamUseCase {
  constructor(
    private readonly teamRepo: TeamRepo,
    private readonly leagueRepo: LeagueRepo,
    private readonly imageService?: ImageService,
  ) {}

  async execute(input: UpdateTeamInput): Promise<TeamDTO> {
    const team = await this.teamRepo.findById(input.teamId);
    if (!team) throw new TeamNotFoundError(input.teamId);

    const leagueIds = input.leagueIds !== undefined
      ? [...new Set(input.leagueIds)]
      : team.leagueIds;
    if (leagueIds.length === 0) throw new TeamNeedsLeagueError(input.teamId);
    await this.resolveLeagues(leagueIds);

    const updated = Team.create({
      ...team.toSnapshot(),
      name: input.name ?? team.name,
      aliases: input.aliases !== undefined ? input.aliases : team.aliases,
      leagueIds,
    });
    const saved = await this.teamRepo.update(updated);

    return this.attachLogo(saved, input.logoUrl);
  }

  private async attachLogo(saved: Team, logoUrl: string | null | undefined): Promise<TeamDTO> {
    if (!this.imageService || !logoUrl) return toTeamDTO(saved);
    const logo = await this.imageService.downloadAndStore(logoUrl, saved.id);
    if (!logo || logo === saved.logo) return toTeamDTO(saved);
    const withLogo = await this.teamRepo.update(Team.create({ ...saved.toSnapshot(), logo }));
    return toTeamDTO(withLogo);
  }

  private async resolveLeagues(leagueIds: number[]): Promise<void> {
    for (const leagueId of leagueIds) {
      const league = await this.leagueRepo.findById(leagueId);
      if (!league) throw new LeagueNotFoundError(leagueId);
    }
  }
}
