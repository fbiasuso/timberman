export type LeagueFormat = 'liga' | 'copa';

export interface LeagueSnapshot {
  id: number;
  name: string;
  country: string;
  format: LeagueFormat;
  createdAt: Date;
}

/**
 * Immutable league entity — a sports league (country + format), independent
 * from betting tournaments. Team participation lives in the team_leagues
 * junction, so this entity carries no team list; aggregation happens in
 * ListLeaguesUseCase (design D8).
 */
export class League {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly country: string,
    public readonly format: LeagueFormat,
    public readonly createdAt: Date,
  ) {}

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: LeagueSnapshot): League {
    return new League(
      snapshot.id,
      snapshot.name,
      snapshot.country,
      snapshot.format,
      snapshot.createdAt,
    );
  }

  /** Build a new league. `id` 0 is the sentinel the repo omits on insert. */
  static new(props: {
    id: number;
    name: string;
    country: string;
    format: LeagueFormat;
  }): League {
    return new League(
      props.id,
      props.name,
      props.country,
      props.format,
      new Date(),
    );
  }

  toSnapshot(): LeagueSnapshot {
    return {
      id: this.id,
      name: this.name,
      country: this.country,
      format: this.format,
      createdAt: this.createdAt,
    };
  }
}
