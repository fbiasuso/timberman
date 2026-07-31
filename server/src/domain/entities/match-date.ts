import { Money } from '../value-objects/money.js';
import { DateNotClosedError } from '../errors/index.js';

export type MatchDateStatus = 'open' | 'closed' | 'results';

export interface MatchDateSnapshot {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: MatchDateStatus;
  pozo: number; // cents
  betAmount: number; // cents
  commission: number; // percent — snapshotted at close, never recomputed
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
    private readonly _commission: number, // percent
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

  /** Commission percent applied at close (snapshot, never recomputed) */
  get commission(): number {
    return this._commission;
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
      this._commission,
      this.createdAt,
    );
  }

  /** Publish results — only closed dates can transition to results */
  publishResults(): MatchDate {
    if (!this.isClosed()) {
      throw new DateNotClosedError(this.id, this._status);
    }
    return new MatchDate(
      this.id,
      this.tournamentId,
      this.dateNumber,
      'results',
      this._pozo,
      this._betAmount,
      this._commission,
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
      this._commission,
      this.createdAt,
    );
  }

  /** Set the applied commission percent — returns a NEW MatchDate (immutable) */
  withCommission(pct: number): MatchDate {
    return new MatchDate(
      this.id,
      this.tournamentId,
      this.dateNumber,
      this._status,
      this._pozo,
      this._betAmount,
      pct,
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
      snapshot.commission,
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
      0,
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
      commission: this._commission,
      createdAt: this.createdAt,
    };
  }
}
