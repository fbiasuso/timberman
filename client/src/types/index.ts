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

/** Per-date points breakdown for a user */
export interface UserDateBreakdown {
  dateNumber: number;
  points: number;
  date: string;
}
