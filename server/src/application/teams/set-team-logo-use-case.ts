import type { TeamRepo } from '../../domain/ports/team-repo.js';
import type { ImageService } from '../../domain/ports/image-service.js';
import { Team } from '../../domain/entities/team.js';
import { TeamNotFoundError } from '../../domain/errors/index.js';
import { toTeamDTO, type TeamDTO } from './dto.js';

export interface SetTeamLogoInput {
  teamId: number;
  /** Remote shield URL — downloaded once, validated and stored by the image service. */
  url: string;
}

/**
 * Re-upload a team shield (admin).
 *
 * Flow:
 * 1. Team must exist (else `TeamNotFoundError`, 404)
 * 2. `imageService.downloadAndStore` downloads, validates (MIME via magic
 *    bytes, 1 MiB cap) and stores under `public/logos/{teamId}.{ext}`
 * 3. On success the relative path is persisted and returned; on ANY failure
 *    the service returns null (never throws) and the team is returned
 *    unchanged — a failed re-upload never corrupts an existing logo
 */
export class SetTeamLogoUseCase {
  constructor(
    private readonly teamRepo: TeamRepo,
    private readonly imageService: ImageService,
  ) {}

  async execute(input: SetTeamLogoInput): Promise<TeamDTO> {
    const team = await this.teamRepo.findById(input.teamId);
    if (!team) throw new TeamNotFoundError(input.teamId);

    const logo = await this.imageService.downloadAndStore(input.url, input.teamId);
    if (!logo || logo === team.logo) return toTeamDTO(team);

    const updated = await this.teamRepo.update(Team.create({ ...team.toSnapshot(), logo }));
    return toTeamDTO(updated);
  }
}
