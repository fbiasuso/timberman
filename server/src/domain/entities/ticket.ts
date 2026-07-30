import type { TicketPrediction } from './ticket-prediction.js';
import { Money } from '../value-objects/money.js';

export interface TicketSnapshot {
  id: number;
  userId: string;
  matchDateId: number;
  betAmount: number; // cents
  createdAt: Date;
}

export class Ticket {
  private constructor(
    public readonly id: number,
    public readonly userId: string,
    public readonly matchDateId: number,
    private readonly _betAmount: number,
    public readonly createdAt: Date,
    public readonly predictions: TicketPrediction[],
  ) {}

  /** Get bet amount as Money */
  get betAmount(): Money {
    return Money.fromCents(this._betAmount);
  }

  // ── Behavior ─────────────────────────────────────────────────

  totalPredictions(): number {
    return this.predictions.length;
  }

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TicketSnapshot, predictions: TicketPrediction[]): Ticket {
    return new Ticket(
      snapshot.id,
      snapshot.userId,
      snapshot.matchDateId,
      snapshot.betAmount,
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
      createdAt: this.createdAt,
    };
  }
}
