import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import { League } from '../../domain/entities/league.js';
import type { LeagueFormat } from '../../domain/entities/league.js';
import { LeagueNotFoundError } from '../../domain/errors/index.js';
import { toLeagueDTO, type LeagueDTO } from './dto.js';

export interface UpdateLeagueInput {
  leagueId: number;
  name?: string;
  country?: string;
  format?: LeagueFormat;
}

/**
 * Edit a league's editable fields (partial — `undefined` keeps the current
 * value). Renames respect normalized uniqueness → LeagueNameAlreadyExistsError
 * 409 via the repo. Missing league → LeagueNotFoundError 404.
 */
export class UpdateLeagueUseCase {
  constructor(private readonly leagueRepo: LeagueRepo) {}

  async execute(input: UpdateLeagueInput): Promise<LeagueDTO> {
    const league = await this.leagueRepo.findById(input.leagueId);
    if (!league) throw new LeagueNotFoundError(input.leagueId);

    const updated = League.create({
      ...league.toSnapshot(),
      name: input.name ?? league.name,
      country: input.country ?? league.country,
      format: input.format ?? league.format,
    });

    const saved = await this.leagueRepo.update(updated);
    return toLeagueDTO(saved);
  }
}
