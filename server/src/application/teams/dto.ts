import type { League } from '../../domain/entities/league.js';
import type { Team } from '../../domain/entities/team.js';
import type { LeagueFormat } from '../../domain/entities/league.js';

/** API shape of a league. */
export interface LeagueDTO {
  id: number;
  name: string;
  country: string;
  format: LeagueFormat;
  createdAt: Date;
}

/** API shape of a team (memberships included — design D12). */
export interface TeamDTO {
  id: number;
  name: string;
  aliases: string[] | null;
  logo: string | null;
  leagueIds: number[];
  createdAt: Date;
}

/** League listing with nested member teams (design D8 — one query feeds all UIs). */
export interface LeagueWithTeamsDTO extends LeagueDTO {
  teams: TeamDTO[];
}

export function toLeagueDTO(league: League): LeagueDTO {
  const snap = league.toSnapshot();
  return {
    id: snap.id,
    name: snap.name,
    country: snap.country,
    format: snap.format,
    createdAt: snap.createdAt,
  };
}

export function toTeamDTO(team: Team): TeamDTO {
  const snap = team.toSnapshot();
  return {
    id: snap.id,
    name: snap.name,
    aliases: snap.aliases,
    logo: snap.logo,
    leagueIds: snap.leagueIds,
    createdAt: snap.createdAt,
  };
}
