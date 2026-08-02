/** Match outcome prediction: Local / Empate / Visita */
export type Prediction = 'L' | 'E' | 'V';

/** Match date status lifecycle */
export type MatchDateStatus = 'open' | 'closed' | 'results';

/** Match date DTO (from GET /api/matches/current and /dates) */
export interface MatchDateDTO {
  id: number;
  tournamentId: number;
  dateNumber: number;
  status: MatchDateStatus;
  pozo: number;
  betAmount: number;
  /** Commission percentage snapshot taken when the date was closed */
  commission: number;
  /** Cents — unpaid pozo accumulated in the parent tournament */
  carryover: number;
  createdAt: string;
}

/** Match DTO */
export interface MatchDTO {
  id: number;
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  localImg: string | null;
  visitorImg: string | null;
  scheduledAt: string | null;
  result: string | null;
  score: string | null;
}

/** Body for POST /api/admin/matches — create a match on an open date */
export interface CreateMatchPayload {
  matchDateId: number;
  localTeam: string;
  visitorTeam: string;
  /** Image URLs / scheduled time are optional; null clears when updating */
  localImg?: string | null;
  visitorImg?: string | null;
  scheduledAt?: string | null;
}

/** Body for PATCH /api/admin/matches/:matchId — partial match details update */
export interface UpdateMatchDetailsPayload {
  localTeam?: string;
  visitorTeam?: string;
  localImg?: string | null;
  visitorImg?: string | null;
  scheduledAt?: string | null;
}

/** Ticket prediction DTO */
export interface TicketPredictionDTO {
  matchId: number;
  prediction: Prediction;
}

/** Ticket DTO (from GET /api/bets / POST /api/bets) */
export interface TicketDTO {
  id: number;
  userId: string;
  matchDateId: number;
  betAmount: number;
  /** Cents won after results are published — null until the ticket wins */
  prizeWon: number | null;
  predictions: TicketPredictionDTO[];
  createdAt: string;
}

/** Ranking entry DTO */
export interface RankingEntry {
  userId: string;
  username: string;
  totalPoints: number;
  position: number;
}

/** Per-date points breakdown for a user (matches server UserDateDetail DTO) */
export interface UserDateBreakdown {
  dateNumber: number;
  points: number;
  totalMatches: number;
  correctPredictions: number;
}
