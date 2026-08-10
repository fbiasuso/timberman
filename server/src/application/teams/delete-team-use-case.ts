import type { TeamRepo } from '../../domain/ports/team-repo.js';
import {
  TeamNotFoundError,
  TeamReferencedByMatchesError,
} from '../../domain/errors/index.js';

/**
 * Delete a team (admin). Guard: a team referenced by any match is rejected
 * with TeamReferencedByMatchesError (409) — team and referencing matches stay
 * untouched (spec "Team Deletion Guard"). The FK is SET NULL; the pre-check
 * produces the typed 409 (design D2). Memberships are removed by the junction's
 * ON DELETE CASCADE.
 */
export class DeleteTeamUseCase {
  constructor(private readonly teamRepo: TeamRepo) {}

  async execute(teamId: number): Promise<void> {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new TeamNotFoundError(teamId);

    const matchCount = await this.teamRepo.countMatchesReferencing(teamId);
    if (matchCount > 0) throw new TeamReferencedByMatchesError(teamId, matchCount);

    await this.teamRepo.delete(teamId);
  }
}
