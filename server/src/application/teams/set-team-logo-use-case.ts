import type { TeamRepo } from '../../domain/ports/team-repo.js';
import type { ImageService } from '../../domain/ports/image-service.js';
import { Team } from '../../domain/entities/team.js';
import { TeamNotFoundError } from '../../domain/errors/index.js';
import { toTeamDTO, type TeamDTO } from './dto.js';

export interface SetTeamLogoInput {
  teamId: number;
  /** Remote shield URL — downloaded once, validated and stored by the image service. */
  url?: string;
  /** Raw shield bytes from a multipart upload — validated and stored via `storeFromBuffer`. */
  bytes?: Uint8Array;
}

export interface SetTeamLogoResult {
  team: TeamDTO;
  /** false = no change: existing logo (or null) kept, failure logged — never throws. */
  stored: boolean;
}

/**
 * Re-upload a team shield (admin).
 *
 * Flow:
 * 1. Team must exist (else `TeamNotFoundError`, 404)
 * 2. The matching port method runs — `downloadAndStore(url)` for a remote
 *    URL, `storeFromBuffer(bytes)` for a multipart upload — validating (MIME
 *    via magic bytes, 1 MiB cap) and storing under `logos/{teamId}.{ext}`
 * 3. On success the resolved logo is persisted and `{ team, stored: true }`
 *    is returned; on ANY failure the service returns null (never throws) and
 *    the team is returned unchanged with `stored: false` — a failed re-upload
 *    never corrupts an existing logo and never throws (design D3)
 */
export class SetTeamLogoUseCase {
  constructor(
    private readonly teamRepo: TeamRepo,
    private readonly imageService: ImageService,
  ) {}

  async execute(input: SetTeamLogoInput): Promise<SetTeamLogoResult> {
    const team = await this.teamRepo.findById(input.teamId);
    if (!team) throw new TeamNotFoundError(input.teamId);

    const logo =
      input.bytes !== undefined
        ? await this.imageService.storeFromBuffer(input.bytes, input.teamId)
        : await this.imageService.downloadAndStore(input.url!, input.teamId);

    if (!logo || logo === team.logo) return { team: toTeamDTO(team), stored: false };

    const updated = await this.teamRepo.update(Team.create({ ...team.toSnapshot(), logo }));
    return { team: toTeamDTO(updated), stored: true };
  }
}
