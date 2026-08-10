export interface TeamSnapshot {
  id: number;
  name: string;
  aliases: string[] | null;
  logo: string | null;
  leagueIds: number[];
  createdAt: Date;
}

/**
 * Immutable team entity — a FLAT registry entry whose league participation is
 * expressed through leagueIds (memberships in the team_leagues junction, design
 * D12: memberships are part of the team aggregate, no separate repo).
 */
export class Team {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly aliases: string[] | null,
    public readonly logo: string | null,
    public readonly leagueIds: number[],
    public readonly createdAt: Date,
  ) {}

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TeamSnapshot): Team {
    return new Team(
      snapshot.id,
      snapshot.name,
      snapshot.aliases,
      snapshot.logo,
      snapshot.leagueIds,
      snapshot.createdAt,
    );
  }

  /**
   * Build a new team. `id` 0 is the sentinel the repo omits on insert.
   * Membership invariants (≥1 league) are enforced by the route zod layer
   * and the use cases — the entity stays a pure immutable data carrier.
   */
  static new(props: {
    id: number;
    name: string;
    aliases?: string[] | null;
    logo?: string | null;
    leagueIds: number[];
  }): Team {
    return new Team(
      props.id,
      props.name,
      props.aliases ?? null,
      props.logo ?? null,
      props.leagueIds,
      new Date(),
    );
  }

  toSnapshot(): TeamSnapshot {
    return {
      id: this.id,
      name: this.name,
      aliases: this.aliases,
      logo: this.logo,
      leagueIds: this.leagueIds,
      createdAt: this.createdAt,
    };
  }
}
