import type { UserRepo } from '../../domain/ports/user-repo.js';
import type { TournamentRepo } from '../../domain/ports/tournament-repo.js';
import type { MatchRepo } from '../../domain/ports/match-repo.js';
import type { TicketRepo } from '../../domain/ports/ticket-repo.js';
import { User } from '../../domain/entities/user.js';
import { Ticket } from '../../domain/entities/ticket.js';
import { TicketPrediction } from '../../domain/entities/ticket-prediction.js';
import { Money } from '../../domain/value-objects/money.js';
import { assertPrediction } from '../../domain/value-objects/prediction.js';
import type { Prediction } from '../../domain/value-objects/prediction.js';
import {
  MatchDateNotFoundError,
  DateNotOpenError,
  DuplicateBetError,
} from '../../domain/errors/index.js';

// ── DTOs ──────────────────────────────────────────────────────────

export interface TicketPredictionDTO {
  matchId: number;
  prediction: Prediction;
}

export interface TicketDTO {
  id: number;
  userId: string;
  matchDateId: number;
  betAmount: number;
  prizeWon: number | null; // cents — set when results are published
  predictions: TicketPredictionDTO[];
  createdAt: Date;
}

export interface PlaceBetInput {
  userId: string;
  matchDateId: number;
  predictions: Record<string, Prediction>;
}

// ── Use Case ──────────────────────────────────────────────────────

/**
 * Place a bet on a match date.
 *
 * Validates business rules:
 * 1. Match date exists and is open
 * 2. User has sufficient balance
 * 3. User hasn't already bet on this date
 * 4. All matches in the date have a prediction
 *
 * On success: deducts balance, creates ticket, saves all.
 */
export class PlaceBetUseCase {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly tournamentRepo: TournamentRepo,
    private readonly matchRepo: MatchRepo,
    private readonly ticketRepo: TicketRepo,
  ) {}

  async execute(input: PlaceBetInput): Promise<TicketDTO> {
    // 1. Load match date — must exist and be open
    const matchDate = await this.tournamentRepo.findMatchDateById(input.matchDateId);
    if (!matchDate) {
      throw new MatchDateNotFoundError(input.matchDateId);
    }
    if (!matchDate.isOpen()) {
      throw new DateNotOpenError(input.matchDateId, matchDate.status);
    }

    // 2. Load user — must have sufficient balance
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new Error(`User not found: ${input.userId}`); // should not happen with auth
    }
    const updatedUser = user.deductBalance(matchDate.betAmount);

    // 3. Check for duplicate bet on this date
    const existing = await this.ticketRepo.findByUserAndDate(input.userId, input.matchDateId);
    if (existing) {
      throw new DuplicateBetError(input.userId, input.matchDateId);
    }

    // 4. Load matches for this date — validate all have predictions
    const matches = await this.matchRepo.findByMatchDateId(input.matchDateId);
    const matchIds = new Set(matches.map((m) => m.id));
    const providedMatchIds = new Set(Object.keys(input.predictions).map(Number));

    // Every match in the date must have a prediction
    for (const match of matches) {
      if (!providedMatchIds.has(match.id)) {
        throw new Error(`Missing prediction for match ${match.id} (${match.localTeam} vs ${match.visitorTeam})`);
      }
    }

    // No predictions for non-existent matches
    for (const strId of Object.keys(input.predictions)) {
      const id = Number(strId);
      if (!matchIds.has(id)) {
        throw new Error(`Prediction provided for non-existent match ${id}`);
      }
    }

    // 5. Build predictions domain objects
    const predictions: TicketPrediction[] = [];
    for (const [strId, pred] of Object.entries(input.predictions)) {
      assertPrediction(pred);
      predictions.push(
        TicketPrediction.new({
          matchId: Number(strId),
          prediction: pred,
        }),
      );
    }

    // 6. Create ticket entity (id = 0 placeholder; repo sets real id)
    const ticket = Ticket.new({
      id: 0,
      userId: input.userId,
      matchDateId: input.matchDateId,
      betAmount: matchDate.betAmount.cents,
      predictions,
    });

    // 7. Save ticket (transaction: ticket + predictions) and update user balance
    const savedTicket = await this.ticketRepo.save(ticket, predictions);
    await this.userRepo.update(updatedUser);

    // 8. Return DTO
    return this.toDTO(savedTicket);
  }

  private toDTO(ticket: Ticket): TicketDTO {
    return {
      id: ticket.id,
      userId: ticket.userId,
      matchDateId: ticket.matchDateId,
      betAmount: ticket.betAmount.cents,
      prizeWon: ticket.prizeWon,
      predictions: ticket.predictions.map((tp) => ({
        matchId: tp.matchId,
        prediction: tp.prediction,
      })),
      createdAt: ticket.createdAt,
    };
  }
}
