import type { TeamRepo } from '../../domain/ports/team-repo.js';
import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import type { ImageService } from '../../domain/ports/image-service.js';
import { Team } from '../../domain/entities/team.js';
import {
  LeagueNotFoundError,
  TeamNeedsLeagueError,
} from '../../domain/errors/index.js';
import { toTeamDTO, type TeamDTO } from './dto.js';

export interface CreateTeamInput {
  name: string;
  aliases?: string[] | null;
  /** Remote shield URL — downloaded AFTER insert by the image service (design D5). */
  logoUrl?: string | null;
  leagueIds: number[];
}

/**
 * Create a team (admin) with at least one league membership. Every league id
 * is resolved first (unknown → LeagueNotFoundError 404); team + memberships
 * commit atomically in the repo (design D12). Name collisions under the global
 * normalized key → TeamNameAlreadyExistsError 409 via the repo.
 *
 * The image service is optional: when wired (U4) and a logoUrl is present, the
 * shield is downloaded after insert and the team updated — failures NEVER block
 * creation (the service returns null, logo stays null).
 */
export class CreateTeamUseCase {
  constructor(
    private readonly teamRepo: TeamRepo,
    private readonly leagueRepo: LeagueRepo,
    private readonly imageService?: ImageService,
  ) {}

  async execute(input: CreateTeamInput): Promise<TeamDTO> {
    const leagueIds = [...new Set(input.leagueIds)];
    // A team MUST belong to at least one league (spec "Membership required").
    // The route zod layer rejects empty arrays first; this guard covers any
    // non-route caller (defense in depth, design D4).
    if (leagueIds.length === 0) throw new TeamNeedsLeagueError();
    await this.resolveLeagues(leagueIds);

    const saved = await this.teamRepo.save(
      Team.new({
        id: 0,
        name: input.name,
        aliases: input.aliases ?? null,
        leagueIds,
      }),
    );

    return this.attachLogo(saved, input.logoUrl);
  }

  protected async attachLogo(saved: Team, logoUrl: string | null | undefined): Promise<TeamDTO> {
    if (!this.imageService || !logoUrl) return toTeamDTO(saved);
    const logo = await this.imageService.downloadAndStore(logoUrl, saved.id);
    if (!logo || logo === saved.logo) return toTeamDTO(saved);
    const updated = await this.teamRepo.update(Team.create({ ...saved.toSnapshot(), logo }));
    return toTeamDTO(updated);
  }

  protected async resolveLeagues(leagueIds: number[]): Promise<void> {
    for (const leagueId of leagueIds) {
      const league = await this.leagueRepo.findById(leagueId);
      if (!league) throw new LeagueNotFoundError(leagueId);
    }
  }
}
