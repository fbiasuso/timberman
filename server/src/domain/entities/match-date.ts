import { Money } from '../value-objects/money.js';

export type MatchDateStatus = 'open' | 'closed' | 'results';

export interface MatchDateSnapshot {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: MatchDateStatus;
  pozo: number; // cents
  betAmount: number; // cents
  createdAt: Date;
}

export class MatchDate {
  private constructor(
    public readonly id: number,
    public readonly tournamentId: number,
    public readonly dateNumber: number,
    private readonly _status: MatchDateStatus,
    private readonly _pozo: number, // cents
    private readonly _betAmount: number, // cents
    public readonly createdAt: Date,
  ) {}

  get status(): MatchDateStatus {
    return this._status;
  }

  /** Get pozo as Money */
  get pozo(): Money {
    return Money.fromCents(this._pozo);
  }

  /** Get bet amount as Money */
  get betAmount(): Money {
    return Money.fromCents(this._betAmount);
  }

  // ── Behavior ─────────────────────────────────────────────────

  isOpen(): boolean {
    return this._status === 'open';
  }

  isClosed(): boolean {
    return this._status === 'closed';
  }

  hasResults(): boolean {
    return this._status === 'results';
  }

  /** Close this date — only open dates can be closed */
  close(): MatchDate {
    if (!this.isOpen()) {
      throw new Error(
        `Cannot close match date ${this.id}: current status is "${this._status}"`,
      );
    }
    return new MatchDate(
      this.id,
      this.tournamentId,
      this.dateNumber,
      'closed',
      this._pozo,
      this._betAmount,
      this.createdAt,
    );
  }

  /** Publish results — only closed dates can transition to results */
  publishResults(): MatchDate {
    if (!this.isClosed()) {
      throw new Error(
        `Cannot publish results for match date ${this.id}: current status is "${this._status}"`,
      );
    }
    return new MatchDate(
      this.id,
      this.tournamentId,
      this.dateNumber,
      'results',
      this._pozo,
      this._betAmount,
      this.createdAt,
    );
  }

  /** Update pozo amount */
  withPozo(pozo: Money): MatchDate {
    return new MatchDate(
      this.id,
      this.tournamentId,
      this.dateNumber,
      this._status,
      pozo.cents,
      this._betAmount,
      this.createdAt,
    );
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: MatchDateSnapshot): MatchDate {
    return new MatchDate(
      snapshot.id,
      snapshot.tournamentId,
      snapshot.dateNumber,
      snapshot.status,
      snapshot.pozo,
      snapshot.betAmount,
      snapshot.createdAt,
    );
  }

  static new(props: {
    id: number;
    tournamentId: number;
    dateNumber: number;
    betAmount?: number;
  }): MatchDate {
    return new MatchDate(
      props.id,
      props.tournamentId,
      props.dateNumber,
      'open',
      0,
      props.betAmount ?? 1500,
      new Date(),
    );
  }

  toSnapshot(): MatchDateSnapshot {
    return {
      id: this.id,
      tournamentId: this.tournamentId,
      dateNumber: this.dateNumber,
      status: this._status,
      pozo: this._pozo,
      betAmount: this._betAmount,
      createdAt: this.createdAt,
    };
  }
}
