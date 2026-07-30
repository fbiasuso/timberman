import { Commission } from '../value-objects/commission.js';

export interface TournamentSnapshot {
  id: number;
  name: string;
  commission: number; // percentage
  isActive: boolean;
  createdAt: Date;
}

export class Tournament {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    private readonly _commission: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
  ) {}

  /** Get commission as a value object */
  get commission(): Commission {
    return Commission.create(this._commission);
  }

  // ── Behavior ─────────────────────────────────────────────────

  activate(): Tournament {
    return new Tournament(this.id, this.name, this._commission, true, this.createdAt);
  }

  deactivate(): Tournament {
    return new Tournament(this.id, this.name, this._commission, false, this.createdAt);
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TournamentSnapshot): Tournament {
    return new Tournament(
      snapshot.id,
      snapshot.name,
      snapshot.commission,
      snapshot.isActive,
      snapshot.createdAt,
    );
  }

  static new(props: {
    id: number;
    name: string;
    commission?: number;
  }): Tournament {
    return new Tournament(
      props.id,
      props.name,
      props.commission ?? 15.0,
      true,
      new Date(),
    );
  }

  toSnapshot(): TournamentSnapshot {
    return {
      id: this.id,
      name: this.name,
      commission: this._commission,
      isActive: this.isActive,
      createdAt: this.createdAt,
    };
  }
}
