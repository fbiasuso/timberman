import type { LeagueRepo } from '../../domain/ports/league-repo.js';
import { League } from '../../domain/entities/league.js';
import type { LeagueFormat } from '../../domain/entities/league.js';
import { toLeagueDTO, type LeagueDTO } from './dto.js';

export interface CreateLeagueInput {
  name: string;
  country: string;
  format: LeagueFormat;
}

/**
 * Create a league (admin). Name collisions under the normalized key are mapped
 * by the repo to LeagueNameAlreadyExistsError (409); blank names are rejected
 * by the route zod layer (400).
 */
export class CreateLeagueUseCase {
  constructor(private readonly leagueRepo: LeagueRepo) {}

  async execute(input: CreateLeagueInput): Promise<LeagueDTO> {
    const saved = await this.leagueRepo.save(
      League.new({
        id: 0,
        name: input.name,
        country: input.country,
        format: input.format,
      }),
    );
    return toLeagueDTO(saved);
  }
}
