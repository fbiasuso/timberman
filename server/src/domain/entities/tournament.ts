import { Commission } from '../value-objects/commission.js';
import {
  TournamentNotActiveError,
  TournamentNotFinishedError,
} from '../errors/index.js';

export type TournamentStatus = 'active' | 'finished' | 'archived';

export interface TournamentSnapshot {
  id: number;
  name: string;
  commission: number; // percentage
  status: TournamentStatus;
  finishedAt: Date | null;
  carryover: number; // cents — unpaid pozo rolled to the next date
  createdAt: Date;
}

export class Tournament {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    private readonly _commission: number,
    private readonly _status: TournamentStatus,
    public readonly finishedAt: Date | null,
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

  /** Lifecycle status — 'active' | 'finished' | 'archived' */
  get status(): TournamentStatus {
    return this._status;
  }

  // ── Behavior ─────────────────────────────────────────────────

  /**
   * Terminate an active tournament: transitions to 'finished' and stamps
   * `finishedAt`. Winners are NOT stored on the entity — they are persisted
   * to the `tournament_winners` table by the calling flow (design D1).
   */
  finish(): Tournament {
    if (this._status !== 'active') {
      throw new TournamentNotActiveError(this.id, this._status);
    }
    return new Tournament(
      this.id,
      this.name,
      this._commission,
      'finished',
      new Date(),
      this._carryover,
      this.createdAt,
    );
  }

  /** Archive a finished tournament — hides it from all active flows. */
  archive(): Tournament {
    if (this._status !== 'finished') {
      throw new TournamentNotFinishedError(this.id, this._status);
    }
    return new Tournament(
      this.id,
      this.name,
      this._commission,
      'archived',
      this.finishedAt,
      this._carryover,
      this.createdAt,
    );
  }

  /** Set the carryover — returns a NEW Tournament instance (immutable) */
  withCarryover(carryoverCents: number): Tournament {
    return new Tournament(
      this.id,
      this.name,
      this._commission,
      this._status,
      this.finishedAt,
      carryoverCents,
      this.createdAt,
    );
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TournamentSnapshot): Tournament {
    return new Tournament(
      snapshot.id,
      snapshot.name,
      snapshot.commission,
      snapshot.status,
      snapshot.finishedAt,
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
      'active',
      null,
      props.carryover ?? 0,
      new Date(),
    );
  }

  toSnapshot(): TournamentSnapshot {
    return {
      id: this.id,
      name: this.name,
      commission: this._commission,
      status: this._status,
      finishedAt: this.finishedAt,
      carryover: this._carryover,
      createdAt: this.createdAt,
    };
  }
}
