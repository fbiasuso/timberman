import type { Match } from '../entities/match.js';

/**
 * Repository port for Match entity.
 */
export interface MatchRepo {
  findById(id: number): Promise<Match | null>;
  findByMatchDateId(matchDateId: number): Promise<Match[]>;
  save(match: Match): Promise<Match>;
  update(match: Match): Promise<Match>;
  saveMany(matches: Match[]): Promise<Match[]>;
}
