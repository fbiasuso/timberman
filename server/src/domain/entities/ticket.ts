import type { TicketPrediction } from './ticket-prediction.js';
import { Money } from '../value-objects/money.js';

export interface TicketSnapshot {
  id: number;
  userId: string;
  matchDateId: number;
  betAmount: number; // cents
  prizeWon: number | null; // cents — set when results are published
  createdAt: Date;
}

export class Ticket {
  private constructor(
    public readonly id: number,
    public readonly userId: string,
    public readonly matchDateId: number,
    private readonly _betAmount: number,
    private readonly _prizeWon: number | null,
    public readonly createdAt: Date,
    public readonly predictions: TicketPrediction[],
  ) {}

  /** Get bet amount as Money */
  get betAmount(): Money {
    return Money.fromCents(this._betAmount);
  }

  /** Prize won in cents, or null when results have not been published */
  get prizeWon(): number | null {
    return this._prizeWon;
  }

  // ── Behavior ─────────────────────────────────────────────────

  totalPredictions(): number {
    return this.predictions.length;
  }

  /** Set the prize won — returns a NEW Ticket instance (immutable) */
  withPrize(prizeCents: number): Ticket {
    return new Ticket(
      this.id,
      this.userId,
      this.matchDateId,
      this._betAmount,
      prizeCents,
      this.createdAt,
      this.predictions,
    );
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TicketSnapshot, predictions: TicketPrediction[]): Ticket {
    return new Ticket(
      snapshot.id,
      snapshot.userId,
      snapshot.matchDateId,
      snapshot.betAmount,
      snapshot.prizeWon,
      snapshot.createdAt,
      predictions,
    );
  }

  static new(props: {
    id: number;
    userId: string;
    matchDateId: number;
    betAmount: number;
    predictions: TicketPrediction[];
  }): Ticket {
    return new Ticket(
      props.id,
      props.userId,
      props.matchDateId,
      props.betAmount,
      null,
      new Date(),
      props.predictions,
    );
  }

  toSnapshot(): TicketSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      matchDateId: this.matchDateId,
      betAmount: this._betAmount,
      prizeWon: this._prizeWon,
      createdAt: this.createdAt,
    };
  }
}
