import type { Prediction } from '../value-objects/prediction.js';
import { assertPrediction } from '../value-objects/prediction.js';

export interface TicketPredictionSnapshot {
  id?: number;
  ticketId?: number;
  matchId: number;
  prediction: Prediction;
}

export class TicketPrediction {
  private constructor(
    public readonly id: number | undefined,
    public readonly ticketId: number | undefined,
    public readonly matchId: number,
    public readonly prediction: Prediction,
  ) {}

  // ── Factory ──────────────────────────────────────────────────

  static create(snapshot: TicketPredictionSnapshot): TicketPrediction {
    assertPrediction(snapshot.prediction);
    return new TicketPrediction(
      snapshot.id,
      snapshot.ticketId,
      snapshot.matchId,
      snapshot.prediction,
    );
  }

  static new(props: {
    matchId: number;
    prediction: Prediction;
  }): TicketPrediction {
    return new TicketPrediction(undefined, undefined, props.matchId, props.prediction);
  }

  toSnapshot(): TicketPredictionSnapshot {
    return {
      id: this.id,
      ticketId: this.ticketId,
      matchId: this.matchId,
      prediction: this.prediction,
    };
  }
}
