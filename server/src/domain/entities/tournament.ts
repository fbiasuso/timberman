import { Commission } from '../value-objects/commission.js';

export interface TournamentSnapshot {
  id: number;
  name: string;
  commission: number; // percentage
  isActive: boolean;
  carryover: number; // cents — unpaid pozo rolled to the next date
  createdAt: Date;
}

export class Tournament {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    private readonly _commission: number,
    public readonly isActive: boolean,
    private readonly _carryover: number,
    public readonly createdAt: Date,
  ) {}

  /** Get commission as a value object */
  get commission(): Commission {
    return Commission.create(this._commission);
  }

  /** Carryover in cents — unpaid pozo accumulated from previous dates */
  get carryover(): number {
    return this._carryover;
  }

  // ── Behavior ─────────────────────────────────────────────────

  activate(): Tournament {
    return new Tournament(this.id, this.name, this._commission, true, this._carryover, this.createdAt);
  }

  deactivate(): Tournament {
    return new Tournament(this.id, this.name, this._commission, false, this._carryover, this.createdAt);
  }

  /** Set the carryover — returns a NEW Tournament instance (immutable) */
  withCarryover(carryoverCents: number): Tournament {
    return new Tournament(this.id, this.name, this._commission, this.isActive, carryoverCents, this.createdAt);
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TournamentSnapshot): Tournament {
    return new Tournament(
      snapshot.id,
      snapshot.name,
      snapshot.commission,
      snapshot.isActive,
      snapshot.carryover,
      snapshot.createdAt,
    );
  }

  static new(props: {
    id: number;
    name: string;
    commission?: number;
    carryover?: number;
  }): Tournament {
    return new Tournament(
      props.id,
      props.name,
      props.commission ?? 15.0,
      true,
      props.carryover ?? 0,
      new Date(),
    );
  }

  toSnapshot(): TournamentSnapshot {
    return {
      id: this.id,
      name: this.name,
      commission: this._commission,
      isActive: this.isActive,
      carryover: this._carryover,
      createdAt: this.createdAt,
    };
  }
}
